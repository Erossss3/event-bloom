-- =====================================================================
-- request_video_summary() — corrige la regresión introducida por
-- 20260722140000_fix_video_summary_missing.sql
-- =====================================================================
-- Causa raíz (root cause), no un parche: 20260722140000...sql hizo
-- "CREATE OR REPLACE FUNCTION public.request_video_summary(uuid, text,
-- integer)" — misma firma que la versión correcta de
-- 20260721230000_video_summary_fixes.sql (int/integer son el mismo tipo
-- en Postgres), por lo que la REEMPLAZÓ por completo, con una versión
-- que:
--   1) inserta status = 'pending' — valor que NO existe en el enum
--      public.video_status ('queued'/'processing'/'completed'/'failed',
--      creado en 20260721220000...sql) → cualquier llamada falla con
--      "invalid input value for enum video_status: pending".
--   2) no valida is_event_owner() — solo confirma que el evento exista,
--      permitiendo pedir un video para un evento AJENO.
--   3) no setea requested_by ni queued_at.
--   4) no maneja el unique_violation del índice anti-duplicados
--      (idx_videos_active_unique, 20260721230000...sql).
--
-- Esta migración no edita ninguna existente (no se puede, y no
-- corresponde): vuelve a definir la función una vez más, con el cuerpo
-- correcto, como la versión final y autoritativa.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.request_video_summary(
  p_event_id uuid,
  p_style text,
  p_duration_seconds int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_video_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT public.is_event_owner(p_event_id) THEN
    RAISE EXCEPTION 'only the event owner can request a video summary';
  END IF;

  BEGIN
    INSERT INTO public.videos (
      event_id, style, duration_seconds, status, progress_percent,
      requested_by, queued_at
    ) VALUES (
      p_event_id, p_style, p_duration_seconds, 'queued', 0,
      auth.uid(), now()
    ) RETURNING id INTO v_video_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'a video job with this style and duration is already queued or processing for this event';
  END;

  RETURN v_video_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_video_summary(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_video_summary(uuid, text, int) TO authenticated;

-- =====================================================================
-- Rollback: no aplicable — restaurar esta versión sería reintroducir la
-- regresión de 20260722140000...sql a propósito, nunca deseable.
-- =====================================================================
