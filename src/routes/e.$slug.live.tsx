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
        .select("id")
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
        .order("created_at", { ascending: false });

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
      <div className="flex h-screen items-center justify-center bg-black text-white text-xl">
        Todavía no hay fotos.
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">

      <div className="absolute inset-0 overflow-hidden">
        <img
          src={photos[index].public_url}
          className="
            absolute inset-0
            h-full w-full
            object-cover
            scale-110
            blur-2xl
            opacity-40
          "
        />

        <div className="absolute inset-0 bg-black/30" />
      </div>

      <img
        key={photos[index].public_url}
        src={photos[index].public_url}
        className="
          absolute inset-0
          h-full w-full
          object-contain
          transition-opacity
          duration-1000
        "
      />

      <div
        className="
          absolute
          bottom-6
          right-8
          text-sm
          tracking-widest
          text-white/60
        "
      >
        LiveMoments
      </div>

    </div>
  );
}