import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { CountdownTimer } from "@/components/CountdownTimer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { Camera, MapPin, MessageCircle } from "lucide-react";
import { getRouteApi } from "@tanstack/react-router";

const layoutApi = getRouteApi("/e/$slug");

export const Route = createFileRoute("/e/$slug/")({
  component: EventHome,
});

function EventHome() {
  const { slug } = useParams({ from: "/e/$slug/" });
  const { event } = layoutApi.useLoaderData();

  const hasLocation = event.location_name || event.location_address;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-10">
      {/* Fecha y lugar son la misma categoría de información ("sobre el
          evento") — antes vivían en dos tarjetas separadas y apiladas; ahora
          es una sola, con un divisor sutil entre ambas partes en vez de dos
          bordes distintos compitiendo por atención. */}
      <div className="rounded-3xl border bg-gradient-hero p-6 shadow-soft sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Cuenta regresiva</p>
        <CountdownTimer target={event.starts_at} />
        <p className="mt-4 text-sm text-muted-foreground">
          {format(new Date(event.starts_at), "EEEE d 'de' MMMM 'de' yyyy · HH:mm", { locale: es })}
        </p>

        {hasLocation && (
          <div className="mt-6 border-t border-foreground/10 pt-6">
            <p className="flex items-center gap-2 font-display text-lg text-foreground/90">
              <MapPin className="h-4 w-4 shrink-0 text-gold" /> {event.location_name}
            </p>
            {event.location_address && <p className="mt-1 text-sm text-muted-foreground">{event.location_address}</p>}
            {event.location_address && (
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://maps.google.com/?q=${encodeURIComponent(event.location_address)}`}
                className="mt-4 inline-flex rounded-full border border-foreground/15 px-4 py-2 text-sm transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Ver en mapas
              </a>
            )}
          </div>
        )}
      </div>

      {/* Prioridad visual: 1) subir recuerdos / ver álbum (misma pantalla,
          es la acción central de LiveMoments), 2) dejar un mensaje,
          3) confirmar asistencia — antes las tres competían con el mismo
          peso, ahora hay una sola protagonista. */}
      <div className="space-y-3">
        <Link
          to="/e/$slug/gallery"
          params={{ slug }}
          className="group flex items-center justify-between gap-4 rounded-3xl bg-gradient-gold p-7 text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] opacity-80">La foto es el recuerdo</p>
            <p className="mt-1 font-display text-2xl">Subí y mirá el álbum</p>
          </div>
          <Camera className="h-8 w-8 shrink-0 opacity-90 transition-transform group-hover:scale-110" />
        </Link>

        <Link
          to="/e/$slug/messages"
          params={{ slug }}
          className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground">
            <MessageCircle className="h-5 w-5" />
          </div>
          <p className="font-medium">Dejale un mensaje</p>
        </Link>

      </div>
    </motion.div>
  );
}
