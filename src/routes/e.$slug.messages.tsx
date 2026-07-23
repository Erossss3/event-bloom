import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getGuest } from "@/lib/guest-identity";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleHeart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getRouteApi } from "@tanstack/react-router";

const layoutApi = getRouteApi("/e/$slug");

interface Msg { id: string; author_name: string; body: string; emoji: string | null; created_at: string; }

const EMOJIS = ["❤️", "🎉", "🥂", "✨", "😍", "👏", "🎂", "🌹"];

export const Route = createFileRoute("/e/$slug/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { event } = layoutApi.useLoaderData();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // allow_messages existe en event_settings (default true) para que el
  // organizador pueda desactivar los mensajes por evento — no se leía en
  // ningún lugar del frontend hasta esta corrección.
  const { data: settings } = useQuery({
    queryKey: ["event-settings-public", event.id, "allow_messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_settings")
        .select("allow_messages")
        .eq("event_id", event.id)
        .maybeSingle();
      return data;
    },
  });
  const messagesEnabled = (settings?.allow_messages ?? true) && event.status !== "finished";

  async function load() {
    const { data } = await supabase.from("messages")
      .select("id, author_name, body, emoji, created_at")
      .eq("event_id", event.id).eq("moderation", "approved")
      .order("created_at", { ascending: false }).limit(100);
    setMsgs((data as Msg[]) ?? []);
    setLoaded(true);
  }
  useEffect(() => { load(); }, [event.id]);

  useEffect(() => {
    const ch = supabase.channel(`msgs-${event.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `event_id=eq.${event.id}` },
        (p) => { const n = p.new as Msg & { moderation: string };
          if (n.moderation === "approved") setMsgs((prev) => [n, ...prev]);
        }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [event.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    if (!messagesEnabled) { toast.error("Los mensajes están cerrados para este evento."); return; }
    const guest = getGuest(event.id);
    if (!guest) return toast.error("Primero unite al evento");
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        event_id: event.id, guest_id: guest.guestId,
        author_name: `${guest.firstName}${guest.lastName ? " " + guest.lastName : ""}`,
        body: body.trim(), emoji,
      });
      if (error) throw error;
      setBody(""); setEmoji(null);
      toast.success("Mensaje enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setSending(false); }
  }

  return (
    <div className="space-y-6">
      {messagesEnabled ? (
        <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
          <h2 className="font-display text-2xl">Dejale un mensaje</h2>
          <form onSubmit={send} className="mt-4 space-y-3">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Escribí algo hermoso…" />
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((em) => (
                <button type="button" key={em} onClick={() => setEmoji(emoji === em ? null : em)}
                  aria-label={emoji === em ? `Quitar reacción ${em}` : `Agregar reacción ${em} al mensaje`}
                  aria-pressed={emoji === em}
                  className={`rounded-full border px-3 py-1 text-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${emoji === em ? "border-gold bg-gold-soft" : ""}`}>
                  {em}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={sending || body.trim().length === 0} className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
              Enviar mensaje
            </Button>
          </form>
        </div>
      ) : (
        <div className="rounded-3xl border bg-cream/40 p-6 text-center text-sm text-muted-foreground">
          {event.status === "finished" ? "El evento finalizó — ya no se aceptan nuevos mensajes." : "Los mensajes están cerrados para este evento."}
        </div>
      )}

      <ul className="space-y-3">
        {!loaded ? (
          Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-2xl bg-muted/40" />
          ))
        ) : (
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <motion.li key={m.id}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="rounded-2xl border bg-card p-6 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-gold font-display text-sm text-primary-foreground shadow-soft">
                    {m.author_name.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                      <strong className="font-display">{m.author_name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    <p className="mt-2 leading-relaxed text-foreground/90">{m.emoji ? `${m.emoji} ` : ""}{m.body}</p>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        )}
        {loaded && msgs.length === 0 && (
          <li className="rounded-3xl border bg-cream/40 px-10 py-16 text-center list-none">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gold/10" />
              <MessageCircleHeart className="h-9 w-9 text-gold/70" />
            </div>
            <p className="mt-6 font-display text-2xl">Sé el primero en escribir</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Aún no hay mensajes para este evento.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
