import type { VideoStyleId, VideoDurationSeconds } from "../types";

/**
 * Lo mínimo que el futuro worker necesita saber para procesar un job de
 * "videos" — corresponde 1 a 1 con las columnas de la tabla que ya importan
 * para el render (ver supabase/migrations/20260721220000_video_summary_architecture.sql).
 * El worker arma esto a partir de una fila con status='queued', típicamente
 * leída con el mismo shape que devuelve idx_videos_queued.
 */
export interface RenderJobInput {
  videoId: string;
  eventId: string;
  style: VideoStyleId;
  durationSeconds: VideoDurationSeconds;
}

export type RenderJobResult =
  | { ok: true; storagePath: string; videoUrl: string }
  | { ok: false; errorMessage: string };
