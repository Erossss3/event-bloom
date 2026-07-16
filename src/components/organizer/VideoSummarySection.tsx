import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Download, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { publicSummaryUrl } from "@/lib/public-url";

const STYLES: { id: string; label: string; description: string; palette: string }[] = [
  { id: "wedding", label: "Casamiento", description: "Romántico, cálido, elegante", palette: "from-rose-200 via-amber-100 to-white" },
  { id: "fifteen", label: "15 años", description: "Brillante, moderno, festivo", palette: "from-fuchsia-200 via-pink-100 to-white" },
  { id: "birthday", label: "Cumpleaños", description: "Alegre, colorido, dinámico", palette: "from-amber-200 via-yellow-100 to-white" },
  { id: "party", label: "Fiesta", description: "Energético, vibrante", palette: "from-violet-300 via-indigo-200 to-white" },
  { id: "romantic", label: "Romántico", description: "Suave, íntimo, dorado", palette: "from-rose-300 via-orange-100 to-white" },
  { id: "cinematic", label: "Cinemático", description: "Contrastado, épico", palette: "from-slate-800 via-slate-500 to-slate-200" },
  { id: "corporate", label: "Empresarial", description: "Sobrio, profesional", palette: "from-slate-200 via-neutral-100 to-white" },
  { id: "tropical", label: "Tropical", description: "Vibrante, natural", palette: "from-emerald-300 via-teal-200 to-white" },
];

export function VideoSummarySection({ eventId, slug, finished }: { eventId: string; slug: string; finished: boolean }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("wedding");

  const { data: videos } = useQuery({
    queryKey: ["videos", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("videos")
        .select("*").eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (style: string) => {
      const summaryUrl = publicSummaryUrl(slug, style);
      const { data, error } = await supabase.from("videos").insert({
        event_id: eventId, style, status: "ready", format: "web_slideshow",
        video_url: summaryUrl,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos", eventId] }); toast.success("Video resumen listo"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!finished) {
    return (
      <div className="rounded-2xl border border-dashed bg-cream/40 p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-gold" />
        <p className="mt-3 font-display text-lg">Video resumen</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Disponible cuando finalices el evento. Se generará con las mejores fotos y mensajes destacados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl">Elegí un estilo</h3>
        <p className="text-sm text-muted-foreground">Cada estilo aplica una estética y ritmo distintos a tu resumen.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {STYLES.map((s) => (
          <button key={s.id} onClick={() => setSelected(s.id)}
            className={`overflow-hidden rounded-2xl border-2 text-left transition ${selected === s.id ? "border-gold shadow-elegant" : "border-border"}`}>
            <div className={`h-16 bg-gradient-to-br ${s.palette}`} />
            <div className="p-3">
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.description}</div>
            </div>
          </button>
        ))}
      </div>

      <Button disabled={create.isPending} onClick={() => create.mutate(selected)}
        className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
        {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
        Generar video resumen
      </Button>

      {videos && videos.length > 0 && (
        <ul className="space-y-2">
          {videos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div>
                <div className="font-medium capitalize">{v.style}</div>
                <div className="text-xs text-muted-foreground">Creado {new Date(v.created_at).toLocaleString("es-AR")}</div>
              </div>
              <div className="flex gap-2">
                {v.video_url && (
                  <>
                    <a href={v.video_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs text-background">
                      <Play className="h-3 w-3" /> Reproducir
                    </a>
                    <a href={v.video_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-xs">
                      <Download className="h-3 w-3" /> Compartir link
                    </a>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
