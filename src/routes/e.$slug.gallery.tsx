import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getGuest } from "@/lib/guest-identity";
import { uploadToBucket } from "@/lib/storage";
import { Camera, Heart, Upload } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getRouteApi } from "@tanstack/react-router";

const layoutApi = getRouteApi("/e/$slug");

interface Item { id: string; public_url: string; kind: string; }

const MAX_PHOTO_SIZE_MB = 20;
const MAX_VIDEO_SIZE_MB = 300;
const MAX_FILES_PER_UPLOAD = 20;

export const Route = createFileRoute("/e/$slug/gallery")({
  component: GalleryPage,
});

function GalleryPage() {
  useParams({ from: "/e/$slug/gallery" });
  const { event } = layoutApi.useLoaderData();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // allow_guest_uploads existe en event_settings (default true) — no se leía
  // en ningún lugar del frontend hasta esta corrección. Solo afecta la
  // posibilidad de subir contenido nuevo; ver la galería sigue disponible.
  const { data: settings } = useQuery({
    queryKey: ["event-settings-public", event.id, "allow_guest_uploads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_settings")
        .select("allow_guest_uploads")
        .eq("event_id", event.id)
        .maybeSingle();
      return data;
    },
  });
  const uploadsEnabled = (settings?.allow_guest_uploads ?? true) && event.status !== "finished";

  async function load() {
    const { data } = await supabase.from("gallery")
      .select("id, public_url, kind")
      .eq("event_id", event.id).eq("moderation", "approved")
      .order("created_at", { ascending: false }).limit(200);
    setItems((data as Item[]) ?? []);
    setLoaded(true);
  }
  useEffect(() => { load(); }, [event.id]);

  useEffect(() => {
    const ch = supabase.channel(`gallery-${event.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gallery", filter: `event_id=eq.${event.id}` },
        (p) => { const n = p.new as Item & { moderation: string };
          if (n.moderation === "approved") setItems((prev) => [n, ...prev]);
        }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [event.id]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!uploadsEnabled) { toast.error("La carga de fotos está cerrada para este evento."); return; }

    const list = Array.from(files);

    if (list.length > MAX_FILES_PER_UPLOAD) {
      toast.error(`Podés subir hasta ${MAX_FILES_PER_UPLOAD} archivos por vez.`);
      return;
    }

    const valid: File[] = [];
    for (const file of list) {
      const isVideo = file.type.startsWith("video/");
      const isPhoto = file.type.startsWith("image/");
      if (!isVideo && !isPhoto) {
        toast.error(`"${file.name}" no es una foto ni un video.`);
        continue;
      }
      const maxMb = isVideo ? MAX_VIDEO_SIZE_MB : MAX_PHOTO_SIZE_MB;
      if (file.size > maxMb * 1024 * 1024) {
        toast.error(`"${file.name}" pesa demasiado (máximo ${maxMb} MB).`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    const guest = getGuest(event.id);
    setUploading(true);
    setProgress(0);
    const total = valid.length;
    let done = 0;
    let succeeded = 0;
    for (const file of valid) {
      try {
        const isVideo = file.type.startsWith("video/");
        const kind = isVideo ? "video" : "photo";
        const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
        const path = `${event.id}/${crypto.randomUUID()}.${ext}`;
        const { url } = await uploadToBucket("gallery", path, file);
        await supabase.from("gallery").insert({
          event_id: event.id, guest_id: guest?.guestId ?? null,
          kind, storage_path: path, public_url: url,
        });
        succeeded++;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al subir");
      } finally {
        done++;
        setProgress(Math.round((done / total) * 100));
      }
    }
    if (succeeded > 0) {
      toast.success(`${succeeded} archivo${succeeded !== 1 ? "s" : ""} subido${succeeded !== 1 ? "s" : ""}`);
    }
    setUploading(false);
    load();
  }

  async function react(galleryId: string) {
    const g = getGuest(event.id);
    await supabase.from("gallery_reactions").insert({
      gallery_id: galleryId, guest_id: g?.guestId ?? null, emoji: "❤️",
    });
    toast.success("¡Reacción enviada!");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Galería colaborativa</h2>
            <p className="text-sm text-muted-foreground">Compartí las fotos y videos del evento.</p>
          </div>
          {uploadsEnabled ? (
            <label className="peer-focus-visible:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-gold px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={uploading}>
              <Upload className="h-4 w-4" /> {uploading ? `Subiendo ${progress}%` : "Subir fotos / videos"}
              <input type="file" multiple accept="image/*,video/*" className="peer sr-only" onChange={(e) => onFiles(e.target.files)} disabled={uploading} />
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">
              {event.status === "finished" ? "El evento finalizó — la carga de fotos está cerrada." : "La carga de fotos está cerrada para este evento."}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Al subir contenido confirmás que sos su autor/a o que contás con autorización para compartirlo. Ver{" "}
          <Link to="/legal/terminos" className="underline underline-offset-2">Términos y Condiciones</Link>.
        </p>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border bg-cream/40 px-10 py-16 text-center">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gold/10" />
            <Camera className="h-9 w-9 text-gold/70" />
            <Heart className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 text-gold shadow-soft" />
          </div>
          <p className="mt-6 font-display text-2xl">Sé el primero en compartir</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Aún no hay fotos en la galería. Las tuyas pueden ser las primeras.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it, i) => (
            <motion.div key={it.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (i % 12) * 0.02 }}
              className="group relative overflow-hidden rounded-xl border bg-muted">
              {it.kind === "video"
                ? <video src={it.public_url} controls preload="metadata" playsInline className="aspect-square w-full object-cover" />
                : <img src={it.public_url} loading="lazy" className="aspect-square w-full object-cover" alt="" />}
              <button
                onClick={() => react(it.id)}
                aria-label="Reaccionar con un corazón"
                className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 text-white backdrop-blur opacity-100 transition md:opacity-0 md:group-hover:opacity-100"
              >
                <Heart className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
