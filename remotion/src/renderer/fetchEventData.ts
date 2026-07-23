import type { RenderJobInput } from "./types";
import type { VideoSummaryInputProps } from "../types";
import { getSupabaseAdminClient } from "./supabaseAdmin";

/**
 * Arma el input completo de <VideoSummary> a partir de un job en cola.
 * Solo trae contenido con moderation='approved' — el estado de moderación
 * real ya lo garantiza la base (ver
 * supabase/migrations/20260721190000_gallery_messages_enforce_moderation.sql),
 * así que acá no hace falta (ni corresponde) reinterpretar esa regla, solo
 * filtrar por ella.
 */
export async function fetchEventData(job: RenderJobInput): Promise<VideoSummaryInputProps> {
  const supabase = getSupabaseAdminClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, title, starts_at, cover_url")
    .eq("id", job.eventId)
    .single();

  if (eventError || !event) {
    throw new Error(`No se pudo cargar el evento ${job.eventId}: ${eventError?.message ?? "no encontrado"}`);
  }

  const { data: photos, error: photosError } = await supabase
    .from("gallery")
    .select("id, public_url, kind, caption, width, height, created_at")
    .eq("event_id", job.eventId)
    .eq("moderation", "approved")
    .order("created_at", { ascending: true });

  if (photosError) {
    throw new Error(`No se pudo cargar la galería del evento ${job.eventId}: ${photosError.message}`);
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, author_name, body, emoji, featured, created_at")
    .eq("event_id", job.eventId)
    .eq("moderation", "approved")
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new Error(`No se pudieron cargar los mensajes del evento ${job.eventId}: ${messagesError.message}`);
  }

  return {
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      eventDate: event.starts_at,
      coverUrl: event.cover_url,
    },
    style: job.style,
    durationSeconds: job.durationSeconds,
    photos: (photos ?? []).map((p) => ({
      id: p.id,
      url: p.public_url,
      kind: p.kind === "video" ? "video" : "photo",
      caption: p.caption,
      width: p.width,
      height: p.height,
    })),
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      authorName: m.author_name,
      body: m.body,
      emoji: m.emoji,
      featured: m.featured ?? false,
    })),
  };
}
