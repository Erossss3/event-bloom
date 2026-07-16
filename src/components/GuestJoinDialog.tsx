import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { generateDeviceToken, saveGuest, getGuest } from "@/lib/guest-identity";
import { toast } from "sonner";

export function GuestJoinDialog({
  open, onOpenChange, eventId, eventTitle,
}: { open: boolean; onOpenChange: (o: boolean) => void; eventId: string; eventTitle: string }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const existing = getGuest(eventId);
      const token = existing?.deviceToken ?? generateDeviceToken();
      let avatarUrl: string | undefined;
      const { data, error } = await supabase.from("guests")
        .upsert({
          event_id: eventId, device_token: token,
          first_name: first.trim(), last_name: last.trim() || null,
          avatar_url: avatarUrl ?? null,
        }, { onConflict: "event_id,device_token" })
        .select("id").single();
      if (error) throw error;
      saveGuest(eventId, {
        guestId: data.id, deviceToken: token,
        firstName: first.trim(), lastName: last.trim() || undefined,
      });
      toast.success(`¡Bienvenido/a a ${eventTitle}!`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al unirse");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* no cerrar sin unirse */ }}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">¡Bienvenido/a!</DialogTitle>
          <DialogDescription>Antes de sumarte a {eventTitle}, decinos quién sos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={join} className="space-y-4">
          <div>
            <Label htmlFor="first">Nombre</Label>
            <Input id="first" required value={first} onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="last">Apellido <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="last" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving || first.trim().length === 0} className="w-full rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
            {saving ? "Un momento…" : "Unirme"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
