import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  head: () => ({ meta: [{ title: "Nuevo evento — LiveMoments" }] }),
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

const MAX_COVER_SIZE_MB = 8;

function NewEventPage() {
  const navigate = useNavigate();
  const { user } = useRouteContext({ from: "/_authenticated" });
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
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function handleCoverChange(file: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    if (!file) {
      setCover(null);
      setCoverPreview(null);
      return;
    }
    if (file.size > MAX_COVER_SIZE_MB * 1024 * 1024) {
      toast.error(`La portada pesa demasiado (máximo ${MAX_COVER_SIZE_MB} MB).`);
      setCover(null);
      setCoverPreview(null);
      return;
    }
    setCover(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.ends_at && form.starts_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast.error("La fecha de fin debe ser posterior a la de inicio.");
      return;
    }
    setSaving(true);
    try {
      const slug = `${slugify(form.title)}-${randomSuffix()}`;
      let cover_url: string | null = null;
      if (cover) {
        const ext = cover.name.split(".").pop();
        const path = `${user.id}/${slug}.${ext}`;
        const { url } = await uploadToBucket("covers", path, cover);
        cover_url = url;
      }
      const { data, error } = await supabase.from("events").insert({
        owner_id: user.id,
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
          <Input id="title" autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sofía & Martín — Casamiento" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="event_type">Tipo de evento</Label>
            <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
              <SelectTrigger id="event_type"><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cover">Foto de portada</Label>
            <Input id="cover" type="file" accept="image/*" onChange={(e) => handleCoverChange(e.target.files?.[0] ?? null)} />
            <p className="mt-1 text-xs text-muted-foreground">Opcional. JPG o PNG, hasta {MAX_COVER_SIZE_MB} MB.</p>
            {coverPreview && (
              <img src={coverPreview} alt="Vista previa de la portada" className="mt-2 h-20 w-full rounded-lg object-cover" />
            )}
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
            <Input
              id="ends"
              type="datetime-local"
              min={form.starts_at || undefined}
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
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

        <div>
          <Button type="submit" disabled={saving} className="w-full rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
            {saving ? "Creando…" : "Crear y publicar"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Tu evento queda visible para tus invitados apenas lo creás. Vas a poder editar todo después.
          </p>
        </div>
      </form>
    </div>
  );
}
