import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGuest } from "@/lib/guest-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { getRouteApi } from "@tanstack/react-router";

const layoutApi = getRouteApi("/e/$slug");

export const Route = createFileRoute("/e/$slug/rsvp")({
  component: RsvpPage,
});

function RsvpPage() {
  const { event } = layoutApi.useLoaderData();
  const [status, setStatus] = useState<"confirmed" | "declined">("confirmed");
  const [full_name, setName] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [dietary, setDietary] = useState("");
  const [dietaryItems, setDietaryItems] = useState<
    { name: string; quantity: number }[]
  >([]);

  const [newRestriction, setNewRestriction] = useState("");
  const [newRestrictionQty, setNewRestrictionQty] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    const g = getGuest(event.id);
    if (g) setName(`${g.firstName}${g.lastName ? " " + g.lastName : ""}`);
    if (g) {
      supabase.from("rsvps").select("id, status, adults, children, dietary, note, full_name")
        .eq("event_id", event.id).eq("guest_id", g.guestId).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setExistingId(data.id);
            setStatus(data.status as "confirmed" | "declined");
            setAdults(data.adults); setChildren(data.children);
            setDietary(data.dietary ?? ""); setNote(data.note ?? "");
            setName(data.full_name);
          }
        });
    }
  }, [event.id]);

  function addRestriction() {
    if (!newRestriction.trim()) return;

    setDietaryItems([
      ...dietaryItems,
      {
        name: newRestriction,
        quantity: newRestrictionQty,
      },
    ]);

    setNewRestriction("");
    setNewRestrictionQty(1);
  }

  function removeRestriction(index: number) {
    setDietaryItems(
      dietaryItems.filter((_, i) => i !== index)
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = getGuest(event.id);
    if (!g) return toast.error("Primero unite al evento");
    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase.from("rsvps").update({
          full_name, status, adults, children, dietary: dietary || null, dietary_items: dietaryItems, note: note || null,
        }).eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("rsvps").insert({
          event_id: event.id, guest_id: g.guestId,
          full_name, status, adults, children, dietary: dietary || null, dietary_items: dietaryItems, note: note || null,
        }).select("id").single();
        if (error) throw error;
        setExistingId(data.id);
      }
      toast.success(status === "confirmed" ? "¡Nos vemos ahí!" : "Gracias por avisarnos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-3xl border bg-card p-8 shadow-soft">
      <div>
        <h2 className="font-display text-3xl">Confirmá tu asistencia</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nos ayuda mucho para organizar el evento.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => setStatus("confirmed")}
          className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${status === "confirmed" ? "border-gold bg-gold-soft/40" : "border-border"}`}>
          <CheckCircle2 className="h-6 w-6 text-gold" />
          <div><div className="font-medium">Voy</div><div className="text-xs text-muted-foreground">Confirmo asistencia</div></div>
        </button>
        <button type="button" onClick={() => setStatus("declined")}
          className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${status === "declined" ? "border-destructive bg-destructive/10" : "border-border"}`}>
          <XCircle className="h-6 w-6 text-destructive" />
          <div><div className="font-medium">No podré ir</div><div className="text-xs text-muted-foreground">Avisar ausencia</div></div>
        </button>
      </div>

      <div>
        <Label htmlFor="fn">Nombre completo</Label>
        <Input id="fn" required value={full_name} onChange={(e) => setName(e.target.value)} />
      </div>

      {status === "confirmed" && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="ad">Adultos</Label>
              <Input id="ad" type="number" min={1} value={adults} onChange={(e) => setAdults(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label htmlFor="ch">Niños</Label>
              <Input id="ch" type="number" min={0} value={children} onChange={(e) => setChildren(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label htmlFor="di">Restricciones alimentarias</Label>
            <Input id="di" value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="Vegetariano, celíaco…" />
          </div>
        </>
      )}

      <div>
        <Label htmlFor="nt">Comentario (opcional)</Label>
        <Textarea id="nt" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <Button type="submit" disabled={saving} className="w-full rounded-full bg-gradient-gold text-primary-foreground">
        {saving ? "Guardando…" : existingId ? "Actualizar" : "Confirmar"}
      </Button>
    </form>
  );
}
