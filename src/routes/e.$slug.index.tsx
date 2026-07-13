import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { CountdownTimer } from "@/components/CountdownTimer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { Camera, Heart, MapPin, MessageCircle } from "lucide-react";
import { getRouteApi } from "@tanstack/react-router";

const layoutApi = getRouteApi("/e/$slug");

export const Route = createFileRoute("/e/$slug/")({
  component: EventHome,
});

function EventHome() {
  const { slug } = useParams({ from: "/e/$slug/" });
  const { event } = layoutApi.useLoaderData();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {event.description && (
        <p className="text-lg leading-relaxed text-foreground/80">{event.description}</p>
      )}

      <div className="rounded-3xl border bg-gradient-hero p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Cuenta regresiva</p>
        <CountdownTimer target={event.starts_at} />
        <p className="mt-3 text-sm text-muted-foreground">
          {format(new Date(event.starts_at), "EEEE d 'de' MMMM 'de' yyyy · HH:mm", { locale: es })}
        </p>
      </div>

      {(event.location_name || event.location_address) && (
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <h3 className="font-display text-2xl">Lugar</h3>
          <p className="mt-2 flex items-center gap-2 text-foreground/80"><MapPin className="h-4 w-4" /> {event.location_name}</p>
          {event.location_address && <p className="mt-1 text-sm text-muted-foreground">{event.location_address}</p>}
          {event.location_address && (
            <a target="_blank" rel="noreferrer"
              href={`https://maps.google.com/?q=${encodeURIComponent(event.location_address)}`}
              className="mt-4 inline-flex rounded-full border px-4 py-2 text-sm hover:bg-accent">
              Ver en mapas
            </a>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <ActionCard slug={slug} to="/e/$slug/rsvp" icon={Heart} label="Confirmar asistencia" />
        <ActionCard slug={slug} to="/e/$slug/gallery" icon={Camera} label="Fotos & videos" />
        <ActionCard slug={slug} to="/e/$slug/messages" icon={MessageCircle} label="Dejar un mensaje" />
      </div>
    </motion.div>
  );
}

function ActionCard({ slug, to, icon: Icon, label }: { slug: string; to: "/e/$slug/rsvp" | "/e/$slug/gallery" | "/e/$slug/messages"; icon: React.ComponentType<{className?: string}>; label: string }) {
  return (
    <Link to={to} params={{ slug }} className="group rounded-2xl border bg-card p-5 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-medium">{label}</p>
    </Link>
  );
}
