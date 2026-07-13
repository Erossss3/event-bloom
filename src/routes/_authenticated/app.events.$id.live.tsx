import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/events/$id/live")({
  head: () => ({ meta: [{ title: "Pantalla en vivo — Momento" }] }),
  component: LivePage,
});

interface GalleryItem { id: string; public_url: string; caption: string | null }
interface MessageItem { id: string; author_name: string; body: string; emoji: string | null }

function LivePage() {
  console.log("Estoy en live");
  const { id } = useParams({ from: "/_authenticated/app/events/$id/live" });

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error; return data;
    },
  });

  const [photos, setPhotos] = useState<GalleryItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("gallery")
        .select("id, public_url, caption")
        .eq("event_id", id).eq("moderation", "approved").eq("kind", "photo")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false }).limit(80);
      setPhotos(data ?? []);
    })();
    (async () => {
      const { data } = await supabase.from("messages")
        .select("id, author_name, body, emoji")
        .eq("event_id", id).eq("moderation", "approved")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false }).limit(30);
      setMessages(data ?? []);
    })();

    const ch = supabase.channel(`live-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gallery", filter: `event_id=eq.${id}` },
        (p) => { const n = p.new as GalleryItem & { moderation: string; kind: string };
          if (n.moderation === "approved" && n.kind === "photo") setPhotos((prev) => [n, ...prev].slice(0, 80));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `event_id=eq.${id}` },
        (p) => { const n = p.new as MessageItem & { moderation: string };
          if (n.moderation === "approved") setMessages((prev) => [n, ...prev].slice(0, 30));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    if (photos.length === 0) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), 5000);
    return () => clearInterval(t);
  }, [photos.length]);

  const current = photos[idx];
  const featuredMessage = messages[0];

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <Link to="/app/events/$id" params={{ id }}
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/20">
        <ArrowLeft className="h-4 w-4" /> Salir
      </Link>

      <AnimatePresence mode="wait">
        {current ? (
          <motion.img
            key={current.id}
            src={current.public_url}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.4em] opacity-60">{event?.title}</p>
              <h1 className="mt-4 font-display text-5xl">Esperando las primeras fotos…</h1>
            </div>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-10">
        <AnimatePresence mode="wait">
          {featuredMessage && (
            <motion.div
              key={featuredMessage.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="max-w-3xl"
            >
              <p className="text-xs uppercase tracking-[0.4em] opacity-60">Mensaje del evento</p>
              <p className="mt-2 font-display text-3xl leading-tight md:text-4xl">
                {featuredMessage.emoji ? `${featuredMessage.emoji} ` : ""}“{featuredMessage.body}”
              </p>
              <p className="mt-3 text-sm opacity-70">— {featuredMessage.author_name}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
