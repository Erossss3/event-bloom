import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { createFileRoute, Link, useParams, Outlet, useRouterState, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, MessageCircle, QrCode, Tv, Users, Sparkles, CheckCircle2, Film, Download, Armchair } from "lucide-react";
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
import { useState, useEffect, useMemo, type ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/app/events/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    qr: search.qr === true || search.qr === "true",
  }),
  // No confiamos únicamente en RLS para esta ruta administrativa: verificamos
  // explícitamente que el usuario autenticado sea el dueño de este evento
  // antes de renderizar nada. Si no coincide, devolvemos notFound (no se
  // filtran datos parciales de eventos ajenos).
  loader: async ({ params, context }) => {
    const uid = (context as { user?: { id: string } }).user?.id;
    if (!uid) throw notFound();

    const { data, error } = await supabase
      .from("events")
      .select("id")
      .eq("id", params.id)
      .eq("owner_id", uid)
      .maybeSingle();

    if (error || !data) throw notFound();
  },
  head: () => ({ meta: [{ title: "Evento — LiveMoments" }] }),
  component: EventAdminPage,
});

const LIVE_STYLE_OPTIONS = [
  ["elegante", "✨ Elegante"],
  ["minimalista", "⬛ Minimalista"],
  ["moderno", "💎 Moderno"],
  ["fiesta", "🎉 Fiesta"],
  ["mosaico2", "🖼️ Mosaico x2"],
  ["mosaico4", "🧩 Mosaico x4"],
  ["vertical", "📱 Vertical"],
] as const;

function EventAdminPage() {
  const { id } = useParams({ from: "/_authenticated/app/events/$id" });
  const search = Route.useSearch();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isTables = pathname.endsWith("/tables");
  const isMessages = pathname.endsWith("/messages");
  const isSubPage = isTables || isMessages;
  const qc = useQueryClient();
  const [showRsvps, setShowRsvps] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [liveDialogOpen, setLiveDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  // Permite abrir el diálogo de QR directamente por URL (?qr=true), por
  // ejemplo desde el acceso rápido "QR" en las tarjetas del Dashboard.
  useEffect(() => {
    if (search.qr) setQrDialogOpen(true);
  }, [search.qr]);

  const [liveStyle, setLiveStyle] = useState<
    "elegante" |
    "minimalista" |
    "moderno" |
    "fiesta" |
    "mosaico2" |
    "mosaico4" |
    "vertical"
  >("elegante");

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    // Cuando estamos en /tables, este componente solo renderiza <Outlet/> (ver
    // más abajo) y ni "event" ni "stats" ni "rsvps" se leen para nada — pero
    // sin este guard las 3 queries se ejecutaban igual, dos de ellas además
    // reconsultando cada 15s en segundo plano sin que nada las mostrara.
    enabled: !isSubPage,
  });

  const { data: stats } = useQuery({
    queryKey: ["event-stats", id],
    queryFn: async () => {
      const [guests, gallery, messages, visits] = await Promise.all([
        supabase.from("guests").select("id", { count: "exact", head: true }).eq("event_id", id),
        supabase.from("gallery").select("id", { count: "exact", head: true }).eq("event_id", id),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("event_id", id),
        supabase.from("event_visits").select("id", { count: "exact", head: true }).eq("event_id", id),
      ]);

      return {
        guests: guests.count ?? 0,
        gallery: gallery.count ?? 0,
        messages: messages.count ?? 0,
        visits: visits.count ?? 0,
      };
    },
    refetchInterval: 15_000,
    enabled: !isSubPage,
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
    refetchInterval: 15_000,
    enabled: !isSubPage,
  });

  // Confirmados, catering y demás derivados de "rsvps" en vez de una segunda
  // consulta redundante: antes "event-stats" volvía a traer todas las filas
  // de rsvps (con dietary_items) cada 15s para calcular exactamente esto,
  // duplicando lo que "event-rsvps" ya trae. Se calcula todo acá, en memoria.
  const cateringStats = useMemo(() => {
    const confirmedRows = (rsvps ?? []).filter((r) => r.status === "confirmed");

    const sumByKeyword = (keywords: string[]) =>
      confirmedRows.reduce((total, r) => {
        if (!Array.isArray(r.dietary_items)) return total;
        return total + r.dietary_items
          .filter((item: any) => keywords.some((k) => item.name?.toLowerCase().includes(k)))
          .reduce((sum: number, item: any) => sum + (item.quantity ?? 0), 0);
      }, 0);

    return {
      confirmed: confirmedRows.length,
      adults: confirmedRows.reduce((sum, r) => sum + (r.adults ?? 0), 0),
      children: confirmedRows.reduce((sum, r) => sum + (r.children ?? 0), 0),
      vegetarian: sumByKeyword(["vegetar"]),
      vegan: sumByKeyword(["vegano"]),
      glutenFree: sumByKeyword(["tacc", "celiac", "gluten"]),
      otherRestrictions: confirmedRows.reduce((total, r) => {
        if (!Array.isArray(r.dietary_items)) return total;
        const known = ["vegetar", "vegano", "tacc", "celiac", "gluten"];
        return total + r.dietary_items
          .filter((item: any) => !known.some((k) => item.name?.toLowerCase().includes(k)))
          .reduce((sum: number, item: any) => sum + (item.quantity ?? 0), 0);
      }, 0),
    };
  }, [rsvps]);

  const confirmedCount = cateringStats.confirmed;
  const declinedCount = useMemo(() => (rsvps ?? []).filter((r) => r.status === "declined").length, [rsvps]);

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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al reabrir el evento"),
  });

  async function downloadZip() {
    setZipping(true);
    try {
      const { data } = await supabase.from("gallery")
        .select("public_url, kind, id, storage_path")
        .eq("event_id", id).eq("moderation", "approved");
      if (!data || data.length === 0) { toast.error("No hay archivos aprobados"); return; }
      const zip = new JSZip();
      let i = 0;
      let failed = 0;
      for (const item of data) {
        try {
          const res = await fetch(item.public_url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const realExt = item.storage_path?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
          const ext = realExt || (item.kind === "video" ? "mp4" : "jpg");
          zip.file(`${String(++i).padStart(3, "0")}-${item.id.slice(0, 8)}.${ext}`, blob);
        } catch (err) {
          failed++;
          console.warn("skip", err);
        }
      }
      if (i === 0) { toast.error("No se pudo descargar ningún archivo. Probá de nuevo."); return; }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${event?.slug ?? "evento"}-album.zip`; a.click();
      URL.revokeObjectURL(url);
      if (failed > 0) {
        toast.warning(`Descarga lista, pero ${failed} archivo${failed !== 1 ? "s" : ""} no se pudo${failed !== 1 ? "n" : ""} incluir.`);
      } else {
        toast.success("Descarga lista");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally { setZipping(false); }
  }

  const [deleting, setDeleting] = useState(false);

  async function deleteEvent() {
   setDeleting(true);
   try {
     // Storage no está ligado por foreign key a "events" — el ON DELETE
     // CASCADE de la base no toca los archivos. Se listan y borran acá,
     // antes de eliminar la fila del evento, usando el mismo criterio de
     // paths que ya usan las policies de Storage: gallery/memories/exports
     // guardan bajo "{event_id}/...", covers bajo "{owner_id}/{slug}.ext".
     // Se envuelve en su propio try/catch: un fallo de Storage no debe
     // impedir que el evento se termine de eliminar.
     try {
       for (const bucket of ["gallery", "memories", "exports"] as const) {
         const { data: files } = await supabase.storage.from(bucket).list(id);
         if (files && files.length > 0) {
           await supabase.storage.from(bucket).remove(files.map((f) => `${id}/${f.name}`));
         }
       }
       if (event?.owner_id && event?.slug) {
         const { data: coverFiles } = await supabase.storage.from("covers").list(event.owner_id);
         const ownCover = (coverFiles ?? []).filter((f) => f.name.startsWith(`${event.slug}.`));
         if (ownCover.length > 0) {
           await supabase.storage.from("covers").remove(ownCover.map((f) => `${event.owner_id}/${f.name}`));
         }
       }
     } catch (storageErr) {
       console.error("No se pudieron limpiar todos los archivos de Storage del evento:", storageErr);
     }

     const { error } = await (supabase.rpc as any)("delete_event", {
       event_uuid: id,
     });
 
     if (error) throw error;
 
     toast.success("Evento eliminado");
 
     window.location.href = "/app";
   } catch (err) {
     toast.error(err instanceof Error ? err.message : "Error al eliminar el evento");
     setDeleting(false);
   }
 }

  if (isSubPage) {
    return <Outlet />;
  }

  if (!event) return <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />;
  const finished = event.status === "finished";
  const eventUrl = publicEventUrl(event.slug);
  const rsvpUrl = publicRsvpUrl(event.slug);

  return (
    <div className="space-y-14">
      {/* ============ 1. INFORMACIÓN PRINCIPAL ============ */}
      <section className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap items-center gap-5">
            {event.cover_url && (
              <img
                src={event.cover_url}
                alt=""
                className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-soft sm:h-24 sm:w-24"
              />
            )}
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
          </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
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
          <Link to="/app/events/$id/tables" params={{ id }} search={{ qr: false }}>
            <Button variant="outline" className="rounded-full">
              <Armchair className="mr-2 h-4 w-4" />
              Mesas
            </Button>
          </Link>
          <Button
            onClick={() => setLiveDialogOpen(true)}
            className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0"
          >
            <Tv className="mr-2 h-4 w-4" />
            Pantalla en vivo
          </Button>
          {finished ? (
            <Button variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}
              className="rounded-full">Reabrir evento</Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={finalize.isPending}
                  className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0"
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
              <Button variant="destructive" className="rounded-full">
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
                 onClick={(e) => { e.preventDefault(); deleteEvent(); }}
                 disabled={deleting}
                 className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
               >
                 {deleting ? "Eliminando…" : "Sí, eliminar"}
               </AlertDialogAction>

             </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog
            open={liveDialogOpen}
            onOpenChange={setLiveDialogOpen}
          >
            <AlertDialogContent className="max-w-xl">

              <AlertDialogHeader>
                <AlertDialogTitle>
                  Elegí el estilo de la pantalla
                </AlertDialogTitle>

                <AlertDialogDescription>
                  Podés cambiar la forma en que se mostrarán las fotos durante el evento.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">

                {LIVE_STYLE_OPTIONS.map(([value, label]) => (

                  <button
                    key={value}
                    onClick={() => setLiveStyle(value as any)}
                    className={`
                      rounded-xl
                      border
                      p-4
                      text-left
                      transition-colors
                      ${
                        liveStyle === value
                          ? "border-gold bg-gradient-gold text-primary-foreground shadow-elegant"
                          : "hover:bg-muted"
                      }
                    `}
                  >
                    {label}
                  </button>

                ))}

              </div>

              <AlertDialogFooter>

                <AlertDialogCancel>
                  Cancelar
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={() =>
                    window.open(
                      `/e/${event.slug}/live?style=${liveStyle}`,
                      "_blank"
                    )
                  }
                >
                  Abrir pantalla
                </AlertDialogAction>

              </AlertDialogFooter>

            </AlertDialogContent>
          </AlertDialog>
        </div>
        </div>

        <div className="mt-8 grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard icon={Users} label="Invitados" value={stats?.guests ?? 0} />
          <StatCard icon={Camera} label="Fotos & videos" value={stats?.gallery ?? 0} />
          <StatCard icon={MessageCircle} label="Mensajes" value={stats?.messages ?? 0} />
          <StatCard icon={Sparkles} label="Confirmados" value={confirmedCount} />
        </div>
      </section>

      {/* ============ 2. ACTIVIDAD ============ */}
      <section className="space-y-6">
        <div>
          <h2 className="font-display text-3xl">Actividad</h2>
          <p className="mt-1 text-sm text-muted-foreground">Todo lo que están generando tus invitados, en un solo lugar.</p>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-4 w-4" /> Confirmaciones
          </div>
          <button
            type="button"
            onClick={() => setShowRsvps((v) => !v)}
            className="mt-3 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {confirmedCount} confirmados · {declinedCount} no asisten — {showRsvps ? "ocultar lista" : "ver lista"}
          </button>

          {showRsvps && (
            <div className="mt-5 border-t pt-5">
              {!rsvps || rsvps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay respuestas de RSVP.</p>
              ) : (
                <ul className="divide-y">
                  {rsvps.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{r.full_name}</span>
                        {r.dietary && <p className="text-xs text-muted-foreground">🍽️ {r.dietary}</p>}
                      </div>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={r.status === "confirmed" ? "text-gold" : r.status === "declined" ? "text-destructive" : ""}>
                          {r.status === "confirmed" ? "Confirmado" : r.status === "declined" ? "No asiste" : "Pendiente"}
                        </span>
                        {r.status === "confirmed" && <span>· {(r.adults ?? 0) + (r.children ?? 0)} personas</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 border-t pt-6">
            <h3 className="font-display text-lg">🍽️ Resumen para catering</h3>
            <p className="text-sm text-muted-foreground">Cantidades calculadas automáticamente según las confirmaciones.</p>
            <div className="mt-5 grid gap-4 grid-cols-2 md:grid-cols-4">
              <StatCard icon={Users} label="Confirmados" value={cateringStats.confirmed ?? 0} />
              <StatCard icon={Users} label="Adultos" value={cateringStats.adults ?? 0} />
              <StatCard icon={Users} label="Niños" value={cateringStats.children ?? 0} />
              <StatCard icon={Sparkles} label="Vegetarianos" value={cateringStats.vegetarian ?? 0} />
              <StatCard icon={Sparkles} label="Veganos" value={cateringStats.vegan ?? 0} />
              <StatCard icon={CheckCircle2} label="Sin TACC" value={cateringStats.glutenFree ?? 0} />
              <StatCard icon={MessageCircle} label="Otras restricciones" value={cateringStats.otherRestrictions ?? 0} />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl">Mensajes</h3>
              <p className="text-sm text-muted-foreground">Destacá los mensajes más lindos para el video resumen.</p>
            </div>
            <Link
              to="/app/events/$id/messages"
              params={{ id }}
              search={{ qr: false }}
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              💌 Ver libro de recuerdos
            </Link>
          </div>
          <div className="mt-6">
            <AdminMessages eventId={id} />
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
          <h3 className="font-display text-2xl">Galería</h3>
          <p className="text-sm text-muted-foreground">Moderá y destacá fotos para el slideshow.</p>
          <div className="mt-6">
            <AdminGallery eventId={id} />
          </div>
        </div>
      </section>

      {/* ============ 3. HERRAMIENTAS ============ */}
      <section className="space-y-6">
        <div>
          <h2 className="font-display text-3xl">Herramientas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantalla en vivo y Mesas están arriba, a un clic. Acá armás el video resumen.
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
          <h3 className="font-display text-2xl inline-flex items-center gap-2">
            <Film className="h-5 w-5 text-gold" /> Video resumen
          </h3>
          <p className="text-sm text-muted-foreground">Slideshow generado con las mejores fotos y mensajes destacados.</p>
          <div className="mt-6">
            <VideoSummarySection eventId={id} slug={event.slug} finished={finished} />
          </div>
        </div>
      </section>

      {/* ============ 4. DESCARGAS ============ */}
      <section className="space-y-6">
        <div>
          <h2 className="font-display text-3xl">Descargas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Llevate todo lo del evento, para siempre.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg">Álbum completo</h3>
            <p className="mt-1 text-sm text-muted-foreground">Todas las fotos y videos aprobados, en un solo ZIP.</p>
            <Button onClick={downloadZip} disabled={zipping} variant="outline" className="mt-4 w-full rounded-full">
              <Download className="mr-2 h-4 w-4" /> {zipping ? "Preparando ZIP…" : "Descargar álbum (ZIP)"}
            </Button>
          </div>
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
