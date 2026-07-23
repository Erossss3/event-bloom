import type { GalleryPhotoInput } from "../types";

const COMPOSITION_ASPECT_RATIO = 1920 / 1080; // 16:9

/**
 * Si la foto no tiene dimensiones conocidas (columnas "width"/"height" de
 * "gallery" pueden ser NULL — por ejemplo, fotos subidas antes de que el
 * pipeline las calculara), se asume que necesita el tratamiento más
 * seguro: "contain" + fondo desenfocado. Es la opción que nunca recorta
 * de más, aunque la foto termine siendo horizontal.
 */
export function getFitMode(photo: Pick<GalleryPhotoInput, "width" | "height">): "cover" | "contain" {
  if (!photo.width || !photo.height) return "contain";

  const photoAspectRatio = photo.width / photo.height;
  const relativeDifference = Math.abs(photoAspectRatio - COMPOSITION_ASPECT_RATIO) / COMPOSITION_ASPECT_RATIO;

  // Dentro del 20% de diferencia respecto a 16:9 (aprox. entre 4:3 apaisada
  // y ultra-panorámica), se recorta a pantalla completa sin dejar
  // gutters — no hace falta mostrar el fondo desenfocado si casi no hay
  // espacio vacío que tapar. Fuera de ese rango (fotos verticales, la
  // gran mayoría de las que suben los invitados desde el celular), se
  // conserva la foto completa y el espacio sobrante lo llena el fondo
  // desenfocado (BackgroundBlur).
  return relativeDifference <= 0.2 ? "cover" : "contain";
}
