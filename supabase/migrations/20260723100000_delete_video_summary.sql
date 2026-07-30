-- =====================================================================
-- delete_video_summary() — no existía ninguna forma de borrar un video
-- (ni el organizador desde la UI ni nadie más): cancel_video_summary()
-- solo actúa sobre jobs activos (queued/processing) y los deja en
-- 'failed', retry_video_summary() solo resetea un 'failed' a 'queued'.
-- Ninguna de las dos borra la fila.
--
-- Solo permite borrar 'failed' o 'completed' — nunca 'queued'/'processing'
-- (un job activo hay que cancelarlo primero, no borrarlo de abajo del
-- worker que lo está procesando).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.delete_video_summary(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT event_id INTO v_event_id FROM public.videos WHERE id = p_video_id;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'video job not found';
  END IF;
  IF NOT public.is_event_owner(v_event_id) THEN
    RAISE EXCEPTION 'only the event owner can delete this job';
  END IF;

  DELETE FROM public.videos
    WHERE id = p_video_id AND status IN ('failed', 'completed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'only a failed or completed job can be deleted — cancel active jobs first';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_video_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_video_summary(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Rollback: DROP FUNCTION IF EXISTS public.delete_video_summary(uuid);
-- =====================================================================
