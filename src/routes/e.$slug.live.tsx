import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/e/$slug/live")({
  validateSearch: (search) => ({
    style: typeof search.style === "string" ? search.style : undefined,
  }),
  component: LiveScreen,
});

type LiveStyleKey =
  | "elegante"
  | "minimalista"
  | "fiesta"
  | "moderno"
  | "vertical"
  | "mosaico2"
  | "mosaico4";

// Una única familia de animación para toda la pantalla Live (basada en Elegante):
// zoom muy lento, desplazamiento casi imperceptible, mismo easing, sin rebotes.
// Los distintos nombres de estilo siguen existiendo como distintos LAYOUTS (una
// foto, díptico, grilla de 4), pero ya no tienen personalidades de animación
// distintas entre sí.
const PHOTO_DURATION_MS = 9000;
const PHOTO_FADE_MS = 1800; // crossfade elegante, continuo, sin cortes
const AMBIENT_ANIMATION = "animate-live-ambient";

const LIVE_STYLES: Record<LiveStyleKey, { duration: number; animation: string; fadeMs: number }> = {
  elegante: { duration: PHOTO_DURATION_MS, animation: AMBIENT_ANIMATION, fadeMs: PHOTO_FADE_MS },
  minimalista: { duration: PHOTO_DURATION_MS, animation: AMBIENT_ANIMATION, fadeMs: PHOTO_FADE_MS },
  fiesta: { duration: PHOTO_DURATION_MS, animation: AMBIENT_ANIMATION, fadeMs: PHOTO_FADE_MS },
  moderno: { duration: PHOTO_DURATION_MS, animation: AMBIENT_ANIMATION, fadeMs: PHOTO_FADE_MS },
  vertical: { duration: PHOTO_DURATION_MS, animation: AMBIENT_ANIMATION, fadeMs: PHOTO_FADE_MS },
  mosaico2: { duration: PHOTO_DURATION_MS, animation: "", fadeMs: PHOTO_FADE_MS },
  mosaico4: { duration: PHOTO_DURATION_MS, animation: "", fadeMs: PHOTO_FADE_MS },
};

/** Misma familia de movimiento para cada celda de mosaico, solo cambia la dirección. */
const MOSAIC4_ANIMATIONS = ["animate-live-mosaic-tl", "animate-live-mosaic-tr", "animate-live-mosaic-bl", "animate-live-mosaic-br"];
const MOSAIC4_DRIFT_ONLY = ["animate-live-mosaic-tl-drift", "animate-live-mosaic-tr-drift", "animate-live-mosaic-bl-drift", "animate-live-mosaic-br-drift"];
const MOSAIC2_ANIMATIONS = ["animate-live-diptych-left", "animate-live-diptych-right"];

/** Marco premium sutil para la foto principal: sombra muy suave, borde fino,
 * esquinas apenas redondeadas. Los mosaicos no lo usan (fill completo de la celda). */
const PREMIUM_FRAME = "rounded-[6px] border border-white/10 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.65)]";

/**
 * Una "celda" de la pantalla Live: mantiene la foto anterior debajo (estática, siempre
 * visible) y hace un fundido de la nueva foto por encima. Así nunca hay un instante en
 * negro entre dos fotos (crossfade real, sin parpadeo), a diferencia de fade-out → swap → fade-in.
 *
 * `framed`: modo "foto principal" — la imagen se centra a su tamaño natural (respetando
 * proporciones, sin recortes) dentro de un margen de seguridad, con el marco premium.
 * Si es false (mosaicos), la imagen llena la celda por completo (object-cover), sin marco.
 */
function CrossfadeCell({
  src,
  animationClass,
  previousAnimationClass,
  fadeMs,
  framed = false,
}: {
  src: string;
  animationClass: string;
  previousAnimationClass?: string;
  fadeMs: number;
  framed?: boolean;
}) {
  const [current, setCurrent] = useState(src);
  const [previous, setPrevious] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const cleanupRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (src === current) return;
    setPrevious(current);
    setCurrent(src);
    setEntering(false);
    const raf = requestAnimationFrame(() => setEntering(true));
    clearTimeout(cleanupRef.current);
    cleanupRef.current = setTimeout(() => setPrevious(null), fadeMs + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(cleanupRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (framed) {
    // Sin padding vertical: la foto siempre llena el alto completo, así el
    // fondo desenfocado nunca aparece arriba/abajo — solo a los costados,
    // cuando la foto es más angosta que la pantalla (fotos verticales) o
    // sobra ancho. object-contain "natural" (h-full, w-auto) para que el
    // marco (sombra/borde/radio) hugee el contenido real.
    const imgClass = `h-full w-auto max-w-full object-contain ${PREMIUM_FRAME} transition-opacity ease-in-out`;
    return (
      <div className="absolute inset-0 flex items-center justify-center px-8 sm:px-12 lg:px-[6vmin]">
        {previous && (
          <img
            src={previous}
            alt=""
            style={{ transitionDuration: `${fadeMs}ms` }}
            className={`absolute ${imgClass} ${previousAnimationClass ?? animationClass} transition-opacity ease-in-out ${
              entering ? "opacity-0" : "opacity-100"
            }`}
          />
        )}
        <img
          src={current}
          alt="Foto del evento"
          style={{ transitionDuration: `${fadeMs}ms` }}
          className={`${imgClass} ${animationClass} transition-opacity ease-in-out ${entering || !previous ? "opacity-100" : "opacity-0"}`}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {previous && (
        <img
          src={previous}
          alt=""
          style={{ transitionDuration: `${fadeMs}ms` }}
          className={`absolute inset-0 h-full w-full object-cover object-center ${previousAnimationClass ?? animationClass} transition-opacity ease-in-out ${
            entering ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      <img
        src={current}
        alt="Foto del evento"
        style={{ transitionDuration: `${fadeMs}ms` }}
        className={`absolute inset-0 h-full w-full object-cover object-center ${animationClass} transition-opacity ease-in-out ${
          entering || !previous ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

/**
 * Fondo desenfocado cinematográfico detrás de la foto principal — SIEMPRE
 * presente en layouts de una sola foto (nunca barras negras ni fondo vacío):
 * misma imagen, ampliada ~130%, blur intenso, overlay negro sutil y un
 * degradado radial extra para dar profundidad. `fixed inset-0` puro (nunca
 * mezclado con h-screen/w-screen) para que cubra exactamente el viewport real
 * tanto en ventana normal como en F11 nativo.
 */
function BlurredBackdrop({ src, fadeMs }: { src: string; fadeMs: number }) {
  const [current, setCurrent] = useState(src);
  const [previous, setPrevious] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const cleanupRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (src === current) return;
    setPrevious(current);
    setCurrent(src);
    setEntering(false);
    const raf = requestAnimationFrame(() => setEntering(true));
    clearTimeout(cleanupRef.current);
    cleanupRef.current = setTimeout(() => setPrevious(null), fadeMs + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(cleanupRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const imgClass = "h-full w-full object-cover object-center";
  const imgStyle = { filter: "blur(70px)", transform: "scale(1.3)" } as const;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {previous && (
        <img src={previous} alt="" style={imgStyle} className={`absolute inset-0 ${imgClass}`} />
      )}
      <img
        src={current}
        alt=""
        style={{ ...imgStyle, transitionDuration: `${fadeMs}ms` }}
        className={`absolute inset-0 ${imgClass} transition-opacity ease-in-out ${
          entering || !previous ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="absolute inset-0 bg-black/20" />
      {/* Degradado radial sutil: un poco más oscuro hacia los bordes, generando
          profundidad en vez de un blur plano y uniforme. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.35) 100%)" }}
      />
    </div>
  );
}

function LiveScreen() {
  const { slug } = Route.useParams();
  const search = useSearch({ from: "/e/$slug/live" });
  const [showCursor, setShowCursor] = useState(true);
  const [mosaicIndex, setMosaicIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const qc = useQueryClient();
  const [style] = useState<LiveStyleKey>(
    (LIVE_STYLES[search.style as LiveStyleKey] ? (search.style as LiveStyleKey) : "elegante")
  );

  const currentStyle = LIVE_STYLES[style];
  const isMosaic = style === "mosaico2" || style === "mosaico4";
  const mosaicCount = style === "mosaico4" ? 4 : style === "mosaico2" ? 2 : 0;

  const { data: event, isError: eventError } = useQuery({
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

  // Límite razonable: en eventos con miles de fotos, traer todo el historial completo
  // degrada el rendimiento de la pantalla Live sin aportar nada (solo se muestran unas
  // pocas por vez). 300 alcanza de sobra para un ciclo largo y fluido.
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
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      return data;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!photos?.length) return;

    const timer = setInterval(() => {
      if (mosaicCount > 0) {
        setMosaicIndex((i) => (i + mosaicCount) % photos.length);
      } else {
        setIndex((i) => (i + 1) % photos.length);
      }
    }, currentStyle.duration);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, style]);

  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // El navegador puede requerir interacción del usuario.
      }
    };

    enterFullscreen();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const move = () => {
      setShowCursor(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowCursor(false), 3000);
    };

    move();
    window.addEventListener("mousemove", move);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", move);
    };
  }, []);

  // Precarga de las próximas fotos para que el crossfade nunca tenga que esperar la descarga.
  useEffect(() => {
    if (!photos?.length) return;

    const amount = mosaicCount > 0 ? mosaicCount : 1;
    const base = mosaicCount > 0 ? mosaicIndex : index;

    for (let i = 0; i < amount; i++) {
      const img = new Image();
      img.src = photos[(base + amount + i) % photos.length].public_url;
    }
  }, [index, mosaicIndex, photos, mosaicCount]);

  useEffect(() => {
    if (!event) return;

    const channel = supabase
      .channel(`gallery-${event.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gallery", filter: `event_id=eq.${event.id}` },
        () => { qc.invalidateQueries({ queryKey: ["live-photos", event.id] }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [event, qc]);

  if (!event) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white">
        <LiveMomentsLogo
          variant="light"
          type="horizontal"
          className="h-14 animate-live-loading-logo drop-shadow-2xl"
        />
        <p className="mt-10 text-xs uppercase tracking-[0.45em] text-white/40">
          {eventError ? "Este evento no existe o no está disponible" : "Preparando pantalla"}
        </p>
      </div>
    );
  }

  if (!photos?.length) {
    return (
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-black to-black" />
        <div className="relative z-10 text-center">
          <LiveMomentsLogo variant="light" type="vertical" className="mx-auto h-28 opacity-90" />
          <div className="mt-8 text-5xl">📸</div>
          <h2 className="mt-8 text-3xl font-light text-white">Esperando las primeras fotos</h2>
          <p className="mt-4 text-white/50">Las imágenes aparecerán automáticamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 overflow-hidden bg-black ${
        showCursor ? "cursor-default" : "cursor-none"
      }`}
    >
      {!isMosaic && <BlurredBackdrop src={photos[index].public_url} fadeMs={currentStyle.fadeMs} />}

      {style === "mosaico2" ? (
        // Díptico editorial: dos paneles verticales separados por una línea dorada
        // fina, con el mismo ritmo mínimo — layout propio, no una versión
        // recortada del mosaico de 4. Los mosaicos son la única excepción a los
        // márgenes de seguridad (llenan la pantalla completa).
        <div className="absolute inset-0 flex">
          {[0, 1].map((offset) => (
            <div key={offset} className="relative h-full flex-1">
              <CrossfadeCell
                src={photos[(mosaicIndex + offset) % photos.length].public_url}
                animationClass={MOSAIC2_ANIMATIONS[offset]}
                fadeMs={currentStyle.fadeMs}
              />
            </div>
          ))}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gold/50 to-transparent" />
        </div>
      ) : style === "mosaico4" ? (
        // Cuadrícula 2×2 real: 4 fotos distintas, misma familia de deriva mínima
        // en las 4 celdas (ninguna debe destacar más que las otras).
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[3px] bg-black">
          {[0, 1, 2, 3].map((offset) => (
            <div key={offset} className="relative h-full w-full overflow-hidden">
              <CrossfadeCell
                src={photos[(mosaicIndex + offset) % photos.length].public_url}
                animationClass={MOSAIC4_ANIMATIONS[offset]}
                previousAnimationClass={MOSAIC4_DRIFT_ONLY[offset]}
                fadeMs={currentStyle.fadeMs}
              />
            </div>
          ))}
        </div>
      ) : (
        <CrossfadeCell
          src={photos[index].public_url}
          animationClass={currentStyle.animation}
          fadeMs={currentStyle.fadeMs}
          framed
        />
      )}

      {/* Branding discreto durante la proyección: logo horizontal blanco, chico,
          opacidad baja, con una sombra negra sutil para que se lea sobre
          cualquier fotografía. Sin fondo sólido, sin cajas, sin dependencias
          de análisis de imagen. */}
      <div
        className="pointer-events-none absolute bottom-6 right-8 z-10 opacity-25"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
      >
        <LiveMomentsLogo variant="light" type="horizontal" className="h-5" />
      </div>
    </div>
  );
}
