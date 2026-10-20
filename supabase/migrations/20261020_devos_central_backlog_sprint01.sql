-- DELSA DevOS Central Backlog (additive, admin/service-role only)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS public.devos_task_number_seq;
CREATE TABLE IF NOT EXISTS public.devos_sprints(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, title text NOT NULL,
 objective text NOT NULL DEFAULT '', scope text NOT NULL DEFAULT 'product',
 product_codes text[] NOT NULL DEFAULT '{}', state text NOT NULL DEFAULT 'planned',
 acceptance_criteria jsonb NOT NULL DEFAULT '[]', starts_on date, ends_on date,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT devos_sprint_scope_ck CHECK(scope IN ('product','platform','cross_product')),
 CONSTRAINT devos_sprint_state_ck CHECK(state IN ('planned','active','completed','cancelled'))
);
CREATE TABLE IF NOT EXISTS public.devos_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_key text UNIQUE,
 sprint_id uuid REFERENCES public.devos_sprints(id) ON DELETE SET NULL,
 title text NOT NULL, description text NOT NULL DEFAULT '',
 scope text NOT NULL DEFAULT 'platform', product_codes text[] NOT NULL DEFAULT '{}',
 workstream text NOT NULL DEFAULT 'engineering', task_type text NOT NULL DEFAULT 'improvement',
 priority text NOT NULL DEFAULT 'P2', status text NOT NULL DEFAULT 'idea',
 phase_ref text, acceptance_criteria jsonb NOT NULL DEFAULT '[]',
 blocker_reason text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 revision integer NOT NULL DEFAULT 1, created_by uuid, updated_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 CONSTRAINT devos_task_scope_ck CHECK(scope IN ('product','platform','cross_product')),
 CONSTRAINT devos_task_status_ck CHECK(status IN ('idea','triage','ready','in_progress','testing','preview','released','verified','blocked','cancelled')),
 CONSTRAINT devos_task_priority_ck CHECK(priority IN ('P0','P1','P2','P3')),
 CONSTRAINT devos_task_type_ck CHECK(task_type IN ('idea','feature','improvement','bug','security','performance','infrastructure','research','maintenance')),
 CONSTRAINT devos_task_workstream_ck CHECK(workstream IN ('engineering','security','infra','ui_ux','data','quality','research','operations','business')),
 CONSTRAINT devos_task_scope_product_ck CHECK((scope='product' AND cardinality(product_codes)=1) OR (scope='cross_product' AND cardinality(product_codes)>=2) OR (scope='platform')),
 CONSTRAINT devos_task_criteria_ck CHECK(jsonb_typeof(acceptance_criteria)='array')
);
CREATE INDEX IF NOT EXISTS devos_task_sprint_idx ON public.devos_tasks(sprint_id,status);
CREATE INDEX IF NOT EXISTS devos_task_updated_idx ON public.devos_tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS devos_task_products_idx ON public.devos_tasks USING gin(product_codes);
CREATE TABLE IF NOT EXISTS public.devos_task_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 task_id uuid NOT NULL REFERENCES public.devos_tasks(id) ON DELETE CASCADE,
 action text NOT NULL, actor_id uuid, old_snapshot jsonb, new_snapshot jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devos_event_task_idx ON public.devos_task_events(task_id,id DESC);
CREATE TABLE IF NOT EXISTS public.devos_evidence(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES public.devos_tasks(id) ON DELETE CASCADE,
 kind text NOT NULL, verdict text NOT NULL DEFAULT 'unknown', url text,
 commit_sha text, deployment_id text, notes text NOT NULL DEFAULT '', added_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT devos_ev_kind_ck CHECK(kind IN ('pr','commit','ci','preview','production_deployed','production_e2e','database','documentation','manual_test')),
 CONSTRAINT devos_ev_verdict_ck CHECK(verdict IN ('unknown','passed','failed','blocked'))
);
CREATE INDEX IF NOT EXISTS devos_ev_task_idx ON public.devos_evidence(task_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS devos_pr_link_unique ON public.devos_evidence(task_id,url) WHERE kind='pr' AND url IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.devos_task_dependencies(
 task_id uuid NOT NULL REFERENCES public.devos_tasks(id) ON DELETE CASCADE,
 depends_on_id uuid NOT NULL REFERENCES public.devos_tasks(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(task_id,depends_on_id), CHECK(task_id<>depends_on_id)
);
CREATE OR REPLACE FUNCTION public.devos_task_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.task_key IS NULL OR NEW.task_key='' THEN
     NEW.task_key:='DEV-'||lpad(nextval('public.devos_task_number_seq')::text,6,'0');
   END IF;
 ELSE
   NEW.revision:=OLD.revision+1; NEW.updated_at:=now();
   IF NEW.status IN ('verified','cancelled') THEN NEW.closed_at:=now();
   ELSIF NEW.status<>OLD.status THEN NEW.closed_at:=NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS devos_touch_trigger ON public.devos_tasks;
CREATE TRIGGER devos_touch_trigger BEFORE INSERT OR UPDATE ON public.devos_tasks FOR EACH ROW EXECUTE FUNCTION public.devos_task_touch();
CREATE OR REPLACE FUNCTION public.devos_task_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.devos_task_events(task_id,action,actor_id,old_snapshot,new_snapshot)
 VALUES(NEW.id,CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,
   COALESCE(NEW.updated_by,NEW.created_by),
   CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS devos_audit_trigger ON public.devos_tasks;
CREATE TRIGGER devos_audit_trigger AFTER INSERT OR UPDATE ON public.devos_tasks FOR EACH ROW EXECUTE FUNCTION public.devos_task_audit();
CREATE OR REPLACE FUNCTION public.devos_attach_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.devos_task_events(task_id,action,actor_id,new_snapshot)
 VALUES(NEW.task_id, CASE WHEN TG_TABLE_NAME='devos_evidence' THEN 'evidence_added' ELSE 'dependency_added' END,
 CASE WHEN TG_TABLE_NAME='devos_evidence' THEN NEW.added_by ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS devos_ev_audit ON public.devos_evidence;
CREATE TRIGGER devos_ev_audit AFTER INSERT ON public.devos_evidence FOR EACH ROW EXECUTE FUNCTION public.devos_attach_audit();
DROP TRIGGER IF EXISTS devos_dep_audit ON public.devos_task_dependencies;
CREATE TRIGGER devos_dep_audit AFTER INSERT ON public.devos_task_dependencies FOR EACH ROW EXECUTE FUNCTION public.devos_attach_audit();

CREATE OR REPLACE FUNCTION public.devos_patch_task(
 p_task_id uuid,p_expected_revision integer,p_patch jsonb,p_actor uuid
) RETURNS public.devos_tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.devos_tasks; next_status text;
BEGIN
 IF p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR p_patch='{}'::jsonb THEN RAISE EXCEPTION 'invalid_patch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN
  ('title','description','priority','status','workstream','task_type','scope','product_codes','phase_ref','blocker_reason','notes','sprint_id','acceptance_criteria'))
 THEN RAISE EXCEPTION 'forbidden_patch_field'; END IF;
 SELECT * INTO t FROM public.devos_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'task_not_found'; END IF;
 IF t.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 next_status:=COALESCE(p_patch->>'status',t.status);
 IF next_status='released' AND NOT EXISTS(SELECT 1 FROM public.devos_evidence WHERE task_id=p_task_id AND kind='production_deployed' AND verdict='passed')
 THEN RAISE EXCEPTION 'production_release_evidence_required'; END IF;
 IF next_status='verified' AND NOT EXISTS(SELECT 1 FROM public.devos_evidence WHERE task_id=p_task_id AND kind='production_e2e' AND verdict='passed')
 THEN RAISE EXCEPTION 'production_acceptance_evidence_required'; END IF;
 IF next_status='blocked' AND length(trim(COALESCE(p_patch->>'blocker_reason',t.blocker_reason)))<5
 THEN RAISE EXCEPTION 'blocker_reason_required'; END IF;
 UPDATE public.devos_tasks SET
 title=COALESCE(p_patch->>'title',title),description=COALESCE(p_patch->>'description',description),
 priority=COALESCE(p_patch->>'priority',priority),status=next_status,
 workstream=COALESCE(p_patch->>'workstream',workstream),task_type=COALESCE(p_patch->>'task_type',task_type),
 scope=COALESCE(p_patch->>'scope',scope),
 product_codes=CASE WHEN p_patch ? 'product_codes' THEN ARRAY(SELECT jsonb_array_elements_text(p_patch->'product_codes')) ELSE product_codes END,
 phase_ref=CASE WHEN p_patch ? 'phase_ref' THEN NULLIF(p_patch->>'phase_ref','') ELSE phase_ref END,
 blocker_reason=COALESCE(p_patch->>'blocker_reason',blocker_reason),notes=COALESCE(p_patch->>'notes',notes),
 acceptance_criteria=CASE WHEN p_patch ? 'acceptance_criteria' THEN p_patch->'acceptance_criteria' ELSE acceptance_criteria END,
 sprint_id=CASE WHEN p_patch ? 'sprint_id' THEN NULLIF(p_patch->>'sprint_id','')::uuid ELSE sprint_id END,
 updated_by=p_actor
 WHERE id=p_task_id RETURNING * INTO t;
 RETURN t;
END $$;
CREATE OR REPLACE FUNCTION public.devos_add_dependency(p_task uuid,p_parent uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_task=p_parent THEN RAISE EXCEPTION 'self_dependency'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.devos_tasks WHERE id=p_task)
 OR NOT EXISTS(SELECT 1 FROM public.devos_tasks WHERE id=p_parent) THEN RAISE EXCEPTION 'task_not_found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('devos_dependencies'));
 IF EXISTS(WITH RECURSIVE chain(id) AS (
   SELECT depends_on_id FROM public.devos_task_dependencies WHERE task_id=p_parent
   UNION SELECT d.depends_on_id FROM public.devos_task_dependencies d JOIN chain c ON c.id=d.task_id
 ) SELECT 1 FROM chain WHERE id=p_task) THEN RAISE EXCEPTION 'dependency_cycle'; END IF;
 INSERT INTO public.devos_task_dependencies(task_id,depends_on_id) VALUES(p_task,p_parent) ON CONFLICT DO NOTHING;
END $$;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['devos_sprints','devos_tasks','devos_task_events','devos_evidence','devos_task_dependencies']) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.devos_patch_task(uuid,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.devos_patch_task(uuid,integer,jsonb,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.devos_add_dependency(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.devos_add_dependency(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.devos_task_touch() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.devos_task_audit() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.devos_attach_audit() FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.devos_task_number_seq TO service_role;

INSERT INTO public.devos_sprints(code,title,objective,scope,product_codes,state,acceptance_criteria)
VALUES ('CIMA-S01','Sprint 01 — تثبیت سیما','پایدارسازی Production، پیام‌ها و ارسال انسانی پیش از توسعه Autopilot',
 'product',ARRAY['cima'],'active',
 '["سلامت Production بررسی شود","دریافت و ارسال پیام در کانال واقعی تأیید شود","تکرار پیام‌ها و Outbox بررسی شوند","شواهد Preview و Production ثبت شوند"]'::jsonb)
ON CONFLICT(code) DO NOTHING;
WITH seed(task_key,title,description,workstream,task_type,phase_ref,criteria) AS(VALUES
('CIMA-001','ممیزی نسخه و سلامت Production','SHA و خطاهای API و پایگاه داده را مستند کن','operations','maintenance','p0f8','["SHA فعال مستند باشد","مسیرهای حیاتی بررسی شوند"]'::jsonb),
('CIMA-002','رفع مشکلات نمایش سیما در دسکتاپ و موبایل','زوم ۱۰۰٪ و ۱۲۵٪، اسکرول و صفحات طولانی را آزمون کن','ui_ux','bug','p0f10','["صفحات اصلی خالی نشوند","کنترل‌ها در موبایل در دسترس باشند"]'::jsonb),
('CIMA-003','اعتبارسنجی دریافت Instagram و هویت مشتری','ورود پیام و Tenant و Replay را بررسی کن','engineering','bug','p1f3','["هر پیام به مشتری و Tenant درست برسد","Replay پیام تکراری نسازد"]'::jsonb),
('CIMA-004','ارسال امن پاسخ انسانی Instagram','Send و double click و stale draft و receipt را تست کن','engineering','bug','p2f6','["ارسال واقعی از حساب درست تأیید شود","Retry پیام تکراری نسازد"]'::jsonb),
('CIMA-005','بررسی Outbox معلق بدون ارسال کور','رکوردهای pending و وضعیت واقعی Provider را بررسی کن','operations','bug','p2f8','["هر رکورد علت مشخص داشته باشد","UNKNOWN بدون تطبیق مجدداً ارسال نشود"]'::jsonb),
('CIMA-006','اصلاح پیام‌های تکراری با Provider ID','بدون حذف پیام معتبر قدیمی، کلید idempotency را بررسی کن','data','bug','p1f5','["شناسه پیام در هر Account یکتا باشد","Resync تکرار نسازد"]'::jsonb),
('CIMA-007','رگرسیون امنیت و پایداری سیما','Unit و Integration و tenant isolation و build را اجرا کن','quality','maintenance','p0f7','["CI و Build موفق باشند","موارد تست نشده ثبت شوند"]'::jsonb),
('CIMA-008','پذیرش Preview و Production','Preview صحیح را تست کن و شواهد انتشار نهایی را ثبت کن','quality','maintenance','p0f10','["Preview روی SHA صحیح آماده باشد","پس از Promote سناریوهای Production تست شوند"]'::jsonb)
)
INSERT INTO public.devos_tasks(task_key,sprint_id,title,description,scope,product_codes,priority,workstream,task_type,phase_ref,acceptance_criteria,status)
SELECT s.task_key,p.id,s.title,s.description,'product',ARRAY['cima'],'P0',s.workstream,s.task_type,s.phase_ref,s.criteria,'ready'
FROM seed s CROSS JOIN public.devos_sprints p WHERE p.code='CIMA-S01'
ON CONFLICT(task_key) DO NOTHING;
INSERT INTO public.devos_task_dependencies(task_id,depends_on_id)
SELECT a.id,b.id FROM (VALUES
('CIMA-004','CIMA-003'),('CIMA-005','CIMA-004'),('CIMA-006','CIMA-003'),
('CIMA-007','CIMA-002'),('CIMA-007','CIMA-004'),('CIMA-007','CIMA-006'),('CIMA-008','CIMA-007')
) x(a,b) JOIN public.devos_tasks a ON a.task_key=x.a JOIN public.devos_tasks b ON b.task_key=x.b
ON CONFLICT DO NOTHING;