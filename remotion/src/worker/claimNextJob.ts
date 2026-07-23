import type { RenderJobInput } from "../renderer/types";
import type { VideoStyleId, VideoDurationSeconds } from "../types";
import { getSupabaseAdminClient } from "../renderer/supabaseAdmin";

/** Forma exacta de la fila que devuelve claim_next_video_job() (ver
 * supabase/migrations/20260722100000_video_worker_claim.sql). El cliente
 * admin (supabaseAdmin.ts) se crea sin el genérico "Database" — por eso
 * ".rpc()" no tiene de por sí ningún tipo de retorno conocido para esta
 * función y hace falta declararlo acá explícitamente en vez de asumirlo. */
interface ClaimNextVideoJobRow {
  id: string;
  event_id: string;
  style: string;
  duration_seconds: number | null;
}

/**
 * Intenta reclamar el próximo job en cola. Es la ÚNICA forma correcta de
 * obtener un job para procesar — nunca hacer un SELECT propio de "videos"
 * y asumir que ya es tuyo: eso es exactamente la condición de carrera que
 * esto reemplaza. claim_next_video_job() hace SELECT + FOR UPDATE SKIP
 * LOCKED + UPDATE a 'processing' en una sola transacción del lado de
 * Postgres — dos workers llamando esto al mismo tiempo nunca pueden
 * recibir el mismo job.
 *
 * Devuelve null si no hay ningún job en 'queued' (cola vacía) — un worker
 * debe tratar esto como el caso normal de "no hay trabajo ahora", no como
 * un error.
 */
export async function claimNextVideoJob(): Promise<RenderJobInput | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = (await supabase.rpc("claim_next_video_job").maybeSingle()) as {
    data: ClaimNextVideoJobRow | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`claim_next_video_job() falló: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  return {
    videoId: data.id,
    eventId: data.event_id,
    style: data.style as VideoStyleId,
    durationSeconds: data.duration_seconds as VideoDurationSeconds,
  };
}
