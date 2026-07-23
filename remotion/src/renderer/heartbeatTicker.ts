import { getSupabaseAdminClient } from "./supabaseAdmin";

const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * CORRIGE LA CAUSA RAÍZ del hallazgo "el job queda colgado en processing y
 * el reaper lo marca failed": entre el último tick de progreso de
 * renderMedia() (que ya manda heartbeat vía onProgress, ver
 * renderer/index.ts) y la llamada a mark_video_completed(), la subida a
 * Storage (uploadRenderedVideo) podía tardar más que
 * reap_stale_video_jobs() (default 90s, ver
 * supabase/migrations/20260722110000_video_worker_heartbeat.sql) SIN
 * mandar ningún heartbeat — el SDK de Storage de supabase-js no expone
 * progreso de subida, así que no hay ningún evento real al que engancharlo
 * como se hace durante el render. Un archivo de varios cientos de MB
 * (límite real del bucket "exports", ver
 * supabase/migrations/20260722130000_storage_bucket_limits.sql) tarda,
 * en la práctica, bastante más que 90s en subir — por eso el job se
 * reapeaba con el render ya terminado con éxito.
 *
 * runWithHeartbeat() manda un heartbeat inmediato al entrar (cubre el
 * hueco entre el último heartbeat del render y el primer tick del timer)
 * y uno cada HEARTBEAT_INTERVAL_MS mientras la tarea esté en vuelo,
 * deteniéndose sola (éxito o error) — no reemplaza el mecanismo dirigido
 * por progreso real del render (que es estrictamente mejor cuando existe:
 * un heartbeat por timer ciego no puede distinguir "la subida avanza" de
 * "la conexión se colgó", cosa que si podía discriminar el heartbeat
 * dirigido por onProgress de Remotion), solo cubre la fase en la que no
 * existe ninguna señal de progreso real a la que engancharse.
 */
export async function runWithHeartbeat<T>(videoId: string, task: () => Promise<T>): Promise<T> {
  const supabase = getSupabaseAdminClient();

  const beat = () => {
    supabase.rpc("mark_video_heartbeat", { p_video_id: videoId }).then(({ error }) => {
      if (error) {
        console.error(`[video-worker] heartbeat falló durante una operación en curso del job ${videoId}: ${error.message}`);
      }
    });
  };

  beat();
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}
