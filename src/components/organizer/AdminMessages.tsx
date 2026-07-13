import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Star, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Row { id: string; author_name: string; body: string; emoji: string | null; featured: boolean; created_at: string }

export function AdminMessages({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  async function load() {
    const { data } = await supabase.from("messages")
      .select("id, author_name, body, emoji, featured, created_at")
      .eq("event_id", eventId).order("created_at", { ascending: false }).limit(50);
    setRows((data as Row[]) ?? []);
  }
  useEffect(() => { load(); }, [eventId]);

  async function toggleFeatured(id: string, v: boolean) {
    await supabase.from("messages").update({ featured: !v }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("¿Eliminar mensaje?")) return;
    await supabase.from("messages").delete().eq("id", id);
    load();
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aún no hay mensajes.</p>;

  return (
    <ul className="space-y-3">
      {rows.map((m) => (
        <li key={m.id} className={`flex items-start gap-3 rounded-xl border p-4 ${m.featured ? "border-gold bg-gold-soft/30" : ""}`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm">
              <strong>{m.author_name}</strong>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
              </span>
            </div>
            <p className="mt-1">{m.emoji ? `${m.emoji} ` : ""}{m.body}</p>
          </div>
          <Button size="sm" variant={m.featured ? "default" : "outline"} className="h-8 w-8 p-0" onClick={() => toggleFeatured(m.id, m.featured)}>
            <Star className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(m.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
