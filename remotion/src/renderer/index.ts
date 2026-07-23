import { unlink } from "node:fs/promises";
import type { RenderJobInput, RenderJobResult } from "./types";
import { fetchEventData } from "./fetchEventData";
import { renderVideoSummary } from "./renderVideoSummary";
import { uploadRenderedVideo } from "./uploadToSupabase";
import { getSupabaseAdminClient } from "./supabaseAdmin";
import { runWithHeartbeat } from "./heartbeatTicker";

const HEARTBEAT_INTERVAL_MS = 10_000;

const NO_LONGER_CLAIMABLE_MARKERS = ["not in processing state", "already finished"];

function looksLikeRowNoLongerClaimable(errorMessage: string | undefined): boolean {
  if (!errorMessage) return false;
  return NO_LONGER_CLAIMABLE_MARKERS.some((marker) => errorMessage.includes(marker));
}

/**
 * Procesa UN job. Requisitos de la auditoría del worker que esta versión
 * corrige:
 *
 * 1) VALIDACIÓN DE ESTADO: antes de tocar fetchEventData() o renderizar
 *    una sola imagen, confirma con una lectura directa que el job
 *    efectivamente está en 'processing'. Si no lo está (llamada indebida
 *    sin pasar por claimNextVideoJob(), o el job ya fue reclamado/
 *    reapeado/cancelado por otra vía), termina de inmediato: no
 *    renderiza, no gasta CPU, y no llama a ningún mark_video_* — no es
 *    dueño de ese job, no le corresponde escribir su estado.
 *
 * 2) LIMPIEZA DE TEMPORALES: renderVideoSummary() ahora expone
 *    "outputPath" de forma síncrona (antes de que el render siquiera
 *    empiece), así que el "finally" de acá abajo puede borrar el archivo
 *    sin importar en qué punto haya fallado el render.
 *
 * 3) CANCELACIÓN: sin ningún setTimeout propio. Cada tick de progreso que
 *    reporta Remotion (onProgress) intenta, como mucho cada
 *    HEARTBEAT_INTERVAL_MS, un mark_video_heartbeat() — que cumple DOS
 *    roles a la vez: le avisa a reap_stale_video_jobs() que este worker
 *    sigue vivo, Y si esa llamada falla porque la fila ya no está en
 *    'processing' (cancelada), dispara cancel() ahí mismo, en el próximo
 *    evento de progreso real de Remotion — no hay ninguna espera
 *    artificial esperando a que un timer disponible dispare, y nada que
 *    limpiar al terminar un render exitoso.
 *
 * Contrato de estados con la base (ver
 * supabase/migrations/20260721220000_video_summary_architecture.sql,
 * 20260721230000_video_summary_fixes.sql,
 * 20260722100000_video_worker_claim.sql y
 * 20260722110000_video_worker_heartbeat.sql):
 *   processing --[mark_video_heartbeat]--> processing (heartbeat_at)
 *   processing --[mark_video_completed]--> completed
 *   processing --[mark_video_failed]--> failed
 */
export async function processVideoJob(job: RenderJobInput): Promise<RenderJobResult> {
  const supabase = getSupabaseAdminClient();

  // --- Paso 1: validar que el job realmente está en 'processing' -------
  const { data: currentRow, error: readError } = await supabase
    .from("videos")
    .select("status")
    .eq("id", job.videoId)
    .single();

  if (readError || !currentRow) {
    return { ok: false, errorMessage: `No se pudo leer el job ${job.videoId}: ${readError?.message ?? "no encontrado"}` };
  }
  if (currentRow.status !== "processing") {
    // No es un error del job: es un uso indebido de processVideoJob() (se
    // lo llamó sin pasar por claimNextVideoJob()) o el job cambió de
    // estado por otra vía (cancelado, reapeado) antes de llegar acá. No
    // se toca la fila: no es nuestra.
    return {
      ok: false,
      errorMessage: `El job ${job.videoId} no está en estado 'processing' (está en '${currentRow.status}') — no se reclama ni se renderiza.`,
    };
  }

  console.log(`[video-worker] job ${job.videoId}: validado en 'processing', estilo=${job.style}, duración=${job.durationSeconds}s`);

    // --- Paso 2: renderizar, con heartbeat + cancelación inmediata --------
    let outputPath: string | undefined;

    try {
      // Primer heartbeat inmediato:
      // evita que fetchEventData/render inicial maten el job por timeout.
      const { error: heartbeatError } = await supabase.rpc("mark_video_heartbeat", {
        p_video_id: job.videoId,
      });

      if (heartbeatError) {
        throw new Error(`Heartbeat inicial falló: ${heartbeatError.message}`);
      }
      console.log(`[video-worker] job ${job.videoId}: heartbeat inicial ok`);

      const inputProps = await fetchEventData(job);
      console.log(
        `[video-worker] job ${job.videoId}: datos del evento cargados (${inputProps.photos.length} fotos, ${inputProps.messages.length} mensajes)`,
      );

    let lastHeartbeatAt = 0;
    const handle = renderVideoSummary(job.videoId, inputProps, (progress) => {
      const now = Date.now();
      if (now - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) return;
      lastHeartbeatAt = now;

      supabase.rpc("mark_video_heartbeat", { p_video_id: job.videoId }).then(({ error }) => {
        if (error) {
          // El job ya no está en 'processing' (cancelado, o reapeado por
          // otro worker) — cortar el render ahí mismo, en respuesta al
          // próximo evento de progreso real, sin timers propios.
          console.log(`[video-worker] job ${job.videoId}: heartbeat rechazado durante el render (${error.message}) — cancelando`);
          handle.cancel();
        }
      });

      supabase.rpc("mark_video_progress", { p_video_id: job.videoId, p_progress_percent: progress }).then(
        () => {
          // Reportar el porcentaje es best-effort — el heartbeat de arriba
          // es el que realmente decide si el render sigue o se corta.
        },
        () => {
          // Ídem si la propia llamada rechaza (no solo si devuelve error):
          // no debe interrumpir el render.
        },
      );
    });

    outputPath = handle.outputPath;
    console.log(`[video-worker] job ${job.videoId}: render iniciado, archivo temporal ${outputPath}`);

    await handle.result;
    console.log(`[video-worker] job ${job.videoId}: render terminado, subiendo a Storage...`);

    // Fix de causa raíz: sin runWithHeartbeat() acá, el job pasaba minutos
    // en 'processing' sin ningún heartbeat mientras se subía el archivo —
    // exactamente la ventana que hacía que reap_stale_video_jobs() lo
    // matara aunque el worker siguiera vivo y la subida progresando.
    const { storagePath, videoUrl } = await runWithHeartbeat(job.videoId, () =>
      uploadRenderedVideo(job.eventId, job.videoId, outputPath!),
    );
    console.log(`[video-worker] job ${job.videoId}: subida completa -> ${storagePath}`);

    const { error: completeError } = await supabase.rpc("mark_video_completed", {
      p_video_id: job.videoId,
      p_storage_path: storagePath,
      p_video_url: videoUrl,
    });

    if (completeError) {
      if (looksLikeRowNoLongerClaimable(completeError.message)) {
        // El job fue cancelado (o reapeado) justo antes de que
        // termináramos de subir el archivo — el estado en la base ya es
        // correcto, no hay nada más que reportar como error nuevo.
        console.log(`[video-worker] job ${job.videoId}: cancelado/reapeado justo antes de mark_video_completed`);
        return { ok: false, errorMessage: "cancelled" };
      }
      throw new Error(`mark_video_completed falló: ${completeError.message}`);
    }

    console.log(`[video-worker] job ${job.videoId}: completed`);
    return { ok: true, storagePath, videoUrl };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido durante el render";
    console.error(`[video-worker] job ${job.videoId}: FALLÓ — ${errorMessage}`);

    const { error: failError } = await supabase.rpc("mark_video_failed", {
      p_video_id: job.videoId,
      p_error_message: errorMessage,
    });
    if (failError && !looksLikeRowNoLongerClaimable(failError.message)) {
      // Si ni siquiera se pudo dejar constancia del fallo (y no es porque
      // ya estaba cancelado/reapeado), es un problema de conectividad con
      // Supabase en sí — se relanza para que el worker lo loguee como un
      // error de infraestructura, no como un fallo silencioso del job.
      throw failError;
    }

    return { ok: false, errorMessage };
  } finally {
    if (outputPath) {
      await unlink(outputPath).catch(() => {});
      console.log(`[video-worker] job ${job.videoId}: archivo temporal ${outputPath} eliminado`);
    }
  }
}

export type { RenderJobInput, RenderJobResult } from "./types";
