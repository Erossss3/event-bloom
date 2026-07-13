import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Star, StarOff, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  public_url: string;
  moderation: "pending" | "approved" | "rejected";
  featured: boolean;
  kind: "photo" | "video" | "audio";
}

export function AdminGallery({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const { data } = await supabase.from("gallery")
      .select("id, public_url, moderation, featured, kind")
      .eq("event_id", eventId).order("created_at", { ascending: false }).limit(60);
    setRows((data as Row[]) ?? []);
  }
  useEffect(() => { load(); }, [eventId]);

  async function toggleFeatured(id: string, featured: boolean) {
    await supabase.from("gallery").update({ featured: !featured }).eq("id", id);
    load();
  }
  async function setModeration(id: string, moderation: "approved" | "rejected") {
    await supabase.from("gallery").update({ moderation }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    const { error } = await supabase.from("gallery").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aún no hay fotos subidas.</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {rows.map((r) => (
        <div key={r.id} className="group relative overflow-hidden rounded-xl border bg-muted">
          {r.kind === "video"
            ? <video src={r.public_url} className="aspect-square w-full object-cover" muted />
            : <img src={r.public_url} className="aspect-square w-full object-cover" alt="" />}
          {r.featured && <div className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium text-primary-foreground">Destacada</div>}
          {r.moderation === "rejected" && <div className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">Oculta</div>}
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
            <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => toggleFeatured(r.id, r.featured)}>
              {r.featured ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
            </Button>
            {r.moderation !== "approved" && (
              <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => setModeration(r.id, "approved")}><Check className="h-3.5 w-3.5" /></Button>
            )}
            {r.moderation !== "rejected" && (
              <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => setModeration(r.id, "rejected")}><X className="h-3.5 w-3.5" /></Button>
            )}
            <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
