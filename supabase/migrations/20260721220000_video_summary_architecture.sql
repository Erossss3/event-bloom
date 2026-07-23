-- =====================================================================
-- VIDEOS — arquitectura definitiva para Video Summary (Remotion, sin
-- conectar todavía el motor de render)
-- =====================================================================
-- Reemplaza el modelo anterior (status='ready' inmediato, video_url
-- apuntando a una página HTML animada en /e/$slug/summary) por una
-- máquina de estados real: queued -> processing -> completed | failed,
-- con progreso, mensajes de error, timestamps de cada transición, y el
-- bucket "exports" (ya existente, sin tocar sus policies) como destino
-- del archivo final.
--
-- Se ALTERA la tabla existente (no se recrea): conserva PK, FK a
-- events con CASCADE, índice y trigger de updated_at ya presentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Migración de datos ANTES de tipar la columna: cualquier fila
--    creada por el sistema anterior tenía status='ready' con un
--    video_url que apunta a una página, no a un archivo. Bajo el nuevo
--    modelo eso ya no es un estado válido de "completado" — se marca
--    como failed con un mensaje explícito, para que la UI nunca
--    ofrezca "descargar" algo que no es un video real.
-- ---------------------------------------------------------------------
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS error_message text;

UPDATE public.videos
SET status = 'failed',
    error_message = 'Generado por el sistema anterior (slideshow HTML). Reemplazado por el pipeline de Remotion — solicitá un nuevo resumen.'
WHERE status NOT IN ('queued', 'processing', 'completed', 'failed');

-- ---------------------------------------------------------------------
-- 2) Enum real de estados (solo los 4 pedidos).
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.video_status AS ENUM ('queued', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.videos ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.videos ALTER COLUMN status TYPE public.video_status USING status::public.video_status;
ALTER TABLE public.videos ALTER COLUMN status SET DEFAULT 'queued';

-- ---------------------------------------------------------------------
-- 3) Columnas nuevas: progreso, timestamps de cada transición, destino
--    real en Storage, y correlación con el motor de render externo
--    (render_engine/render_job_id) para cuando exista el worker/webhook
--    de Remotion. "requested_by" deja trazabilidad de quién pidió cada
--    job (relevante si en el futuro hay más de un colaborador por
--    evento, hoy no rompe nada porque siempre es el propio owner).
-- ---------------------------------------------------------------------
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS progress_percent int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS render_engine text NOT NULL DEFAULT 'remotion',
  ADD COLUMN IF NOT EXISTS render_job_id text,
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_progress_percent_check CHECK (progress_percent BETWEEN 0 AND 100);

-- Estilo y duración: mismo set de valores que ya usa el picker del
-- organizador (VideoSummarySection.tsx) — se hace cumplir en la base
-- para que ninguna vía (ni siquiera un INSERT directo) cree un job con
-- un estilo/duración que el futuro render engine no sepa interpretar.
ALTER TABLE public.videos
  ADD CONSTRAINT videos_style_check CHECK (style IN ('cinematic', 'luxury', 'emotive', 'party'));
ALTER TABLE public.videos
  ADD CONSTRAINT videos_duration_check CHECK (duration_seconds IS NULL OR duration_seconds IN (30, 60, 90));

-- Backfill de queued_at para las filas recién marcadas 'failed' arriba,
-- solo por consistencia de datos (no tienen queued_at real porque nunca
-- pasaron por una cola).
UPDATE public.videos SET failed_at = updated_at WHERE status = 'failed' AND failed_at IS NULL;

-- ---------------------------------------------------------------------
-- 4) Índices para la futura cola de render: un worker necesitará poder
--    hacer "traeme los próximos jobs en queued" de forma eficiente, y
--    un webhook necesitará correlacionar por render_job_id sin
--    ambigüedad.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_videos_queued ON public.videos (queued_at) WHERE status = 'queued';
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_render_job_id ON public.videos (render_job_id) WHERE render_job_id IS NOT NULL;

-- Múltiples videos por evento: ya soportado (no hay ni había constraint
-- UNIQUE sobre event_id) — un mismo evento puede tener tantas filas en
-- "videos" como jobs se pidan, cada uno con su propio estilo/duración.

-- Realtime: mismo mecanismo que ya usan gallery/messages/rsvps/guests —
-- permite que el organizador vea el cambio de estado sin tener que
-- refrescar la página.
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;

-- =====================================================================
-- 5) API PÚBLICA — invocada por el organizador (frontend). Las tres
--    funciones son SECURITY DEFINER porque validan ownership de forma
--    explícita (is_event_owner, función ya existente, sin modificar) y
--    no dependen de que RLS por sí sola alcance para razonar sobre el
--    estado del job (igual criterio que claim_guest_identity()).
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

  INSERT INTO public.videos (
    event_id, style, duration_seconds, status, progress_percent,
    requested_by, queued_at
  ) VALUES (
    p_event_id, p_style, p_duration_seconds, 'queued', 0,
    auth.uid(), now()
  ) RETURNING id INTO v_video_id;

  RETURN v_video_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_video_summary(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid;
  v_status public.video_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT event_id, status INTO v_event_id, v_status
    FROM public.videos WHERE id = p_video_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'video job not found';
  END IF;
  IF NOT public.is_event_owner(v_event_id) THEN
    RAISE EXCEPTION 'only the event owner can cancel this job';
  END IF;
  IF v_status NOT IN ('queued', 'processing') THEN
    RAISE EXCEPTION 'only a queued or processing job can be cancelled';
  END IF;

  UPDATE public.videos
    SET status = 'failed', cancelled = true,
        error_message = 'Cancelado por el organizador',
        failed_at = now()
    WHERE id = p_video_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_video_summary(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid;
  v_status public.video_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT event_id, status INTO v_event_id, v_status
    FROM public.videos WHERE id = p_video_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'video job not found';
  END IF;
  IF NOT public.is_event_owner(v_event_id) THEN
    RAISE EXCEPTION 'only the event owner can retry this job';
  END IF;
  IF v_status != 'failed' THEN
    RAISE EXCEPTION 'only a failed job can be retried';
  END IF;

  UPDATE public.videos
    SET status = 'queued', progress_percent = 0, cancelled = false,
        error_message = NULL, storage_path = NULL, video_url = NULL,
        render_job_id = NULL, queued_at = now(), started_at = NULL,
        completed_at = NULL, failed_at = NULL
    WHERE id = p_video_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_video_summary(uuid, text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_video_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retry_video_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_video_summary(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_video_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_video_summary(uuid) TO authenticated;

-- =====================================================================
-- 6) API INTERNA — para el futuro render engine (worker de Remotion) y
--    su webhook de callback. Se ejecuta con la service_role key (ya
--    bypasea RLS y ya tiene GRANT ALL sobre "videos" desde el esquema
--    original) — nunca con la sesión del organizador. Por eso el EXECUTE
--    se revoca explícitamente de anon Y authenticated: ningún cliente
--    del frontend, ni siquiera el propio organizador, puede llamarlas
--    directamente a simular un progreso o una finalización.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.mark_video_processing(p_video_id uuid, p_render_job_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos
    SET status = 'processing', started_at = now(),
        render_job_id = COALESCE(p_render_job_id, render_job_id)
    WHERE id = p_video_id AND status = 'queued';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video job not found or not in queued state';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_video_progress(p_video_id uuid, p_progress_percent int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos
    SET progress_percent = LEAST(GREATEST(p_progress_percent, 0), 100)
    WHERE id = p_video_id AND status = 'processing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video job not found or not in processing state';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_video_completed(p_video_id uuid, p_storage_path text, p_video_url text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos
    SET status = 'completed', progress_percent = 100,
        storage_path = p_storage_path, video_url = p_video_url,
        completed_at = now()
    WHERE id = p_video_id AND status = 'processing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video job not found or not in processing state';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_video_failed(p_video_id uuid, p_error_message text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos
    SET status = 'failed', error_message = p_error_message, failed_at = now()
    WHERE id = p_video_id AND status IN ('queued', 'processing');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video job not found or already finished';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_video_processing(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_video_progress(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_video_completed(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_video_failed(uuid, text) FROM PUBLIC, anon, authenticated;
-- Sin GRANT explícito a service_role: ese rol ya tiene privilegios
-- amplios por defecto sobre el esquema public y bypasea RLS; estas
-- funciones quedan accesibles únicamente a través de él (o del propio
-- dueño de la base), nunca a través de la anon key ni de una sesión de
-- usuario autenticado.

-- =====================================================================
-- Rollback:
--   DROP FUNCTION IF EXISTS public.mark_video_failed(uuid, text);
--   DROP FUNCTION IF EXISTS public.mark_video_completed(uuid, text, text);
--   DROP FUNCTION IF EXISTS public.mark_video_progress(uuid, int);
--   DROP FUNCTION IF EXISTS public.mark_video_processing(uuid, text);
--   DROP FUNCTION IF EXISTS public.retry_video_summary(uuid);
--   DROP FUNCTION IF EXISTS public.cancel_video_summary(uuid);
--   DROP FUNCTION IF EXISTS public.request_video_summary(uuid, text, int);
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.videos;
--   DROP INDEX IF EXISTS public.idx_videos_render_job_id;
--   DROP INDEX IF EXISTS public.idx_videos_queued;
--   ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_duration_check;
--   ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_style_check;
--   ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_progress_percent_check;
--   ALTER TABLE public.videos DROP COLUMN IF EXISTS failed_at, DROP COLUMN IF EXISTS completed_at,
--     DROP COLUMN IF EXISTS started_at, DROP COLUMN IF EXISTS queued_at, DROP COLUMN IF EXISTS requested_by,
--     DROP COLUMN IF EXISTS render_job_id, DROP COLUMN IF EXISTS render_engine, DROP COLUMN IF EXISTS storage_path,
--     DROP COLUMN IF EXISTS cancelled, DROP COLUMN IF EXISTS progress_percent, DROP COLUMN IF EXISTS error_message;
--   ALTER TABLE public.videos ALTER COLUMN status TYPE text USING status::text;
--   ALTER TABLE public.videos ALTER COLUMN status SET DEFAULT 'pending';
--   DROP TYPE IF EXISTS public.video_status;
-- =====================================================================
