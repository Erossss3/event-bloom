import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Calendar, MapPin, PlusCircle, QrCode, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Mis eventos — LiveMoments" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["my-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Panel</p>
          <h1 className="mt-2 font-display text-4xl">Mis eventos</h1>
          <p className="mt-2 text-muted-foreground">Gestioná todos tus eventos desde un solo lugar.</p>
        </div>
        <Link
          to="/app/events/new"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant"
        >
          <PlusCircle className="h-4 w-4" /> Crear evento
        </Link>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl border bg-muted/40" />
        ))}
        {events && events.length === 0 && (
          <div className="col-span-full rounded-3xl border bg-cream/40 p-12 text-center">
            <h3 className="font-display text-2xl">Aún no tenés eventos</h3>
            <p className="mt-2 text-sm text-muted-foreground">Empezá creando tu primer evento. Toma menos de 2 minutos.</p>
            <Link to="/app/events/new" className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm text-background">
              <PlusCircle className="h-4 w-4" /> Crear mi primer evento
            </Link>
          </div>
        )}
        {events?.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group relative overflow-hidden rounded-2xl border bg-card shadow-soft"
          >
            {e.cover_url ? (
              <img src={e.cover_url} alt="" className="h-40 w-full object-cover" />
            ) : (
              <div className="h-40 w-full bg-gradient-hero" />
            )}
            <div className="p-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs">
                  {statusLabel(e.status)}
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl">{e.title}</h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(e.starts_at), "d 'de' MMMM, HH:mm", { locale: es })}
                </div>
                {e.location_name && (
                  <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{e.location_name}</div>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/app/events/$id" params={{ id: e.id }} className="rounded-full bg-foreground px-4 py-1.5 text-xs text-background">
                  Administrar
                </Link>
                <Link to="/e/$slug" params={{ slug: e.slug }} className="inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-xs">
                  <Users className="h-3 w-3" /> Página pública
                </Link>
                <Link to="/app/events/$id/qr" params={{ id: e.id }} className="inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-xs">
                  <QrCode className="h-3 w-3" /> QR
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(s: string) {
  return { draft: "Borrador", published: "Publicado", live: "En vivo", finished: "Finalizado", archived: "Archivado" }[s] ?? s;
}
