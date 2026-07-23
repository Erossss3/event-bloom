import { readFile } from "node:fs/promises";
import { getSupabaseAdminClient } from "./supabaseAdmin";

const EXPORTS_BUCKET = "exports";

/** Mismo bucket, mismo esquema de paths ({event_id}/...) que ya usan las
 * policies de Storage de "exports" (owner upload/delete por event_id vía
 * storage.foldername(name)[1] = is_event_owner) — el archivo final del
 * render encaja en la convención existente sin necesitar ninguna policy
 * nueva. service_role bypasea esas policies igual, pero se respeta el path
 * para que el organizador pueda administrar sus propios exports por igual
 * si alguna vez lo necesita manualmente. */
function buildStoragePath(eventId: string, videoId: string) {
  return `${eventId}/${videoId}.mp4`;
}

export interface UploadResult {
  storagePath: string;
  /** Signed URL de larga duración — el mismo criterio que ya usa
   * src/lib/storage.ts (signedUrl()) del lado de la app para "covers". El
   * frontend igual puede regenerar una nueva bajo demanda con
   * supabase.storage.from("exports").createSignedUrl(); esta se guarda en
   * "videos.video_url" como valor inicial. */
  videoUrl: string;
}

export async function uploadRenderedVideo(
  eventId: string,
  videoId: string,
  localFilePath: string,
): Promise<UploadResult> {
  const supabase = getSupabaseAdminClient();
  const storagePath = buildStoragePath(eventId, videoId);
  const fileBuffer = await readFile(localFilePath);

  const { error: uploadError } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: "video/mp4", upsert: true });

  if (uploadError) {
    throw new Error(`No se pudo subir el video renderizado a "${EXPORTS_BUCKET}/${storagePath}": ${uploadError.message}`);
  }

  const oneYearInSeconds = 60 * 60 * 24 * 365;
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(storagePath, oneYearInSeconds);

  if (signedUrlError || !signedUrlData) {
    throw new Error(`El video se subió pero no se pudo firmar la URL: ${signedUrlError?.message}`);
  }

  return { storagePath, videoUrl: signedUrlData.signedUrl };
}
