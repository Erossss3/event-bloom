import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGuest } from "@/lib/guest-identity";
import { uploadToBucket } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Camera, Heart, Upload } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getRouteApi } from "@tanstack/react-router";

const layoutApi = getRouteApi("/e/$slug");

interface Item { id: string; public_url: string; kind: string; caption: string | null; created_at: string; }

export const Route = createFileRoute("/e/$slug/gallery")({
  component: GalleryPage,
});

function GalleryPage() {
  useParams({ from: "/e/$slug/gallery" });
  const { event } = layoutApi.useLoaderData();
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function load() {
    const { data } = await supabase.from("gallery")
      .select("id, public_url, kind, caption, created_at")
      .eq("event_id", event.id).eq("moderation", "approved")
      .order("created_at", { ascending: false }).limit(200);
    setItems((data as Item[]) ?? []);
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
    if (event.status === "finished") { toast.error("El evento fue finalizado. Las cargas están cerradas."); return; }
    const guest = getGuest(event.id);
    setUploading(true);
    setProgress(0);
    const total = files.length;
    let done = 0;
    for (const file of Array.from(files)) {
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al subir");
      } finally {
        done++;
        setProgress(Math.round((done / total) * 100));
      }
    }
    toast.success(`${done} archivo${done !== 1 ? "s" : ""} subido${done !== 1 ? "s" : ""}`);
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
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Galería colaborativa</h2>
            <p className="text-sm text-muted-foreground">Compartí las fotos y videos del evento.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-gold px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg aria-disabled:pointer-events-none aria-disabled:opacity-70" aria-disabled={uploading}>
            <Upload className="h-4 w-4" /> {uploading ? `Subiendo ${progress}%` : "Subir fotos / videos"}
            <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => onFiles(e.target.files)} disabled={uploading} />
          </label>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-cream/40 p-12 text-center">
          <Camera className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-display text-2xl">Sé el primero en compartir</p>
          <p className="mt-2 text-sm text-muted-foreground">Aún no hay fotos en la galería.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it, i) => (
            <motion.div key={it.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (i % 12) * 0.02 }}
              className="group relative overflow-hidden rounded-xl border bg-muted">
              {it.kind === "video"
                ? <video src={it.public_url} controls className="aspect-square w-full object-cover" />
                : <img src={it.public_url} loading="lazy" className="aspect-square w-full object-cover" alt="" />}
              <button onClick={() => react(it.id)}
                className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 text-white backdrop-blur opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                <Heart className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
