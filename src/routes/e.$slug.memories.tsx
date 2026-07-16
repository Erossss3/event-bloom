import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGuest } from "@/lib/guest-identity";
import { uploadToBucket } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getRouteApi } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

const layoutApi = getRouteApi("/e/$slug");

interface Memory { id: string; author_name: string; text_content: string | null; media_url: string | null; created_at: string }

export const Route = createFileRoute("/e/$slug/memories")({
  component: MemoriesPage,
});

function MemoriesPage() {
  const { event } = layoutApi.useLoaderData();
  const [items, setItems] = useState<Memory[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("memories")
      .select("id, author_name, text_content, media_url, created_at")
      .eq("event_id", event.id).eq("moderation", "approved")
      .order("created_at", { ascending: false }).limit(80);
    setItems((data as Memory[]) ?? []);
  }
  useEffect(() => { load(); }, [event.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = getGuest(event.id);
    if (!g) return toast.error("Primero unite al evento");
    if (!text.trim() && !file) return toast.error("Compartí algo");
    setSaving(true);
    try {
      let media_url: string | null = null;
      let media_kind: "photo" | "video" | "audio" | null = null;
      if (file) {
        const isVideo = file.type.startsWith("video/");
        const isAudio = file.type.startsWith("audio/");
        media_kind = isVideo ? "video" : isAudio ? "audio" : "photo";
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${event.id}/${crypto.randomUUID()}.${ext}`;
        const { url } = await uploadToBucket("memories", path, file);
        media_url = url;
      }
      const { error } = await supabase.from("memories").insert({
        event_id: event.id, guest_id: g.guestId,
        author_name: `${g.firstName}${g.lastName ? " " + g.lastName : ""}`,
        text_content: text.trim() || null, media_url, media_kind,
      });
      if (error) throw error;
      setText(""); setFile(null);
      toast.success("Recuerdo compartido");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
        <div>
          <h2 className="font-display text-2xl">Dejá un recuerdo</h2>
          <p className="text-sm text-muted-foreground">Un mensaje, una foto, un audio. Lo guardamos para siempre.</p>
        </div>
        <div>
          <Label htmlFor="txt">Tu recuerdo</Label>
          <Textarea id="txt" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} />
        </div>
        <div>
          <Label htmlFor="mf">Adjuntá foto, video o audio</Label>
          <Input id="mf" type="file" accept="image/*,video/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" disabled={saving} className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
          {saving ? "Enviando…" : "Compartir recuerdo"}
        </Button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-cream/40 p-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-display text-2xl">Un lugar para lo que no querés olvidar</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((m) => (
            <li key={m.id} className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between text-sm">
                <strong className="font-display">{m.author_name}</strong>
                <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "d MMM · HH:mm", { locale: es })}</span>
              </div>
              {m.text_content && <p className="mt-2 text-foreground/90">{m.text_content}</p>}
              {m.media_url && (
                m.media_url.match(/\.(mp4|webm|mov)/i)
                  ? <video src={m.media_url} controls className="mt-3 w-full rounded-xl" />
                  : m.media_url.match(/\.(mp3|wav|ogg|m4a)/i)
                    ? <audio src={m.media_url} controls className="mt-3 w-full" />
                    : <img src={m.media_url} alt="" className="mt-3 w-full rounded-xl" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
