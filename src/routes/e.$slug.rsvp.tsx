import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureGuestSession } from "@/lib/guest-session";
import { getGuest } from "@/lib/guest-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { getRouteApi } from "@tanstack/react-router";

const layoutApi = getRouteApi("/e/$slug");

export const Route = createFileRoute("/e/$slug/rsvp")({
  component: RsvpPage,
});

function RsvpPage() {
  const { event } = layoutApi.useLoaderData();
  const [status, setStatus] = useState<"confirmed" | "declined">("confirmed");
  const [full_name, setName] = useState("");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [dietary, setDietary] = useState("");
  const [dietaryItems, setDietaryItems] = useState<
    { name: string; quantity: number }[]
  >([]);

  const [newRestriction, setNewRestriction] = useState("");
  const [newRestrictionQty, setNewRestrictionQty] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);

  // allow_rsvp existe en event_settings (default true) — no se leía en
  // ningún lugar del frontend hasta esta corrección. Mismo patrón ya usado
  // en e.$slug.gallery.tsx / e.$slug.messages.tsx / e.$slug.memories.tsx.
  const { data: settings } = useQuery({
    queryKey: ["event-settings-public", event.id, "allow_rsvp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_settings")
        .select("allow_rsvp")
        .eq("event_id", event.id)
        .maybeSingle();
      return data;
    },
  });
  const rsvpEnabled = (settings?.allow_rsvp ?? true) && event.status !== "finished";

  useEffect(() => {
    let cancelled = false;
    const local = getGuest(event.id);
    if (local) setName(`${local.firstName}${local.lastName ? " " + local.lastName : ""}`);
    ensureGuestSession(event.id, local?.firstName ?? "").then((id) => {
      if (cancelled) return;
      setGuestId(id);
      if (!id) {
        toast.error("No pudimos identificarte. Recargá la página para intentar de nuevo.");
        return;
      }
      supabase.from("rsvps").select("id, status, adults, children, dietary, dietary_items, note, full_name")
        .eq("event_id", event.id).eq("guest_id", id).maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            toast.error("No pudimos cargar tu respuesta anterior. Recargá la página antes de confirmar de nuevo.");
            return;
          }
          if (data) {
            setExistingId(data.id);
            setStatus(data.status as "confirmed" | "declined");
            setAdults(String(data.adults)); setChildren(String(data.children));
            setDietary(data.dietary ?? ""); setNote(data.note ?? "");
            setDietaryItems(
              Array.isArray(data.dietary_items)
                ? data.dietary_items as { name: string; quantity: number }[]
                : []
            );
            setName(data.full_name);
          }
        })
        .catch(() => {
          if (!cancelled) toast.error("No pudimos cargar tu respuesta anterior. Recargá la página antes de confirmar de nuevo.");
        });
    });
    return () => { cancelled = true; };
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
    if (!rsvpEnabled) { toast.error("Las confirmaciones están cerradas para este evento."); return; }
    if (!guestId) return toast.error("Todavía estamos identificándote, esperá un momento y volvé a intentar.");
    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase.from("rsvps").update({
          full_name, status, adults: Number(adults) || 1, children: Number(children) || 0, dietary: dietary || null, dietary_items: dietaryItems, note: note || null,
        }).eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("rsvps").insert({
          event_id: event.id, guest_id: guestId,
          full_name, status, adults: Number(adults) || 1, children: Number(children) || 0, dietary: dietary || null, dietary_items: dietaryItems, note: note || null,
        }).select("id").single();
        if (error) throw error;
        setExistingId(data.id);
      }
      toast.success(status === "confirmed" ? "¡Nos vemos ahí!" : "Gracias por avisarnos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  if (!rsvpEnabled) {
    return (
      <div className="rounded-3xl border bg-cream/40 p-8 text-center">
        <p>
          {event.status === "finished"
            ? "El evento finalizó — ya no se aceptan confirmaciones."
            : "Las confirmaciones están cerradas para este evento."}
        </p>
      </div>
    );
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 rounded-3xl border bg-card p-8 shadow-soft"
    >
      <div>
        <h2 className="font-display text-3xl">Confirmá tu asistencia</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nos ayuda mucho para organizar el evento.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => setStatus("confirmed")}
          className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${status === "confirmed" ? "border-gold bg-gold-soft/40" : "border-border"}`}>
          <CheckCircle2 className="h-6 w-6 text-gold" />
          <div><div className="font-medium">Voy</div><div className="text-xs text-muted-foreground">Confirmo asistencia</div></div>
        </button>
        <button type="button" onClick={() => setStatus("declined")}
          className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${status === "declined" ? "border-destructive bg-destructive/10" : "border-border"}`}>
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
              <Input id="ad" type="number" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ch">Niños</Label>
              <Input id="ch" type="number" min={0} value={children} onChange={(e) => setChildren(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="di">Restricciones alimentarias (nota general)</Label>
            <Input id="di" value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="Vegetariano, celíaco…" />
          </div>

          <div>
            <Label>Detalle por persona (opcional)</Label>
            <p className="text-xs text-muted-foreground">Ayuda al organizador a calcular el catering con precisión.</p>

            <div className="mt-2 space-y-2">
              {dietaryItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-xl border p-3">
                  <span className="flex-1 text-sm">{item.name}</span>
                  <span className="text-sm text-muted-foreground">x{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => removeRestriction(index)}
                    aria-label={`Quitar restricción: ${item.name}`}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="new-restriction" className="sr-only">Nueva restricción</Label>
                  <Input
                    id="new-restriction"
                    placeholder="Ej: Celíaco"
                    value={newRestriction}
                    onChange={(e) => setNewRestriction(e.target.value)}
                  />
                </div>
                <div className="w-20">
                  <Label htmlFor="new-restriction-qty" className="sr-only">Cantidad de personas</Label>
                  <Input
                    id="new-restriction-qty"
                    type="number"
                    min={1}
                    value={newRestrictionQty}
                    onChange={(e) => setNewRestrictionQty(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button type="button" variant="outline" onClick={addRestriction} className="rounded-full">
                <Plus className="mr-1.5 h-4 w-4" /> Agregar restricción
              </Button>
            </div>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="nt">Comentario (opcional)</Label>
        <Textarea id="nt" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <Button type="submit" disabled={saving} className="w-full rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
        {saving ? "Guardando…" : existingId ? "Actualizar" : "Confirmar"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Tus datos se usan únicamente para que el organizador organice el evento. Ver{" "}
        <Link to="/legal/privacidad" className="underline underline-offset-2">Política de Privacidad</Link>.
      </p>
    </motion.form>
  );
}
