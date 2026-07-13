import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slugify, randomSuffix } from "@/lib/slug";
import { uploadToBucket } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/app/events/new")({
  head: () => ({ meta: [{ title: "Nuevo evento — Momento" }] }),
  component: NewEventPage,
});

const EVENT_TYPES = [
  { v: "wedding", l: "Casamiento" },
  { v: "quince", l: "15 años" },
  { v: "birthday", l: "Cumpleaños" },
  { v: "corporate", l: "Corporativo" },
  { v: "anniversary", l: "Aniversario" },
  { v: "party", l: "Fiesta" },
  { v: "other", l: "Otro" },
];

function NewEventPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    event_type: "wedding",
    description: "",
    location_name: "",
    location_address: "",
    starts_at: "",
    ends_at: "",
  });
  const [cover, setCover] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No autenticada");
      const slug = `${slugify(form.title)}-${randomSuffix()}`;
      let cover_url: string | null = null;
      if (cover) {
        const ext = cover.name.split(".").pop();
        const path = `${user.user.id}/${slug}.${ext}`;
        const { url } = await uploadToBucket("covers", path, cover);
        cover_url = url;
      }
      const { data, error } = await supabase.from("events").insert({
        owner_id: user.user.id,
        slug,
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        location_name: form.location_name || null,
        location_address: form.location_address || null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        cover_url,
        status: "published",
      }).select("id").single();
      if (error) throw error;
      toast.success("Evento creado y publicado");
      navigate({ to: "/app/events/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear evento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Nuevo evento</p>
      <h1 className="mt-2 font-display text-4xl">Crear evento</h1>
      <p className="mt-2 text-muted-foreground">Completá los datos principales. Podrás editar todo después.</p>

      <form onSubmit={onSubmit} className="mt-10 space-y-6 rounded-3xl border bg-card p-8 shadow-soft">
        <div>
          <Label htmlFor="title">Nombre del evento</Label>
          <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sofía & Martín — Casamiento" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Tipo de evento</Label>
            <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cover">Foto de portada</Label>
            <Input id="cover" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div>
          <Label htmlFor="desc">Descripción</Label>
          <Textarea id="desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Contales a tus invitados sobre el evento…" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="starts">Inicio</Label>
            <Input id="starts" type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ends">Fin (opcional)</Label>
            <Input id="ends" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="loc">Lugar</Label>
            <Input id="loc" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder="Estancia La Candela" />
          </div>
          <div>
            <Label htmlFor="addr">Dirección</Label>
            <Input id="addr" value={form.location_address} onChange={(e) => setForm({ ...form, location_address: e.target.value })} placeholder="Ruta 8 km 45, Pilar" />
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full rounded-full bg-gradient-gold text-primary-foreground">
          {saving ? "Creando…" : "Crear y publicar"}
        </Button>
      </form>
    </div>
  );
}
