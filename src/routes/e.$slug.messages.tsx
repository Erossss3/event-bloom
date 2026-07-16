import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    const { data } = await supabase.from("messages")
      .select("id, author_name, body, emoji, created_at")
      .eq("event_id", event.id).eq("moderation", "approved")
      .order("created_at", { ascending: false }).limit(100);
    setMsgs((data as Msg[]) ?? []);
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
    if (event.status === "finished") { toast.error("El evento fue finalizado."); return; }
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
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-2xl">Dejale un mensaje</h2>
        <form onSubmit={send} className="mt-4 space-y-3">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Escribí algo hermoso…" />
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((em) => (
              <button type="button" key={em} onClick={() => setEmoji(emoji === em ? null : em)}
                className={`rounded-full border px-3 py-1 text-lg ${emoji === em ? "border-gold bg-gold-soft" : ""}`}>
                {em}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={sending || body.trim().length === 0} className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
            Enviar mensaje
          </Button>
        </form>
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.li key={m.id}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2 text-sm">
                <strong className="font-display">{m.author_name}</strong>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="mt-2 text-foreground/90">{m.emoji ? `${m.emoji} ` : ""}{m.body}</p>
            </motion.li>
          ))}
        </AnimatePresence>
        {msgs.length === 0 && (
          <li className="rounded-3xl border bg-cream/40 p-12 text-center list-none">
            <MessageCircleHeart className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-2xl">Sé el primero en escribir</p>
            <p className="mt-2 text-sm text-muted-foreground">Aún no hay mensajes para este evento.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
