import { createFileRoute, Outlet, useParams, Link, useRouterState, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { getGuest } from "@/lib/guest-identity";
import { GuestJoinDialog } from "@/components/GuestJoinDialog";
import { Calendar, Camera, Heart, Home, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LiveLockDialog } from "@/components/LiveLockDialog";

export const Route = createFileRoute("/e/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("events")
      .select("id, slug, title, description, cover_url, event_type, location_name, location_address, latitude, longitude, starts_at, ends_at, status, theme_color")
      .eq("slug", params.slug).maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.event.title} — Momento` },
      { name: "description", content: loaderData.event.description ?? "Sumate al evento y viví cada momento." },
      { property: "og:title", content: loaderData.event.title },
      { property: "og:description", content: loaderData.event.description ?? "" },
      ...(loaderData.event.cover_url ? [{ property: "og:image", content: loaderData.event.cover_url }] : []),
    ] : [{ title: "Evento — Momento" }],
  }),
  component: EventLayout,
});

function EventLayout() {
  const { slug } = useParams({ from: "/e/$slug" });
  const { event } = Route.useLoaderData();
  const unlockAt = new Date(
    new Date(event.starts_at).getTime() - 20 * 60 * 1000
  );

  const liveLocked = new Date() < unlockAt;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [joinOpen, setJoinOpen] = useState(false);
  const [guestLoaded, setGuestLoaded] = useState(false);

  useEffect(() => {
    if (event.status === "draft") return;
    const guest = getGuest(event.id);
    setGuestLoaded(true);
    if (!guest) setJoinOpen(true);
  }, [event.id, event.status]);

  // record visit
  useQuery({
    queryKey: ["visit", event.id],
    queryFn: async () => {
      const g = getGuest(event.id);
      await supabase.from("event_visits").insert({ event_id: event.id, guest_id: g?.guestId ?? null });
      return true;
    },
    enabled: guestLoaded && event.status !== "draft",
    staleTime: 5 * 60 * 1000,
  });

  const tabs = [
    { to: "/e/$slug", label: "Inicio", icon: Home, exact: true },
    { to: "/e/$slug/gallery", label: "Galería", icon: Camera, exact: false },
    { to: "/e/$slug/messages", label: "Mensajes", icon: MessageCircle, exact: false },
    { to: "/e/$slug/memories", label: "Recuerdos", icon: Sparkles, exact: false },
  ];

  return (
    <div className="relative min-h-screen bg-background pb-24">
      <div className="relative h-72 overflow-hidden md:h-96">
        {event.cover_url
          ? <img src={event.cover_url} alt="" className="h-full w-full object-cover" />
          : <div className="h-full w-full bg-gradient-hero" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl px-6 pb-8">
          <p className="text-xs uppercase tracking-[0.4em] text-gold">{event.event_type ?? "Evento"}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight md:text-6xl">{event.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{format(new Date(event.starts_at), "d 'de' MMMM · HH:mm", { locale: es })}</span>
            {event.location_name && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{event.location_name}</span>}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-2">
          {tabs.map((t) => {
            const active = t.exact ? pathname === `/e/${slug}` : pathname.startsWith(t.to.replace("$slug", slug));
            return (
              <Link key={t.to} to={t.to} params={{ slug }}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Outlet />
      </div>
      <GuestJoinDialog open={joinOpen} onOpenChange={setJoinOpen} eventId={event.id} eventTitle={event.title} />

      <LiveLockDialog
        open={liveLocked}
        target={unlockAt.toISOString()}
      />
      
      </div>
  )}