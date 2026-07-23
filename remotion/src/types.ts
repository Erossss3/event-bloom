/**
 * Este archivo es el CONTRATO entre Supabase y el proyecto Remotion.
 * "videos.style" (constraint en la base) y "videos.duration_seconds"
 * (constraint en la base) son la única fuente de verdad para estos dos
 * tipos — si alguno cambia acá, tiene que cambiar también la constraint
 * de la migración de "videos".
 */

export type VideoStyleId = "cinematic" | "luxury" | "emotive" | "party";

export type VideoDurationSeconds = 30 | 60 | 90;

export interface GalleryPhotoInput {
  id: string;
  /** URL pública (o firmada) del archivo en el bucket "gallery". */
  url: string;
  kind: "photo" | "video";
  caption?: string | null;
  /** Dimensiones reales del archivo (columnas "width"/"height" de
   * "gallery" en Supabase) — determinan si la foto se recorta a pantalla
   * completa (aspect ratio cercano a 16:9) o se muestra completa con
   * fondo desenfocado detrás (fotos verticales). Sin esto, el recorte
   * inteligente no es posible: se necesita saber el aspect ratio real. */
  width?: number | null;
  height?: number | null;
}

export interface MessageInput {
  id: string;
  authorName: string;
  body: string;
  emoji?: string | null;
  /** Mensajes destacados por el organizador (columna "featured") priorizan su turno en el timeline. */
  featured?: boolean;
}

export interface EventInfo {
  id: string;
  slug: string;
  title: string;
  /** ISO 8601. Puede ser null si el organizador no cargó fecha. */
  eventDate: string | null;
  coverUrl: string | null;
}

/**
 * Props de entrada de la composición <VideoSummary>. Es exactamente lo que
 * `renderer/fetchEventData.ts` arma a partir de Supabase, y exactamente lo
 * que `renderer/renderVideoSummary.ts` valida con `assertVideoSummaryProps`
 * antes de renderizar — ningún otro shape de datos es válido.
 */
export interface VideoSummaryInputProps {
  event: EventInfo;
  style: VideoStyleId;
  durationSeconds: VideoDurationSeconds;
  photos: GalleryPhotoInput[];
  messages: MessageInput[];
  /** Tope explícito de mensajes a incluir, sin importar cuántos mensajes
   * aprobados haya. Si no se pasa, se usa el default del estilo elegido
   * (ver styles/*.ts, StyleConfig.maxMessages). */
  maxMessages?: number;
}
