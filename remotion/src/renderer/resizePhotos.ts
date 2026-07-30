import sharp from "sharp";
import type { GalleryPhotoInput } from "../types";

/**
 * Techo de resolución para las fotos que entran al render. La composición
 * está en 1280x720 (bajada de 1080p por el límite de 1GB de RAM del plan
 * de Railway — ver Root.tsx) y el Ken Burns más agresivo de los 4 estilos
 * llega a un zoom de 1.28x (ver styles/party.ts) — 1650px de lado mayor
 * cubre ese zoom con margen sin pixelar. Si en algún momento se vuelve a
 * 1920x1080 (más RAM disponible), este valor tiene que subir a 2500.
 */
const MAX_DIMENSION = 1650;
const JPEG_QUALITY = 82;

/** Cuántas fotos se descargan/redimensionan en paralelo. No tiene que ver
 * con la concurrencia del render (esa sigue en 1) — esto corre ANTES de
 * abrir Chrome, así que un valor moderado acá no compite por la misma
 * memoria que preocupa en renderVideoSummary.ts. */
const RESIZE_CONCURRENCY = 4;

async function resizeOnePhoto(photo: GalleryPhotoInput): Promise<GalleryPhotoInput> {
  if (photo.kind !== "photo") {
    // Los clips de video (kind: "video") van por OffthreadVideo, no por acá
    // — achicarlos requiere re-codificar el video en sí (ffmpeg), no un
    // resize de imagen. Si un evento tiene clips muy pesados, es el
    // siguiente lugar para mirar; queda fuera de este cambio a propósito.
    return photo;
  }

  try {
    const response = await fetch(photo.url);
    if (!response.ok) {
      throw new Error(`fetch respondió ${response.status}`);
    }
    const originalBuffer = Buffer.from(await response.arrayBuffer());

    const resizedBuffer = await sharp(originalBuffer)
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;
    return { ...photo, url: dataUrl };
  } catch (err) {
    // Una foto que no se pudo descargar/redimensionar no puede tirar abajo
    // el render entero: se cae al comportamiento anterior (URL original).
    // KenBurnsImage ya maneja por su cuenta si esa URL también falla al
    // cargar en el browser (onError -> se oculta esa foto).
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[remotion] no se pudo redimensionar la foto ${photo.id}, se usa el original: ${message}`);
    return photo;
  }
}

/**
 * Redimensiona todas las fotos de un job en paralelo, con un techo de
 * concurrencia, y devuelve un nuevo array (no muta el input) con las URLs
 * ya convertidas a data URIs livianos. Se llama una vez por job, ANTES de
 * renderVideoSummary() — así Chrome nunca llega a ver una URL de foto en
 * resolución original.
 */
export async function resizeGalleryPhotos(photos: GalleryPhotoInput[]): Promise<GalleryPhotoInput[]> {
  const results: GalleryPhotoInput[] = new Array(photos.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= photos.length) return;
      results[index] = await resizeOnePhoto(photos[index]);
    }
  }

  const workers = Array.from({ length: Math.min(RESIZE_CONCURRENCY, photos.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
