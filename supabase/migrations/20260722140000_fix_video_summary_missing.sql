-- ==========================================================
-- Fix Video Summary architecture
-- Adds missing columns and request RPC
-- ==========================================================


ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0;

ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS storage_path text;



CREATE OR REPLACE FUNCTION public.request_video_summary(
  p_event_id uuid,
  p_style text,
  p_duration_seconds integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_video_id uuid;
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = p_event_id
  ) THEN
    RAISE EXCEPTION 'event not found';
  END IF;


  INSERT INTO public.videos(
    event_id,
    style,
    format,
    status,
    duration_seconds,
    progress_percent
  )
  VALUES(
    p_event_id,
    p_style,
    'summary',
    'pending',
    p_duration_seconds,
    0
  )
  RETURNING id INTO v_video_id;


  RETURN v_video_id;

END;
$$;


GRANT EXECUTE ON FUNCTION public.request_video_summary(
  uuid,
  text,
  integer
)
TO authenticated;