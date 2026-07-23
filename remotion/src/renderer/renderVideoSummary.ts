import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, makeCancelSignal } from "@remotion/renderer";
import { assertVideoSummaryProps } from "../lib/assertProps";
import type { VideoSummaryInputProps } from "../types";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ENTRY_POINT = path.join(CURRENT_DIR, "..", "index.ts");
const COMPOSITION_ID = "VideoSummary";

let cachedBundleUrl: string | null = null;

/**
 * El bundle de Remotion (webpack de la composición) es costoso de generar
 * pero es el mismo para cualquier job — se arma una sola vez por proceso del
 * worker y se reutiliza entre renders sucesivos, en vez de rebundlear en
 * cada llamada.
 */
async function getBundleUrl(): Promise<string> {
  if (cachedBundleUrl) {
    console.log("[remotion] usando bundle cacheado");
    return cachedBundleUrl;
  }

  console.log("[remotion] creando bundle...");
  cachedBundleUrl = await bundle({ entryPoint: ENTRY_POINT });
  console.log("[remotion] bundle creado:", cachedBundleUrl);

  return cachedBundleUrl;
}

/** Ruta determinística — se puede calcular ANTES de arrancar el render,
 * sin depender de que este resuelva. Corrige el hallazgo de la auditoría:
 * antes, processVideoJob() solo se enteraba de esta ruta cuando la
 * promesa del render resolvía con éxito, así que si el render fallaba a
 * mitad de camino, cualquier archivo parcial que Remotion hubiera
 * llegado a escribir quedaba sin borrar — nadie conocía su ubicación. */
function computeOutputPath(videoId: string): string {
  return path.join(os.tmpdir(), `livemoments-video-summary-${videoId}.mp4`);
}

export interface RenderResult {
  outputPath: string;
}

export interface RenderHandle {
  /** Disponible de inmediato, sin esperar a que el render termine (ni
   * éxitosa ni fallidamente) — es lo que permite a processVideoJob()
   * borrar el archivo temporal SIEMPRE, incluso si el render nunca llega
   * a producirlo o falla a mitad de camino. */
  outputPath: string;
  result: Promise<RenderResult>;
  /** Aborta el render en curso — processVideoJob() la llama en cuanto
   * mark_video_heartbeat() le confirma que el job ya no está en
   * 'processing' (cancelado, o reclamado por el reaper). */
  cancel: () => void;
}

/**
 * Renderiza el .mp4 real a un archivo temporal. No sube nada a Supabase —
 * esa es responsabilidad de uploadToSupabase.ts, deliberadamente separada:
 * este módulo no sabe nada de Supabase, y fetchEventData.ts no sabe nada de
 * Remotion. renderer/index.ts es el único que conoce a los tres.
 */
export function renderVideoSummary(
  videoId: string,
  inputProps: VideoSummaryInputProps,
  onProgress?: (progress: number) => void,
): RenderHandle {
  const { cancelSignal, cancel } = makeCancelSignal();
  const outputPath = computeOutputPath(videoId);

  const result = (async (): Promise<RenderResult> => {
    const validatedProps = assertVideoSummaryProps(inputProps);
    const bundleUrl = await getBundleUrl();

    // selectComposition() devuelve el VideoConfig directamente (no un
    // objeto envuelto con clave "composition") en la versión de
    // @remotion/renderer fijada en package.json (^4.0.0) — desestructurar
    // "{ composition }" dejaba esa variable en undefined y renderMedia()
    // recibía composition: undefined.
    console.log("[remotion] seleccionando composición...");
    const composition = await selectComposition({
      serveUrl: bundleUrl,
      id: COMPOSITION_ID,
      inputProps: validatedProps,
    });
    console.log("[remotion] composición lista:", composition.id);

    console.log("[remotion] iniciando render:", outputPath);
    await renderMedia({
      composition,
      serveUrl: bundleUrl,
      codec: "h264",
      concurrency: 1,
      outputLocation: outputPath,
      inputProps: validatedProps,
      cancelSignal,
      onProgress: onProgress
        ? ({ progress }) => {
            const percent = Math.round(progress * 100);
            console.log("[remotion] progreso:", percent + "%");
            onProgress(percent);
          }
        : undefined,
    });

    return { outputPath };
  })();

  return { outputPath, result, cancel };
}
