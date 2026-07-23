-- =====================================================================
-- VIDEO SUMMARY — correcciones de la auditoría de diseño
-- =====================================================================
-- Corrige, sin tocar la migración anterior (20260721220000...sql), los
-- 5 hallazgos de su auditoría:
--   1) requested_by/render_job_id/error_message/campos operativos
--      expuestos a anon vía la policy "view videos".
--   2) TOCTOU en cancel_video_summary()/retry_video_summary().
--   3) El organizador podía escribir status/progress_percent/video_url/
--      storage_path/render_job_id directamente (policy "owner manage
--      videos" FOR ALL).
--   4) Sin protección contra jobs duplicados.
--   5) mark_video_*() dependían de un default de privilegios de
--      Supabase para service_role, nunca declarado explícitamente acá.
-- =====================================================================


-- =====================================================================
-- 1) EXPOSICIÓN PÚBLICA — vista en vez de columnas sueltas
-- =====================================================================
-- ANTES:
--   GRANT SELECT ON public.videos TO anon;
--   CREATE POLICY "view videos" ON public.videos FOR SELECT TO anon, authenticated
--     USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
-- (SELECT de tabla completa sin restricción de columnas: requested_by,
--  render_job_id, error_message y cualquier campo operativo futuro
--  quedaban legibles por cualquier visitante anónimo de un evento
--  público.)
--
-- DESPUÉS: anon deja de tener cualquier acceso a la tabla base. El
-- organizador (authenticated + is_event_owner) sigue viendo todas las
-- columnas de sus propios videos —las necesita para el panel de
-- administración (progreso, error, etc.)—, pero ya no vía una policy
-- que también dejaba entrar a "anon". Lo público se sirve desde una
-- vista con una proyección de columnas fija y un WHERE que ya de por sí
-- excluye todo lo que no sea un video terminado de un evento público —
-- una vista es la herramienta correcta acá porque RLS por sí sola
-- filtra FILAS, no COLUMNAS; para ocultar columnas enteras (no solo
-- filas) a un rol hace falta o bien GRANT por columna o bien una vista,
-- y una vista además documenta explícitamente, por su propio nombre y
-- definición, cuál es el contrato público real.
-- =====================================================================

DROP POLICY IF EXISTS "view videos" ON public.videos;
DROP POLICY IF EXISTS "owner manage videos" ON public.videos;

CREATE POLICY "owner view videos" ON public.videos FOR SELECT TO authenticated
  USING (public.is_event_owner(event_id));

REVOKE SELECT ON public.videos FROM anon;
-- Ver sección 3 más abajo para el resto de los REVOKE de esta tabla.

CREATE OR REPLACE VIEW public.videos_public AS
SELECT
  id,
  event_id,
  style,
  duration_seconds,
  video_url,
  storage_path,
  completed_at,
  created_at
FROM public.videos
WHERE status = 'completed'
  AND public.event_accepts_public(event_id);

GRANT SELECT ON public.videos_public TO anon, authenticated;

-- =====================================================================
-- 2) TOCTOU — cancel_video_summary() y retry_video_summary()
-- =====================================================================
-- ANTES (ambas funciones): SELECT status aparte, validación en memoria,
-- y UPDATE final SIN repetir la condición de estado en su WHERE — una
-- transición concurrente entre la lectura y la escritura (por ejemplo,
-- el worker completando el job justo en ese instante) podía dejar la
-- fila con status='failed' pero con storage_path/video_url de un
-- archivo real ya generado, sin que la UI volviera a mostrarlo nunca.
--
-- DESPUÉS: la condición de estado permitido se move al WHERE del propio
-- UPDATE (atómico), y se usa FOUND para confirmar si aplicó — exacto
-- mismo patrón que ya usaban correctamente mark_video_processing() /
-- mark_video_progress() / mark_video_completed() / mark_video_failed()
-- (sin cambios en esas cuatro, ya estaban bien). El SELECT previo queda
-- únicamente para resolver el event_id necesario para is_event_owner()
-- (el ownership de un job no cambia de forma concurrente, ahí no hay
-- ninguna condición de carrera real).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cancel_video_summary(p_video_id uuid)
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
    RAISE EXCEPTION 'only the event owner can cancel this job';
  END IF;

  UPDATE public.videos
    SET status = 'failed', cancelled = true,
        error_message = 'Cancelado por el organizador',
        failed_at = now()
    WHERE id = p_video_id AND status IN ('queued', 'processing');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'only a queued or processing job can be cancelled';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_video_summary(p_video_id uuid)
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
    RAISE EXCEPTION 'only the event owner can retry this job';
  END IF;

  UPDATE public.videos
    SET status = 'queued', progress_percent = 0, cancelled = false,
        error_message = NULL, storage_path = NULL, video_url = NULL,
        render_job_id = NULL, queued_at = now(), started_at = NULL,
        completed_at = NULL, failed_at = NULL
    WHERE id = p_video_id AND status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'only a failed job can be retried';
  END IF;
END;
$$;

-- =====================================================================
-- 3) SEPARACIÓN DE PERMISOS — el organizador ya no puede escribir la
--    tabla directamente
-- =====================================================================
-- ANTES: "owner manage videos" ON public.videos FOR ALL TO authenticated
--   USING (is_event_owner(event_id)) WITH CHECK (is_event_owner(event_id));
-- (permitía INSERT/UPDATE/DELETE directos sobre CUALQUIER columna de
-- sus propios videos — status, progress_percent, video_url,
-- storage_path, render_job_id incluidos — evitando por completo las
-- funciones y su máquina de estados.)
--
-- DESPUÉS: esa policy ya fue eliminada arriba (paso 1) y reemplazada
-- únicamente por "owner view videos" (SELECT). No se crea ninguna
-- policy de INSERT/UPDATE/DELETE para "authenticated" sobre "videos":
-- sin una policy que lo permita, RLS deniega esas operaciones por
-- default para cualquier sesión que no sea SECURITY DEFINER. Además,
-- se revocan explícitamente los GRANT de tabla que databan desde el
-- esquema original, para no depender únicamente de la ausencia de
-- policy:
REVOKE INSERT, UPDATE, DELETE ON public.videos FROM authenticated;

-- request_video_summary()/cancel_video_summary()/retry_video_summary()
-- siguen funcionando igual: son SECURITY DEFINER, así que su INSERT/
-- UPDATE corre con los privilegios del dueño de la función, no con los
-- del organizador que las invoca — no dependen del GRANT que se acaba
-- de revocar.

-- =====================================================================
-- 4) ANTI-DUPLICADOS — un mismo evento no puede tener dos jobs activos
--    con el mismo estilo y duración
-- =====================================================================
-- COALESCE(duration_seconds, -1): duration_seconds es nullable, y en un
-- índice UNIQUE dos NULL nunca se consideran iguales entre sí — sin este
-- COALESCE, dos jobs "queued" para el mismo evento/estilo sin duración
-- especificada seguirían pudiendo duplicarse.
-- =====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_active_unique
  ON public.videos (event_id, style, COALESCE(duration_seconds, -1))
  WHERE status IN ('queued', 'processing');

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

-- =====================================================================
-- 5) GRANTS EXPLÍCITOS para el worker (service_role) en las 4 funciones
--    internas — sin depender de ningún default de privilegios de la
--    plataforma.
-- =====================================================================

GRANT EXECUTE ON FUNCTION public.mark_video_processing(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_video_progress(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_video_completed(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_video_failed(uuid, text) TO service_role;

-- =====================================================================
-- Rollback:
--   REVOKE EXECUTE ON FUNCTION public.mark_video_processing(uuid, text) FROM service_role;
--   REVOKE EXECUTE ON FUNCTION public.mark_video_progress(uuid, int) FROM service_role;
--   REVOKE EXECUTE ON FUNCTION public.mark_video_completed(uuid, text, text) FROM service_role;
--   REVOKE EXECUTE ON FUNCTION public.mark_video_failed(uuid, text) FROM service_role;
--   DROP INDEX IF EXISTS public.idx_videos_active_unique;
--   GRANT INSERT, UPDATE, DELETE ON public.videos TO authenticated;
--   REVOKE SELECT ON public.videos_public FROM anon, authenticated;
--   DROP VIEW IF EXISTS public.videos_public;
--   GRANT SELECT ON public.videos TO anon;
--   DROP POLICY IF EXISTS "owner view videos" ON public.videos;
--   CREATE POLICY "owner manage videos" ON public.videos FOR ALL TO authenticated
--     USING (public.is_event_owner(event_id)) WITH CHECK (public.is_event_owner(event_id));
--   CREATE POLICY "view videos" ON public.videos FOR SELECT TO anon, authenticated
--     USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
--   (más restaurar los cuerpos anteriores de request_video_summary()/
--   cancel_video_summary()/retry_video_summary() desde 20260721220000...sql)
-- =====================================================================
