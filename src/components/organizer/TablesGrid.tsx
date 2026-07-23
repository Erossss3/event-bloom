import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Copy, Trash2, Users, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import {
  type EventTable, type RsvpForTables,
  occupiedSeats, freeSeats, tableStatus, TABLE_COLOR_PRESETS, DEFAULT_TABLE_COLOR, getErrorMessage,
} from "@/lib/tables";

type FormState = {
  name: string;
  number: string;
  capacity: string;
  color: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  number: "",
  capacity: "8",
  color: DEFAULT_TABLE_COLOR,
  description: "",
};

const STATUS_LABEL: Record<string, string> = {
  empty: "Vacía",
  partial: "Parcial",
  full: "Completa",
};

const STATUS_STYLE: Record<string, string> = {
  empty: "bg-muted text-muted-foreground",
  partial: "bg-gold/15 text-gold border border-gold/40",
  full: "bg-secondary text-secondary-foreground",
};

export function TablesGrid({
  eventId,
  tables,
  rsvps,
  onSelectTable,
}: {
  eventId: string;
  tables: EventTable[];
  rsvps: RsvpForTables[];
  onSelectTable?: (tableId: string) => void;
}) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventTable | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(t: EventTable) {
    setEditing(t);
    setForm({
      name: t.name,
      number: t.number != null ? String(t.number) : "",
      capacity: String(t.capacity),
      color: t.color ?? DEFAULT_TABLE_COLOR,
      description: t.description ?? "",
    });
    setDialogOpen(true);
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["event-tables", eventId] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        event_id: eventId,
        name: form.name.trim() || "Mesa sin nombre",
        number: form.number.trim() ? Number(form.number) : null,
        capacity: Math.max(1, Number(form.capacity) || 1),
        color: form.color || null,
        description: form.description.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("event_tables").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_tables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Mesa actualizada" : "Mesa creada");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e, "Error al guardar la mesa")),
  });

  const duplicate = useMutation({
    mutationFn: async (t: EventTable) => {
      const { error } = await supabase.from("event_tables").insert({
        event_id: eventId,
        name: `${t.name} (copia)`,
        number: null,
        capacity: t.capacity,
        color: t.color,
        description: t.description,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mesa duplicada"); invalidate(); },
    onError: (e) => toast.error(getErrorMessage(e, "Error al duplicar")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mesa eliminada"); invalidate(); },
    onError: (e) => toast.error(getErrorMessage(e, "Error al eliminar")),
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="h-4 w-4" /> {tables.length} {tables.length === 1 ? "mesa" : "mesas"}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <Plus className="mr-2 h-4 w-4" /> Nueva mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar mesa" : "Nueva mesa"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="t-name">Nombre</Label>
                  <Input id="t-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Mesa de los novios" />
                </div>
                <div>
                  <Label htmlFor="t-number">Número</Label>
                  <Input id="t-number" type="number" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} placeholder="1" />
                </div>
              </div>
              <div>
                <Label htmlFor="t-capacity">Capacidad</Label>
                <Input id="t-capacity" type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div>
                <Label>Color</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {TABLE_COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      aria-label={`Color ${c.label}`}
                      aria-pressed={form.color === c.value}
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.color === c.value ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="t-desc">Descripción (opcional)</Label>
                <Textarea id="t-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Cerca de la pista, familia del novio…" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-full">Cancelar</Button>
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || !form.name.trim()}
                className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0"
              >
                {save.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tables.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed bg-cream/40 p-10 text-center">
          <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg">Todavía no creaste ninguna mesa</p>
          <p className="mt-1 text-sm text-muted-foreground">Empezá creando la primera para organizar la distribución de invitados.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => {
            const occ = occupiedSeats(t.id, rsvps);
            const free = freeSeats(t, rsvps);
            const status = tableStatus(t, rsvps);
            const pct = Math.min(100, Math.round((occ / Math.max(1, t.capacity)) * 100));
            return (
              <div
                key={t.id}
                className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant"
              >
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: t.color ?? DEFAULT_TABLE_COLOR }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {t.number != null && (
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{t.number}</span>
                      )}
                      <h3 className="truncate font-display text-lg">{t.name}</h3>
                    </div>
                    {t.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                </div>

                <button
                  onClick={() => onSelectTable?.(t.id)}
                  className="mt-4 w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  title="Ver invitados de esta mesa"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {occ} / {t.capacity}</span>
                    <span>{free} libres</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: t.color ?? DEFAULT_TABLE_COLOR }}
                    />
                  </div>
                </button>

                <div className="mt-4 flex items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                  <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openEdit(t)}>
                    <Pencil className="mr-1.5 h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => duplicate.mutate(t)} disabled={duplicate.isPending}>
                    <Copy className="mr-1.5 h-3 w-3" /> Duplicar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 rounded-full px-2 text-xs text-destructive hover:text-destructive" aria-label={`Eliminar mesa "${t.name}"`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar "{t.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Los invitados asignados a esta mesa quedarán sin mesa asignada. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(t.id)} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
