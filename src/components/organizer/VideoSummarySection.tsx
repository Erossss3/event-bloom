import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, Share2, Loader2, Wand2, X, RotateCcw, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Los 4 estilos premium de LiveMoments. La estética/ritmo real de cada uno
// se define en la composición de Remotion (remotion/src/styles/*.ts) — acá solo
// se recolecta la preferencia del organizador para el job.
const STYLES: { id: string; label: string; description: string; palette: string }[] = [
  { id: "cinematic", label: "Cinematic", description: "Zoom lento, contraste épico", palette: "from-slate-900 via-slate-700 to-slate-300" },
  { id: "luxury", label: "Luxury", description: "Pausado, dorado, elegante", palette: "from-amber-200 via-yellow-100 to-white" },
  { id: "emotive", label: "Emotive", description: "Cálido, suave, cercano", palette: "from-rose-200 via-orange-100 to-white" },
  { id: "party", label: "Party", description: "Ritmo rápido, vibrante", palette: "from-violet-300 via-fuchsia-200 to-white" },
];

const DURATIONS: { seconds: number; label: string }[] = [
  { seconds: 30, label: "Rápido · 30s" },
  { seconds: 60, label: "Clásico · 60s" },
  { seconds: 90, label: "Extendido · 90s" },
];

type VideoStatus = "pending" | "processing" | "ready" | "failed" | "cancelled";

interface VideoRow {
  id: string;
  style: string;
  duration_seconds: number | null;
  status: VideoStatus;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
} 

const STATUS_LABEL: Record<VideoStatus, string> = {
  pending: "En cola",
  processing: "Generando",
  ready: "Listo",
  failed: "Falló",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<VideoStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-gold/15 text-gold border border-gold/40",
  ready: "bg-accent text-accent-foreground",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function VideoSummarySection({ eventId, finished }: { eventId: string; slug: string; finished: boolean }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("cinematic");
  const [duration, setDuration] = useState<number>(60);

  const { data: videos } = useQuery({
    queryKey: ["videos", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("videos")
        .select("id, style, duration_seconds, status, video_url, thumbnail_url, created_at")
        .eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoRow[];
    },
  });

  // Mismo patrón que gallery.tsx/messages.tsx: se refleja el avance del job
  // (queued -> processing -> completed/failed) sin que el organizador tenga
  // que refrescar la página.
  useEffect(() => {
    const ch = supabase.channel(`videos-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "videos", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["videos", eventId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, qc]);

  const create = useMutation({
    mutationFn: async ({ style, durationSeconds }: { style: string; durationSeconds: number }) => {
      const { data, error } = await (supabase.rpc as any)("request_video_summary", {
        p_event_id: eventId, p_style: style, p_duration_seconds: durationSeconds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos", eventId] }); toast.success("Video resumen en cola"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const cancel = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await (supabase.rpc as any)("cancel_video_summary", { p_video_id: videoId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos", eventId] }); toast.success("Job cancelado"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const retry = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await (supabase.rpc as any)("retry_video_summary", { p_video_id: videoId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos", eventId] }); toast.success("Reintentando"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  async function downloadOrShare(video: VideoRow, action: "download" | "share") {
    if (!video.video_url) {
      toast.error("Este video todavía no está disponible.");
      return;
    }

    try {
      const url = video.video_url;

      if (action === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `resumen-${video.style}.mp4`;
        a.click();
      } else if (navigator.share) {
        await navigator.share({ title: "Video resumen", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos generar el link");
    }
  }

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
        <p className="text-sm text-muted-foreground">Cada estilo aplica una estética y un ritmo distintos a tu resumen.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {STYLES.map((s) => (
          <button key={s.id} type="button" onClick={() => setSelected(s.id)}
            aria-pressed={selected === s.id}
            className={`overflow-hidden rounded-2xl border-2 text-left transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${selected === s.id ? "border-gold shadow-elegant" : "border-border"}`}>
            <div className={`h-16 bg-gradient-to-br ${s.palette}`} />
            <div className="p-3">
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.description}</div>
            </div>
          </button>
        ))}
      </div>

      <div>
        <h3 className="font-display text-xl">Duración</h3>
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-full border bg-card p-1 shadow-soft w-fit">
          {DURATIONS.map((d) => (
            <button
              key={d.seconds}
              type="button"
              onClick={() => setDuration(d.seconds)}
              aria-pressed={duration === d.seconds}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                duration === d.seconds ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <Button disabled={create.isPending} onClick={() => create.mutate({ style: selected, durationSeconds: duration })}
        className="rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0">
        {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
        Generar video resumen
      </Button>
      <p className="text-xs text-muted-foreground">
        El video se genera con el contenido ya aprobado del evento. Solicitalo únicamente si contás con las
        autorizaciones necesarias sobre ese contenido — ver{" "}
        <Link to="/legal/terminos" className="underline underline-offset-2">Términos y Condiciones</Link>.
      </p>

      {videos && videos.filter(v => v.status !== "cancelled").length > 0 && (
        <ul className="space-y-2">
          {videos
            .filter(v => v.status !== "cancelled")
            .map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium capitalize">{v.style}{v.duration_seconds ? ` · ${v.duration_seconds}s` : ""}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${STATUS_STYLE[v.status]}`}>
                    {v.status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {STATUS_LABEL[v.status]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Creado {new Date(v.created_at).toLocaleString("es-AR")}</div>
                {v.status === "failed" && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" /> Error al generar el video
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {(v.status === "pending" || v.status === "processing") && (
                  <button type="button" onClick={() => cancel.mutate(v.id)} disabled={cancel.isPending}
                    className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-xs">
                    <X className="h-3 w-3" /> Cancelar
                  </button>
                )}
                {v.status === "failed" && (
                  <button type="button" onClick={() => retry.mutate(v.id)} disabled={retry.isPending}
                    className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-xs">
                    <RotateCcw className="h-3 w-3" /> Reintentar
                  </button>
                )}
                {v.status === "ready" && (
                  <>
                    <button type="button" onClick={() => downloadOrShare(v, "download")}
                      className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs text-background">
                      <Download className="h-3 w-3" /> Descargar
                    </button>
                    <button type="button" onClick={() => downloadOrShare(v, "share")}
                      className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-xs">
                      <Share2 className="h-3 w-3" /> Compartir
                    </button>
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
