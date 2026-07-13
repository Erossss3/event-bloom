import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGuest, saveGuest, generateDeviceToken } from "@/lib/guest-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Calendar, MapPin, ArrowRight } from "lucide-react";
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
  const [done, setDone] = useState(false);

  const finished = event.status === "finished" || event.status === "archived";
  const draft = event.status === "draft";

  useEffect(() => {
    if (draft) return;
    const g = getGuest(event.id);
    if (g) {
      setFullName(`${g.firstName}${g.lastName ? " " + g.lastName : ""}`);
      supabase.from("rsvps")
        .select("id, status, adults, children, dietary, dietary_items, note, full_name")
        .eq("event_id", event.id).eq("guest_id", g.guestId).maybeSingle()
        .then(({ data }) => {
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
        });
    }
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
    if (!fullName.trim()) return toast.error("Ingresá tu nombre");
    setSaving(true);
    try {
      // asegurar guest para poder actualizar en próximas visitas
      let guest = getGuest(event.id);
      if (!guest) {
        const [firstName, ...rest] = fullName.trim().split(" ");
        const lastName = rest.join(" ") || null;
        const token = generateDeviceToken();
        const { data: g, error: gErr } = await supabase.from("guests").insert({
          event_id: event.id, device_token: token, first_name: firstName, last_name: lastName,
        }).select("id").single();
        if (gErr) throw gErr;
        saveGuest(event.id, { guestId: g.id, deviceToken: token, firstName, lastName: lastName ?? undefined });
        guest = { guestId: g.id, deviceToken: token, firstName, lastName: lastName ?? undefined };
      }

      if (existingId) {
        const { error } = await supabase.from("rsvps").update({
          full_name: fullName, status, adults: Number(adults) || 1, children: Number(children) || 0,
          dietary: dietary || null, dietary_items: dietaryItems, note: note || null,
        }).eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("rsvps").insert({
          event_id: event.id, guest_id: guest.guestId,
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
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute left-6 top-6"><LiveMomentsLogo /></div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl px-6 pb-6">
          <p className="text-xs uppercase tracking-[0.4em] text-gold">Confirmá tu asistencia</p>
          <h1 className="mt-2 font-display text-3xl leading-tight md:text-4xl">{event.title}</h1>
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
        {!draft && !finished && done ? (
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
        ) : !draft && !finished && (
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
                  <Label>Restricciones alimentarias</Label>

                  <div className="space-y-3 mt-2">

                    {dietaryItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-xl border p-3"
                      >
                        <span className="flex-1">
                          {item.name}
                        </span>
              
                        <span>
                          x{item.quantity}
                        </span>
              
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeRestriction(index)}
                        >
                          X
                                      </Button>
                                    </div>
                    ))}
              
                    <div className="flex gap-2">
              
                      <Input
                        placeholder="Ej: Celíaco"
                        value={newRestriction}
                        onChange={(e) =>
                          setNewRestriction(e.target.value)
                        }
                      />
              
                      <Input
                        type="number"
                        min={1}
                        className="w-24"
                        value={newRestrictionQty}
                        onChange={(e) =>
                          setNewRestrictionQty(Number(e.target.value))
                        }
                      />
              
                    </div>
              
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addRestriction}
                    >
                      + Agregar restricción
                    </Button>
              
                  </div>
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
        )}
      </div>
    </div>
  );
}
