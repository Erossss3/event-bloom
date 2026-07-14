import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/e/$slug/live")({
  component: LiveScreen,
});

function LiveScreen() {
  const { slug } = Route.useParams();
  const [index, setIndex] = useState(0);

  const { data: event } = useQuery({
    queryKey: ["live-event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title")
        .eq("slug", slug)
        .single();

      if (error) throw error;

      return data;
    },
  });

  const { data: photos } = useQuery({
    enabled: !!event,
    queryKey: ["live-photos", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery")
        .select("public_url")
        .eq("event_id", event!.id)
        .eq("moderation", "approved")
        .eq("kind", "photo")
        .order("created_at");

      if (error) throw error;

      return data;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!photos?.length) return;

    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [photos]);

  if (!event) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        Cargando...
      </div>
    );
  }

  if (!photos?.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white text-3xl">
        Todavía no hay fotos.
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">

      <img
        src={photos[index].public_url}
        className="absolute inset-0 h-full w-full object-contain transition-all duration-1000"
      />

      <div className="absolute left-0 top-0 h-40 w-full bg-gradient-to-b from-black/70 to-transparent" />

      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-12">

        <h1 className="text-5xl font-bold">
          {event.title}
        </h1>

        <p className="mt-3 text-xl text-white/70">
          LiveMoments
        </p>

      </div>

    </div>
  );
}