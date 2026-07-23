-- =====================================================================
-- VIDEO SUMMARY — limpieza: eliminar código muerto real
-- =====================================================================
-- mark_video_processing(uuid, text) fue creada en
-- 20260721220000_video_summary_architecture.sql pensando en un modelo
-- donde el worker la llamaba para pasar un job de 'queued' a
-- 'processing'. Desde 20260722100000_video_worker_claim.sql, esa
-- transición la hace claim_next_video_job() (con FOR UPDATE SKIP LOCKED,
-- necesario para múltiples workers) — desde entonces, verificado por
-- grep exhaustivo en todo remotion/src/, ningún archivo del worker ni del
-- renderer vuelve a llamarla. Es código muerto real: existe, tiene
-- permisos otorgados a service_role, pero nada la invoca. Se elimina en
-- vez de dejarla "por si acaso" — no hay ningún plan concreto que la
-- necesite, y mantener funciones sin uso es exactamente la clase de
-- deuda que esta limpieza busca sacar.
-- =====================================================================

DROP FUNCTION IF EXISTS public.mark_video_processing(uuid, text);

-- =====================================================================
-- Rollback: restaurar la función desde 20260721220000_video_summary_architecture.sql
-- (CREATE OR REPLACE FUNCTION public.mark_video_processing(p_video_id uuid, p_render_job_id text DEFAULT NULL) ...)
-- =====================================================================
