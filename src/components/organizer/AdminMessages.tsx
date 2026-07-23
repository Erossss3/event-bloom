import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Star, Trash2, MessageCircleHeart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Row { id: string; author_name: string; body: string; emoji: string | null; featured: boolean; created_at: string }

export function AdminMessages({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [toDelete, setToDelete] = useState<string | null>(null);

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
    await supabase.from("messages").delete().eq("id", id);
    setToDelete(null);
    load();
  }

  if (rows.length === 0) return (
    <div className="rounded-2xl border border-dashed bg-cream/40 p-10 text-center">
      <MessageCircleHeart className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-display text-lg">Aún no hay mensajes</p>
      <p className="mt-1 text-sm text-muted-foreground">Los mensajes de tus invitados van a aparecer acá para que los destaques.</p>
    </div>
  );

  return (
    <>
      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start ${m.featured ? "border-gold bg-gold-soft/30" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{m.author_name}</strong>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="mt-1 break-words">{m.emoji ? `${m.emoji} ` : ""}{m.body}</p>
            </div>
            <div className="flex shrink-0 gap-2 self-end sm:self-start">
              <Button size="sm" variant={m.featured ? "default" : "outline"} className="h-8 w-8 p-0" onClick={() => toggleFeatured(m.id, m.featured)} aria-label={m.featured ? "Quitar de destacados" : "Destacar mensaje"}>
                <Star className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setToDelete(m.id)} aria-label="Eliminar mensaje">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este mensaje?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && remove(toDelete)}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
