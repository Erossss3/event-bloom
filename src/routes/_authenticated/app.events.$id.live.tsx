import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/events/$id/live")({
  component: LivePage,
});

function LivePage() {
  const { id } = Route.useParams();

  const { data: event } = useQuery({
    queryKey: ["event-live-admin", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("slug")
        .eq("id", id)
        .single();

      if (error) throw error;

      return data;
    },
  });

  if (!event) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        Cargando...
      </div>
    );
  }

  window.location.replace(`/e/${event.slug}/live`);

  return null;
}