-- Additive DevOS multi-level hierarchy. Sprint remains a scheduling attribute.
ALTER TABLE public.devos_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.devos_tasks(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS feature_ref text;
UPDATE public.devos_tasks SET feature_ref=phase_ref WHERE feature_ref IS NULL AND phase_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS devos_task_parent_idx ON public.devos_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS devos_task_feature_idx ON public.devos_tasks(feature_ref);
ALTER TABLE public.devos_tasks DROP CONSTRAINT IF EXISTS devos_task_feature_ref_format_ck;
ALTER TABLE public.devos_tasks ADD CONSTRAINT devos_task_feature_ref_format_ck
 CHECK(feature_ref IS NULL OR (char_length(feature_ref) BETWEEN 2 AND 100 AND feature_ref ~ '^[a-zA-Z0-9_-]+$'));
CREATE OR REPLACE FUNCTION public.devos_validate_task_tree() RETURNS trigger
 LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE parent_row public.devos_tasks; self_cycle boolean;
BEGIN
 IF NEW.parent_task_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.parent_task_id=NEW.id THEN RAISE EXCEPTION 'devos_self_parent'; END IF;
 SELECT * INTO parent_row FROM public.devos_tasks WHERE id=NEW.parent_task_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'devos_parent_missing'; END IF;
 IF parent_row.scope IS DISTINCT FROM NEW.scope OR
    parent_row.product_codes @> NEW.product_codes IS NOT TRUE OR
    NEW.product_codes @> parent_row.product_codes IS NOT TRUE
 THEN RAISE EXCEPTION 'devos_parent_scope_mismatch'; END IF;
 WITH RECURSIVE ancestors(id,parent_id,depth) AS(
   SELECT id,parent_task_id,1 FROM public.devos_tasks WHERE id=NEW.parent_task_id
   UNION ALL
   SELECT t.id,t.parent_task_id,a.depth+1
   FROM public.devos_tasks t JOIN ancestors a ON t.id=a.parent_id WHERE a.depth<100
 )
 SELECT EXISTS(SELECT 1 FROM ancestors WHERE id=NEW.id OR depth>=100) INTO self_cycle;
 IF self_cycle THEN RAISE EXCEPTION 'devos_parent_cycle'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS devos_validate_tree_trigger ON public.devos_tasks;
CREATE TRIGGER devos_validate_tree_trigger BEFORE INSERT OR UPDATE OF parent_task_id,scope,product_codes
 ON public.devos_tasks FOR EACH ROW EXECUTE FUNCTION public.devos_validate_task_tree();

CREATE OR REPLACE FUNCTION public.devos_move_task(
 p_task_id uuid,p_new_parent_id uuid,p_expected_revision integer,p_actor uuid
) RETURNS public.devos_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item public.devos_tasks;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('devos_move_tree'));
 SELECT * INTO item FROM public.devos_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'devos_task_not_found'; END IF;
 IF item.revision<>p_expected_revision THEN RAISE EXCEPTION 'devos_revision_conflict'; END IF;
 UPDATE public.devos_tasks SET parent_task_id=p_new_parent_id,updated_by=p_actor
 WHERE id=p_task_id RETURNING * INTO item;
 RETURN item;
END $$;

CREATE OR REPLACE FUNCTION public.devos_assign_feature(
 p_task_id uuid,p_feature_ref text,p_expected_revision integer,p_actor uuid
) RETURNS public.devos_tasks
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item public.devos_tasks;
BEGIN
 IF p_feature_ref IS NOT NULL AND (char_length(p_feature_ref) NOT BETWEEN 2 AND 100 OR p_feature_ref !~ '^[a-zA-Z0-9_-]+$')
 THEN RAISE EXCEPTION 'devos_invalid_feature_ref'; END IF;
 SELECT * INTO item FROM public.devos_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'devos_task_not_found'; END IF;
 IF item.revision<>p_expected_revision THEN RAISE EXCEPTION 'devos_revision_conflict'; END IF;
 IF item.parent_task_id IS NOT NULL THEN RAISE EXCEPTION 'devos_nested_inherits_parent'; END IF;
 IF item.scope<>'product' AND p_feature_ref IS NOT NULL THEN RAISE EXCEPTION 'devos_feature_requires_product'; END IF;
 UPDATE public.devos_tasks SET feature_ref=p_feature_ref,updated_by=p_actor
 WHERE id=p_task_id RETURNING * INTO item;
 RETURN item;
END $$;
REVOKE ALL ON FUNCTION public.devos_move_task(uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.devos_move_task(uuid,uuid,integer,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.devos_assign_feature(uuid,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.devos_assign_feature(uuid,text,integer,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.devos_validate_task_tree() FROM PUBLIC,anon,authenticated;
