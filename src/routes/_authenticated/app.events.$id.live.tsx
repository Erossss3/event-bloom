import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Tv, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/events/$id/live")({
  component: LiveAdminPage,
});

const STYLES = [
  { id: "wedding", name: "💍 Elegante" },
  { id: "cinematic", name: "🎬 Cinemático" },
  { id: "romantic", name: "❤️ Romántico" },
  { id: "party", name: "🎉 Fiesta" },
  { id: "birthday", name: "🎂 Cumpleaños" },
  { id: "tropical", name: "🌴 Tropical" },
];

function LiveAdminPage() {
  const { id } = Route.useParams();

  const [style, setStyle] = useState("wedding");

  const { data: event } = useQuery({
    queryKey: ["event-live", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("slug,title")
        .eq("id", id)
        .single();

      if (error) throw error;

      return data;
    },
  });

  function openLive() {
    if (!event) return;

    window.open(
      `/e/${event.slug}/live?style=${style}`,
      "_blank"
    );
  }

  if (!event) {
    return (
      <div className="h-64 animate-pulse rounded-3xl bg-muted" />
    );
  }

  return (
    <div className="space-y-8">

      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold">
          Pantalla en vivo
        </p>

        <h1 className="mt-2 font-display text-4xl">
          {event.title}
        </h1>

        <p className="mt-2 text-muted-foreground">
          Elegí el estilo con el que se mostrarán las fotos en la pantalla.
        </p>
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-soft">

        <h2 className="font-display text-2xl">
          Estilo
        </h2>

        <div className="mt-6 grid gap-3 md:grid-cols-2">

          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`rounded-2xl border p-5 text-left transition ${
                style === s.id
                  ? "border-primary bg-primary/10"
                  : "hover:border-primary/40"
              }`}
            >
              <div className="font-medium">
                {s.name}
              </div>
            </button>
          ))}

        </div>

        <Button
          onClick={openLive}
          className="mt-8 rounded-full"
        >
          <Tv className="mr-2 h-4 w-4" />
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir pantalla en vivo
        </Button>

      </div>

    </div>
  );
}