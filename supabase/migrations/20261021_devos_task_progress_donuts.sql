-- Additive per-task documented progress. Audited readiness is independent.
ALTER TABLE public.devos_tasks
 ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT NULL
 CONSTRAINT devos_progress_percentage_ck CHECK(progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100);
CREATE OR REPLACE FUNCTION public.devos_set_task_progress(
 p_task_id uuid,p_expected_revision integer,p_progress integer,p_actor uuid
) RETURNS public.devos_tasks
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item public.devos_tasks;
BEGIN
 IF p_progress IS NOT NULL AND (p_progress<0 OR p_progress>100) THEN RAISE EXCEPTION 'progress_out_of_range'; END IF;
 SELECT * INTO item FROM public.devos_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'devos_task_not_found'; END IF;
 IF item.revision<>p_expected_revision THEN RAISE EXCEPTION 'devos_revision_conflict'; END IF;
 IF EXISTS(SELECT 1 FROM public.devos_tasks WHERE parent_task_id=p_task_id)
 THEN RAISE EXCEPTION 'parent_progress_calculated_from_children'; END IF;
 UPDATE public.devos_tasks SET progress_percent=p_progress,updated_by=p_actor
 WHERE id=p_task_id RETURNING * INTO item;
 RETURN item;
END $$;
REVOKE ALL ON FUNCTION public.devos_set_task_progress(uuid,integer,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.devos_set_task_progress(uuid,integer,integer,uuid) TO service_role;