-- =====================================================================
-- VIDEO SUMMARY WORKER — heartbeat real (corrige el hallazgo ALTO de la
-- auditoría: reap_stale_video_jobs() basado en started_at podía
-- re-aprovechar un job todavía vivo si el render legítimo tardaba más
-- que el timeout).
-- =====================================================================
-- No se edita ninguna migración anterior. Reemplaza únicamente
-- claim_next_video_job() y reap_stale_video_jobs()
-- (20260722100000_video_worker_claim.sql), agregando la columna y la
-- función de heartbeat.
-- =====================================================================

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

-- ---------------------------------------------------------------------
-- claim_next_video_job() — sin cambios en la lógica de reclamo (SKIP
-- LOCKED sigue igual); ahora también deja heartbeat_at=now() en el mismo
-- momento del reclamo, para que nunca quede NULL entre "recién reclamado"
-- y "el worker manda su primer heartbeat real" — ese hueco quedaría
-- cubierto igual por el margen del timeout, pero así reap_stale_video_jobs()
-- no necesita ningún caso especial para NULL.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_next_video_job()
RETURNS TABLE (id uuid, event_id uuid, style text, duration_seconds int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT v.id INTO v_id
    FROM public.videos v
    WHERE v.status = 'queued'
    ORDER BY v.queued_at ASC NULLS LAST
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE public.videos v
      SET status = 'processing', started_at = now(), heartbeat_at = now()
      WHERE v.id = v_id
      RETURNING v.id, v.event_id, v.style, v.duration_seconds;
END;
$$;

-- ---------------------------------------------------------------------
-- mark_video_heartbeat() — el worker la llama periódicamente MIENTRAS
-- renderiza (impulsada por los propios eventos de progreso de Remotion,
-- no por un timer separado — ver remotion/src/renderer/index.ts). Si
-- falla (la fila ya no está en 'processing' — cancelada u otra causa), el
-- worker lo toma como señal para abortar el render de inmediato: esta
-- misma llamada es, a la vez, el mecanismo de heartbeat Y el chequeo de
-- cancelación — no hacen falta dos mecanismos separados.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_video_heartbeat(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos
    SET heartbeat_at = now()
    WHERE id = p_video_id AND status = 'processing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video job not found or not in processing state';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_video_heartbeat(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_video_heartbeat(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- reap_stale_video_jobs() — ahora mira heartbeat_at en vez de started_at.
-- El timeout deja de estar atado a "cuánto puede durar un render" (que
-- variaba con la duración/estilo elegido) y pasa a estar atado
-- únicamente a "cuánto puede tardar el worker en mandar el próximo
-- heartbeat" — dos cosas completamente distintas. Un render de 90
-- segundos de duración final que tarda 20 MINUTOS en procesarse (evento
-- con muchas fotos, máquina lenta) sigue mandando heartbeat cada pocos
-- segundos mientras el worker esté vivo, así que nunca se acerca al
-- timeout — el timeout solo se cumple cuando el worker deja de mandar
-- heartbeats, sin importar cuánto llevaba renderizando. Default bajado
-- de 900s a 90s (6x el intervalo de heartbeat esperado del worker,
-- ~15s) — ya no hace falta un margen de "duración máxima de un render",
-- alcanza con un margen de "cuántos heartbeats seguidos se pueden
-- perder antes de asumir que el worker murió".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reap_stale_video_jobs(p_timeout_seconds int DEFAULT 90)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    UPDATE public.videos
      SET status = 'failed',
          error_message = 'El worker que procesaba este job dejó de responder (sin heartbeat por más de ' || p_timeout_seconds || 's).',
          failed_at = now()
      WHERE status = 'processing'
        AND heartbeat_at IS NOT NULL
        AND heartbeat_at < now() - make_interval(secs => p_timeout_seconds)
      RETURNING id;
END;
$$;

-- =====================================================================
-- Rollback:
--   CREATE OR REPLACE FUNCTION public.reap_stale_video_jobs(p_timeout_seconds int DEFAULT 900)
--     ... (restaurar el cuerpo basado en started_at desde 20260722100000...sql)
--   DROP FUNCTION IF EXISTS public.mark_video_heartbeat(uuid);
--   CREATE OR REPLACE FUNCTION public.claim_next_video_job() ... (restaurar sin heartbeat_at)
--   ALTER TABLE public.videos DROP COLUMN IF EXISTS heartbeat_at;
-- =====================================================================
