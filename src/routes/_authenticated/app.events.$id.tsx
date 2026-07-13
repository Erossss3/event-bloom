import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, MessageCircle, QrCode, Tv, Users, ExternalLink, Sparkles, CheckCircle2, Film, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AdminGallery } from "@/components/organizer/AdminGallery";
import { AdminMessages } from "@/components/organizer/AdminMessages";
import { VideoSummarySection } from "@/components/organizer/VideoSummarySection";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import JSZip from "jszip";
import { QRPanel } from "@/components/QRPanel";
import { publicEventUrl, publicRsvpUrl } from "@/lib/public-url";
import { useState, type ReactNode } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/app/events/$id")({
  head: () => ({ meta: [{ title: "Evento — LiveMoments" }] }),
  component: EventAdminPage,
});

function EventAdminPage() {
  const { id } = useParams({ from: "/_authenticated/app/events/$id" });
  const qc = useQueryClient();
  const [showRsvps, setShowRsvps] = useState(false);
  const [zipping, setZipping] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["event-stats", id],
    queryFn: async () => {
      const [guests, gallery, messages, rsvps, visits] = await Promise.all([
        supabase.from("guests").select("id", { count: "exact", head: true }).eq("event_id", id),
        supabase.from("gallery").select("id", { count: "exact", head: true }).eq("event_id", id),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("event_id", id),
        supabase.from("rsvps").select(`status, adults, children, dietary_items`).eq("event_id", id),
        supabase.from("event_visits").select("id", { count: "exact", head: true }).eq("event_id", id),
      ]);
      const rsvpRows = rsvps.data ?? [];

      const confirmedRows = rsvpRows.filter(
        (r) => r.status === "confirmed"
      );

      const cateringStats = {
        confirmed: confirmedRows.length,

        adults: confirmedRows.reduce(
          (sum, r) => sum + (r.adults ?? 0),
          0
        ),

        children: confirmedRows.reduce(
          (sum, r) => sum + (r.children ?? 0),
          0
        ),

        vegetarian: confirmedRows.reduce((total, r) => {
          if (!Array.isArray(r.dietary_items)) return total;

          return total + r.dietary_items
            .filter((item: any) =>
              item.name?.toLowerCase().includes("vegetar")
            )
            .reduce((sum: number, item: any) =>
              sum + (item.quantity ?? 0), 0
            );

        }, 0),

        vegan: confirmedRows.reduce((total, r) => {
          if (!Array.isArray(r.dietary_items)) return total;

          return total + r.dietary_items
            .filter((item: any) =>
              item.name?.toLowerCase().includes("vegano")
            )
            .reduce((sum: number, item: any) =>
              sum + (item.quantity ?? 0), 0
            );

        }, 0),

        glutenFree: confirmedRows.reduce((total, r) => {
          if (!Array.isArray(r.dietary_items)) return total;

          return total + r.dietary_items
            .filter((item: any) =>
              item.name?.toLowerCase().includes("tacc") ||
              item.name?.toLowerCase().includes("celiac") ||
              item.name?.toLowerCase().includes("gluten")
            )
            .reduce((sum: number, item: any) =>
              sum + (item.quantity ?? 0), 0
            );

        }, 0),

        otherRestrictions: confirmedRows.reduce((total, r) => {
          if (!Array.isArray(r.dietary_items)) return total;

          return total + r.dietary_items
            .filter((item: any) =>
              !item.name?.toLowerCase().includes("vegetar") &&
              !item.name?.toLowerCase().includes("vegano") &&
              !item.name?.toLowerCase().includes("tacc") &&
              !item.name?.toLowerCase().includes("celiac") &&
              !item.name?.toLowerCase().includes("gluten")
            )
            .reduce((sum: number, item: any) =>
              sum + (item.quantity ?? 0), 0
            );

        }, 0),
      };

      return {
        guests: guests.count ?? 0,
        gallery: gallery.count ?? 0,
        messages: messages.count ?? 0,
        visits: visits.count ?? 0,
        confirmed: confirmedRows.length,
        declined: rsvpRows.filter(r => r.status === "declined").length,
        cateringStats,
      };
    },
    refetchInterval: 15_000,
  });

  const { data: rsvps } = useQuery({
    queryKey: ["event-rsvps", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const finalize = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").update({ status: "finished" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      toast.success("Evento finalizado. Ya podés generar el video resumen.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const reopen = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").update({ status: "published" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event", id] }); toast.success("Evento reabierto"); },
  });

  async function downloadZip() {
    setZipping(true);
    try {
      const { data } = await supabase.from("gallery")
        .select("public_url, kind, id")
        .eq("event_id", id).eq("moderation", "approved");
      if (!data || data.length === 0) { toast.error("No hay archivos aprobados"); return; }
      const zip = new JSZip();
      let i = 0;
      for (const item of data) {
        try {
          const res = await fetch(item.public_url);
          const blob = await res.blob();
          const ext = item.kind === "video" ? "mp4" : "jpg";
          zip.file(`${String(++i).padStart(3, "0")}-${item.id.slice(0, 8)}.${ext}`, blob);
        } catch (err) { console.warn("skip", err); }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${event?.slug ?? "evento"}-album.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Descarga lista");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setZipping(false); }
  }

  function downloadConfirmationsPDF() {
    try {
      const confirmedGuests = rsvps?.filter(
        (r) => r.status === "confirmed"
      );

      if (!confirmedGuests || confirmedGuests.length === 0) {
        toast.error("No hay confirmaciones para descargar");
        return;
      }

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text(
        `Confirmaciones - ${event?.title ?? "Evento"}`,
        14,
        20
      );

      doc.setFontSize(11);
      doc.text(
        `Total confirmados: ${confirmedGuests.length}`,
        14,
        30
      );

      autoTable(doc, {
        startY: 40,
        head: [
          [
            "Nombre",
            "Adultos",
            "Niños",
            "Restricciones"
          ]
        ],
        body: confirmedGuests.map((rsvp) => [
          rsvp.full_name,
          rsvp.adults ?? 0,
          rsvp.children ?? 0,
          Array.isArray(rsvp.dietary_items)
            ? rsvp.dietary_items
                .map((item: any) =>
                  `${item.name} x${item.quantity}`
                )
                .join(", ")
            : "",
        ]),
      });

      doc.save(
        `${event?.slug ?? "evento"}-confirmaciones.pdf`
      );

      toast.success("PDF generado correctamente");

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error generando PDF"
      );
    }
  }

  async function deleteEvent() {
   try {
     const { error } = await (supabase.rpc as any)("delete_event", {
       event_uuid: id,
     });
 
     if (error) throw error;
 
     toast.success("Evento eliminado");
 
     window.location.href = "/app";
   } catch (err) {
     toast.error(err instanceof Error ? err.message : "Error al eliminar el evento");
   }
 }

  if (!event) return <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />;
  const finished = event.status === "finished";
  const eventUrl = publicEventUrl(event.slug);
  const rsvpUrl = publicRsvpUrl(event.slug);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">
            Evento{finished ? " · Finalizado" : ""}
          </p>
          <h1 className="mt-2 font-display text-4xl">{event.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {format(new Date(event.starts_at), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
            {event.location_name ? ` · ${event.location_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="rounded-full">
                <QrCode className="mr-2 h-4 w-4" />
                QR
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Códigos QR del evento
                </AlertDialogTitle>

                <AlertDialogDescription>
                  Compartí un QR para confirmar asistencia y otro para que los invitados vivan la experiencia del evento.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-10 mt-4">

                <div>
                  <h3 className="font-semibold text-lg mb-4">
                    ❤️ Confirmar asistencia
                  </h3>

                  <QRPanel
                    url={rsvpUrl}
                    title={`${event.title}-rsvp`}
                  />
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-4">
                    📸 Experiencia del evento
                  </h3>

                <QRPanel
                  url={eventUrl}
                  title={`${event.title}-evento`}
                />
              </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>
                  Cerrar
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Link to="/app/events/$id/live" params={{ id: event.id }} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background">
            <Tv className="h-4 w-4" /> Pantalla en vivo
          </Link>
          {finished ? (
            <Button variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}
              className="rounded-full">Reabrir evento</Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={finalize.isPending}
                  className="rounded-full bg-gradient-gold text-primary-foreground"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Finalizar evento
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Finalizar evento
                  </AlertDialogTitle>

                  <AlertDialogDescription>
                    ¿Querés cerrar este evento?
                    <br /><br />
                    Al finalizar:
                    <br />
                    ✓ Se habilitará el video resumen.
                    <br />
                    ✓ Se cerrará la experiencia del evento.
                    <br />
                    ✓ Podrás descargar el álbum completo.
                  </AlertDialogDescription>
                </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>
                  Cancelar
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={() => finalize.mutate()}
                >
                  Finalizar evento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
               variant="destructive"
                className="rounded-full bg-gradient-gold text-primary-foreground"
              >
                 Eliminar evento
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Eliminar este evento?
                </AlertDialogTitle>

                <AlertDialogDescription>
                  Esta acción eliminará permanentemente el evento y toda su información.

                 <br /><br />

                 • Invitados<br />
                 • Confirmaciones<br />
                 • Fotos y videos<br />
                 • Mensajes<br />
                 • Recuerdos

                 <br /><br />

                 Esta acción no se puede deshacer.
                </AlertDialogDescription>
             </AlertDialogHeader>

             <AlertDialogFooter>
                <AlertDialogCancel>
                  Cancelar
                </AlertDialogCancel>

               <AlertDialogAction
                 onClick={deleteEvent}
               >
                 Sí, eliminar
               </AlertDialogAction>

             </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Invitados" value={stats?.guests ?? 0} />
        <StatCard icon={Camera} label="Fotos & videos" value={stats?.gallery ?? 0} />
        <StatCard icon={MessageCircle} label="Mensajes" value={stats?.messages ?? 0} />
        <StatCard 
          icon={Sparkles} 
          label="Confirmados" 
          value={stats?.confirmed ?? 0} 
          sub={`${stats?.declined ?? 0} no asisten`}
        >
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={downloadConfirmationsPDF}>
            Descargar lista
          </Button>
        </StatCard>
      </div>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-2xl">
          🍽️ Resumen para catering
        </h2>

        <p className="text-sm text-muted-foreground">
          Cantidades calculadas automáticamente según las confirmaciones.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-4">

          <StatCard
            icon={Users}
            label="Confirmados"
            value={stats?.cateringStats?.confirmed ?? 0}
          />

          <StatCard
            icon={Users}
            label="Adultos"
            value={stats?.cateringStats?.adults ?? 0}
          />

          <StatCard
            icon={Users}
            label="Niños"
            value={stats?.cateringStats?.children ?? 0}
          />

          <StatCard
            icon={Sparkles}
            label="Vegetarianos"
            value={stats?.cateringStats?.vegetarian ?? 0}
          />

          <StatCard
            icon={Sparkles}
            label="Veganos"
            value={stats?.cateringStats?.vegan ?? 0}
          />

          <StatCard
            icon={CheckCircle2}
            label="Sin TACC"
            value={stats?.cateringStats?.glutenFree ?? 0}
          />

          <StatCard
            icon={MessageCircle}
            label="Otras restricciones"
            value={stats?.cateringStats?.otherRestrictions ?? 0}
          />

        </div>
      </section>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl inline-flex items-center gap-2"><Film className="h-5 w-5 text-gold" /> Video resumen</h2>
            <p className="text-sm text-muted-foreground">Slideshow generado con las mejores fotos y mensajes destacados.</p>
          </div>
        </div>
        <div className="mt-6">
          <VideoSummarySection eventId={id} slug={event.slug} finished={finished} />
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Descargas</h2>
            <p className="text-sm text-muted-foreground">Descargá el álbum completo con todas las fotos y videos aprobados.</p>
          </div>
          <Button onClick={downloadZip} disabled={zipping} variant="outline" className="rounded-full">
            <Download className="mr-2 h-4 w-4" /> {zipping ? "Preparando ZIP…" : "Descargar álbum (ZIP)"}
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-2xl">
          Galería
        </h2>

        <p className="text-sm text-muted-foreground">
          Moderá y destacá fotos para el slideshow.
        </p>

        <div className="mt-6">
          <AdminGallery eventId={id} />
        </div>
      </section>

    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, children }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string; children?: ReactNode; }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl">{value}</div>
      {sub && (
        <div className="text-xs text-muted-foreground">
          {sub}
        </div>
      )}

      {children}

    </div>
  );
}
