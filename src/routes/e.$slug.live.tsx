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
    }, 5000);

    return () => clearInterval(timer);
  }, [photos]);

  if (!event) {
    return (
      <div className="flex h-screen items-center justify-center text-xl">
        Cargando...
      </div>
    );
  }

  if (!photos?.length) {
    return (
      <div className="flex h-screen items-center justify-center text-xl">
        Todavía no hay fotos.
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black">
      <img
        src={photos[index].public_url}
        className="h-full w-full object-contain"
      />
    </div>
  );
}