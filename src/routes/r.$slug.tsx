import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getGuest } from "@/lib/guest-identity";
import { ensureGuestSession } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Calendar, MapPin, ArrowRight, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LiveMomentsLogo } from "@/components/Logo";
import { motion } from "framer-motion";

export const Route = createFileRoute("/r/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("events")
      .select("id, slug, title, description, cover_url, location_name, starts_at, status")
      .eq("slug", params.slug).maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Confirmá tu asistencia — ${loaderData.event.title}` },
          { name: "description", content: `Confirmá si vas al evento ${loaderData.event.title}.` },
        ]
      : [{ title: "Confirmar asistencia — LiveMoments" }],
  }),
  component: RsvpStandalone,
});

function RsvpStandalone() {
  const { event } = Route.useLoaderData();
  const [status, setStatus] = useState<"confirmed" | "declined">("confirmed");
  const [fullName, setFullName] = useState("");
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
  const [done, setDone] = useState(false);

  const finished = event.status === "finished" || event.status === "archived";
  const draft = event.status === "draft";

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
  const rsvpEnabled = settings?.allow_rsvp ?? true;

  useEffect(() => {
    if (draft) return;
    let cancelled = false;
    const local = getGuest(event.id);
    if (local) setFullName(`${local.firstName}${local.lastName ? " " + local.lastName : ""}`);
    ensureGuestSession(event.id, local?.firstName ?? "").then((id) => {
      if (cancelled) return;
      setGuestId(id);
      if (!id) {
        toast.error("No pudimos identificarte. Recargá la página para intentar de nuevo.");
        return;
      }
      supabase.from("rsvps")
        .select("id, status, adults, children, dietary, dietary_items, note, full_name")
        .eq("event_id", event.id).eq("guest_id", id).maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            toast.error("No pudimos cargar tu respuesta anterior. Recargá la página antes de confirmar de nuevo.");
            return;
          }
          if (data) {
            setExistingId(data.id);
            setStatus(data.status === "declined" ? "declined" : "confirmed");
            setAdults(String(data.adults));
            setChildren(String(data.children));
            setDietary(data.dietary ?? "");
            setDietaryItems(
              Array.isArray(data.dietary_items)
                ? data.dietary_items as { name: string; quantity: number }[]
                : []
            );
            setNote(data.note ?? "");
            setFullName(data.full_name);
          }
        })
        .catch(() => {
          if (!cancelled) toast.error("No pudimos cargar tu respuesta anterior. Recargá la página antes de confirmar de nuevo.");
        });
    });
    return () => { cancelled = true; };
  }, [event.id, draft]);

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
    if (!rsvpEnabled) return toast.error("Las confirmaciones están cerradas para este evento.");
    if (!fullName.trim()) return toast.error("Ingresá tu nombre");
    if (!guestId) return toast.error("Todavía estamos identificándote, esperá un momento y volvé a intentar.");
    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase.from("rsvps").update({
          full_name: fullName, status, adults: Number(adults) || 1, children: Number(children) || 0,
          dietary: dietary || null, dietary_items: dietaryItems, note: note || null,
        }).eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("rsvps").insert({
          event_id: event.id, guest_id: guestId,
          full_name: fullName, status, adults: Number(adults) || 1, children: Number (children) || 0,
          dietary: dietary || null, dietary_items: dietaryItems, note: note || null,
        }).select("id").single();
        if (error) throw error;
        setExistingId(data.id);
      }
      toast.success(status === "confirmed" ? "¡Nos vemos ahí!" : "Gracias por avisar");
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-56 overflow-hidden md:h-72">
        {event.cover_url
          ? <img src={event.cover_url} alt="" className="h-full w-full object-cover" />
          : <div className="h-full w-full bg-gradient-hero" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/20" />
        <div className="absolute left-6 top-6">
          <Link to="/">
            <LiveMomentsLogo variant={event.cover_url ? "light" : "dark"} className="h-14 drop-shadow-xl" />
          </Link>
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl px-6 pb-6">
          <p className="text-xs uppercase tracking-[0.4em] text-gold">Confirmá tu asistencia</p>
          <h1 className="mt-2 font-display text-3xl leading-tight md:text-5xl">{event.title}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
              {format(new Date(event.starts_at), "d 'de' MMMM · HH:mm", { locale: es })}
            </span>
            {event.location_name && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location_name}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
        {draft && (
          <div className="rounded-2xl border bg-cream/40 p-6 text-center">
            <p>Este evento aún no está publicado.</p>
          </div>
        )}
        {!draft && finished && (
          <div className="rounded-2xl border bg-cream/40 p-6 text-center">
            <p>El evento finalizó. Ya no se aceptan confirmaciones.</p>
            <Link to="/e/$slug" params={{ slug: event.slug }} className="mt-4 inline-flex items-center gap-1.5 text-gold hover:underline">
              Ver recuerdos del evento <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        {!draft && !finished && !rsvpEnabled && (
          <div className="rounded-2xl border bg-cream/40 p-6 text-center">
            <p>Las confirmaciones están cerradas para este evento.</p>
          </div>
        )}
        {!draft && !finished && rsvpEnabled && done ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-gold text-primary-foreground">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-display text-3xl">
              {status === "confirmed" ? "¡Confirmado!" : "Registrado"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {status === "confirmed" ? "Nos vemos en el evento." : "Gracias por avisarnos."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setDone(false)} className="rounded-full">Editar respuesta</Button>
            </div>
          </motion.div>
        ) : !draft && !finished && rsvpEnabled && (
          <form onSubmit={submit} className="space-y-6 rounded-3xl border bg-card p-8 shadow-soft">
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
              <Input id="fn" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
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
          </form>
        )}
      </div>
    </div>
  );
}
