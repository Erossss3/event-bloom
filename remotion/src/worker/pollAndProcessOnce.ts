import type { RenderJobResult } from "../renderer/types";
import { processVideoJob } from "../renderer";
import { claimNextVideoJob } from "./claimNextJob";
import { getSupabaseAdminClient } from "../renderer/supabaseAdmin";

export interface PollOnceOptions {
  /** Antes de intentar reclamar un job nuevo, libera jobs 'processing'
   * abandonados por un worker que murió a mitad de un render. Se puede
   * desactivar (por ejemplo, para no pagar esa consulta extra en cada
   * invocación de una Lambda de alta frecuencia) — igual algún invocador
   * del sistema debe correrlo con cierta regularidad. Default: true. */
  reapStaleJobs?: boolean;
  /** Cuánto tiempo (segundos) sin heartbeat antes de considerar un job
   * 'processing' abandonado (ver mark_video_heartbeat() y
   * reap_stale_video_jobs() en
   * supabase/migrations/20260722110000_video_worker_heartbeat.sql). Ya
   * NO está atado a "cuánto puede durar un render" (eso podía disparar
   * falsos positivos en renders legítimamente largos) sino a "cuántos
   * heartbeats seguidos se pueden perder antes de asumir que el worker
   * murió" — el worker manda uno cada ~10s (ver
   * renderer/index.ts:HEARTBEAT_INTERVAL_MS) mientras el render esté
   * activo, sin importar cuánto tarde. Default: 90 (9x ese intervalo). */
  staleTimeoutSeconds?: number;
}

export type PollOnceResult =
  | { claimed: false }
  | { claimed: true; videoId: string; result: RenderJobResult };

/**
 * Esta es LA función que cualquier infraestructura (proceso Node en loop,
 * Docker/ECS/Railway/Render/Fly.io corriendo runWorker(), una Edge Function
 * disparada por cron, o un handler de AWS Lambda) puede invocar sin saber
 * nada de cómo se despliega el resto. No asume un loop propio, no asume
 * que va a volver a ser llamada — hace UNA unidad de trabajo y termina.
 */
export async function pollAndProcessOnce(options: PollOnceOptions = {}): Promise<PollOnceResult> {
  const { reapStaleJobs = true, staleTimeoutSeconds = 90 } = options;

  if (reapStaleJobs) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.rpc("reap_stale_video_jobs", { p_timeout_seconds: staleTimeoutSeconds });
    if (error) {
      // No detiene el ciclo: un fallo puntual reclamando jobs viejos no
      // debería impedir procesar el job nuevo de esta misma invocación.
      console.error("[video-worker] reap_stale_video_jobs falló:", error.message);
    }
  }

  const job = await claimNextVideoJob();
  if (!job) {
    return { claimed: false };
  }

  const result = await processVideoJob(job);
  return { claimed: true, videoId: job.videoId, result };
}
