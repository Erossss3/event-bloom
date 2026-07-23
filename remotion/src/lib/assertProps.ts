import { z } from "zod";

export const videoStyleSchema = z.enum(["cinematic", "luxury", "emotive", "party"]);

export const galleryPhotoSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  kind: z.enum(["photo", "video"]),
  caption: z.string().nullable().optional(),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
});

export const messageSchema = z.object({
  id: z.string().min(1),
  authorName: z.string().min(1),
  body: z.string().min(1),
  emoji: z.string().nullable().optional(),
  featured: z.boolean().optional(),
});

export const eventInfoSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  eventDate: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
});

export const videoSummaryInputPropsSchema = z.object({
  event: eventInfoSchema,
  style: videoStyleSchema,
  durationSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  photos: z.array(galleryPhotoSchema).min(1, "El evento necesita al menos una foto aprobada para generar un resumen."),
  messages: z.array(messageSchema),
  maxMessages: z.number().int().nonnegative().optional(),
});

/**
 * Se llama tanto desde el Root de Remotion (para no crashear el Studio con
 * props mal formadas) como desde renderer/renderVideoSummary.ts (para no
 * lanzar un render costoso con datos que ya sabemos que están mal armados).
 * Nunca se confía en el input crudo que llega desde Supabase sin pasar por acá.
 */
export function assertVideoSummaryProps(value: unknown) {
  return videoSummaryInputPropsSchema.parse(value);
}
