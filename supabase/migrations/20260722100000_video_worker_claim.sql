-- =====================================================================
-- VIDEO SUMMARY — reclamo atómico para múltiples workers + reaper de
-- jobs abandonados
-- =====================================================================
-- Corrige, sin editar ninguna migración anterior, el hallazgo de la
-- auditoría del worker: "processVideoJob() reclama el job dentro de su
-- propio cuerpo, sin que el worker pueda distinguir 'no había nada para
-- mí' de 'reclamé esto y algo falló después'".
-- =====================================================================

-- ---------------------------------------------------------------------
-- claim_next_video_job() — un único viaje a la base que busca el
-- próximo job en cola, lo bloquea con FOR UPDATE SKIP LOCKED (si otro
-- worker ya lo tiene bloqueado en su propia transacción, esta consulta
-- lo salta y prueba con el siguiente, en vez de esperar) y lo pasa a
-- 'processing' de forma atómica. Devuelve NULL si no hay nada para
-- reclamar — el worker interpreta NULL como "cola vacía", nunca como
-- error.
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
      SET status = 'processing', started_at = now()
      WHERE v.id = v_id
      RETURNING v.id, v.event_id, v.style, v.duration_seconds;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_next_video_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_video_job() TO service_role;

-- ---------------------------------------------------------------------
-- reap_stale_video_jobs() — si un worker muere (proceso matado, container
-- reiniciado) a mitad de un render, su job queda en 'processing' para
-- siempre — nadie más lo va a tocar porque claim_next_video_job() solo
-- mira 'queued'. Esta función falla explícitamente cualquier job
-- 'processing' cuyo started_at sea más viejo que el timeout dado,
-- liberándolo con un mensaje claro. Se llama desde el propio loop del
-- worker (ver remotion/src/worker/), no requiere ningún cron externo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reap_stale_video_jobs(p_timeout_seconds int DEFAULT 900)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    UPDATE public.videos
      SET status = 'failed',
          error_message = 'El worker que procesaba este job se interrumpió inesperadamente (timeout de ' || p_timeout_seconds || 's superado).',
          failed_at = now()
      WHERE status = 'processing'
        AND started_at IS NOT NULL
        AND started_at < now() - make_interval(secs => p_timeout_seconds)
      RETURNING id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reap_stale_video_jobs(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reap_stale_video_jobs(int) TO service_role;

-- =====================================================================
-- Rollback:
--   REVOKE EXECUTE ON FUNCTION public.reap_stale_video_jobs(int) FROM service_role;
--   DROP FUNCTION IF EXISTS public.reap_stale_video_jobs(int);
--   REVOKE EXECUTE ON FUNCTION public.claim_next_video_job() FROM service_role;
--   DROP FUNCTION IF EXISTS public.claim_next_video_job();
-- =====================================================================
