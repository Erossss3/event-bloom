import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";

const STYLE_PALETTES: Record<string, string> = {
  wedding: "from-rose-900/50 via-black to-amber-900/40",
  fifteen: "from-fuchsia-900/60 via-black to-pink-900/40",
  birthday: "from-amber-800/60 via-black to-yellow-800/40",
  party: "from-violet-900/70 via-black to-indigo-900/50",
  romantic: "from-rose-800/60 via-black to-orange-800/40",
  cinematic: "from-slate-950 via-slate-900 to-black",
  corporate: "from-neutral-800 via-neutral-900 to-black",
  tropical: "from-emerald-900/60 via-black to-teal-900/40",
};

const search = z.object({ style: z.string().optional() });

export const Route = createFileRoute("/e/$slug/summary")({
  validateSearch: search,
  loader: async ({ params }) => {
    const { data } = await supabase.from("events")
      .select("id, slug, title, cover_url, event_type, starts_at")
      .eq("slug", params.slug).maybeSingle();
    if (!data) throw notFound();
    return { event: data };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Video resumen — ${loaderData.event.title}` : "Video resumen" }],
  }),
  component: SummaryPage,
});

interface Photo { id: string; public_url: string }
interface Msg { id: string; author_name: string; body: string; emoji: string | null }

function SummaryPage() {
  const { event } = Route.useLoaderData();
  const { style } = Route.useSearch();
  const palette = STYLE_PALETTES[style ?? "wedding"] ?? STYLE_PALETTES.wedding;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("gallery")
        .select("id, public_url")
        .eq("event_id", event.id).eq("moderation", "approved").eq("kind", "photo")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false }).limit(60);
      setPhotos(data ?? []);
    })();
    (async () => {
      const { data } = await supabase.from("messages")
        .select("id, author_name, body, emoji")
        .eq("event_id", event.id).eq("moderation", "approved")
        .order("featured", { ascending: false }).limit(20);
      setMessages(data ?? []);
    })();
  }, [event.id]);

  useEffect(() => {
    if (photos.length === 0) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), 4200);
    return () => clearInterval(t);
  }, [photos.length]);

  const current = photos[idx];
  const messageForFrame = messages[idx % Math.max(1, messages.length)];

  return (
    <div className={`fixed inset-0 z-40 bg-gradient-to-br ${palette} text-white`}>
      <div className="absolute left-6 top-6 z-10">
        <p className="text-xs uppercase tracking-[0.4em] opacity-70">Video resumen · {style ?? "wedding"}</p>
        <h1 className="mt-1 font-display text-2xl">{event.title}</h1>
      </div>

      <AnimatePresence mode="wait">
        {current ? (
          <motion.img key={current.id} src={current.public_url}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="font-display text-3xl">Aún no hay fotos aprobadas para el resumen.</p>
          </div>
        )}
      </AnimatePresence>

      {messageForFrame && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-8">
          <AnimatePresence mode="wait">
            <motion.div key={messageForFrame.id + idx}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mx-auto max-w-3xl">
              <p className="font-display text-2xl md:text-3xl">
                {messageForFrame.emoji ? `${messageForFrame.emoji} ` : ""}“{messageForFrame.body}”
              </p>
              <p className="mt-2 text-sm opacity-70">— {messageForFrame.author_name}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
