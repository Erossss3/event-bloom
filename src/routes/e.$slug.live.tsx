import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/e/$slug/live")({
  validateSearch: (search) => ({
    style: typeof search.style === "string" ? search.style : undefined,
  }),
    component: LiveScreen,
});

function LiveScreen() {
  const { slug } = Route.useParams();
  const search = useSearch({ from: "/e/$slug/live" });
  const [showCursor, setShowCursor] = useState(true);
  const [fade, setFade] = useState(true);
  const [mosaicIndex, setMosaicIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const qc = useQueryClient();
  const [isVertical, setIsVertical] = useState(false);
  const [loadingScreen, setLoadingScreen] = useState(true);
  const [style, setStyle] = useState<
    "elegante" | "minimalista" | "fiesta" | "moderno" | "vertical" | "mosaico2" | "mosaico4"
  >(
    (search.style as any) ?? "elegante"
  );
  const liveStyles = {
    elegante: {
        duration: 6000,
        animation: "animate-kenburns",
        transition: "duration-2000",
    },

    minimalista: {
      duration: 7000,
      animation: "",
      transition: "duration-3000",
    },

    fiesta: {
      duration: 3000,
      animation: "animate-party",
      transition: "duration-500",
    },

    moderno: {
      duration: 5000,
      animation: "animate-modern",
      transition: "duration-1000",
    },

    vertical: {
        duration: 6000,
        animation: "animate-modern",
        transition: "duration-1500",
    },

    mosaico2: {
      duration: 6000,
      animation: "",
      transition: "duration-1000",
    },

    mosaico4: {
      duration: 6000,
      animation: "",
      transition: "duration-1000",
    },
  };

  const currentStyle = liveStyles[style];

  const isMosaic =
    style === "mosaico2" || style === "mosaico4";

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
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!photos?.length) return;

    const timer = setInterval(() => {
      setFade(false);

      setTimeout(() => {
        if (style === "mosaico2") {
          setMosaicIndex((i) => (i + 2) % photos.length);
        } else if (style === "mosaico4") {
          setMosaicIndex((i) => (i + 4) % photos.length);
        } else {
          setIndex((i) => (i + 1) % photos.length);
        }
        setFade(true);
      }, 1000);
    
    }, currentStyle.duration);

    return () => clearInterval(timer);
  }, [photos]);

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
  
      timer = setTimeout(() => {
        setShowCursor(false);
      }, 3000);
    };

    move();

    window.addEventListener("mousemove", move);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", move);
    };
  }, []);

  useEffect(() => {
    if (!photos?.length) return;

    if (style === "mosaico2" || style === "mosaico4") {
      const amount = style === "mosaico2" ? 2 : 4;

      for (let i = 0; i < amount; i++) {
        const img = new Image();
        img.src = photos[(mosaicIndex + amount + i) % photos.length].public_url;
      }

      return;
    }

    const img = new Image();
    img.src = photos[(index + 1) % photos.length].public_url;
  }, [index, mosaicIndex, photos, style]);

  useEffect(() => {
    if (!photos?.length) return;

    const img = new Image();

    img.onload = () => {
      setIsVertical(img.height > img.width);
    };

    img.src = photos[index].public_url;
  }, [index, photos]);

  useEffect(() => {
    if (!event) return;

    const channel = supabase
      .channel(`gallery-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gallery",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          qc.invalidateQueries({
            queryKey: ["live-photos", event.id],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event, qc]);

  useEffect(() => {
    if (photos?.length) {
      const timer = setTimeout(() => {
        setLoadingScreen(false);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [photos]);

  if (!event) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white">
         <LiveMomentsLogo className="h-20" />

        <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full animate-pulse rounded-full bg-gold" />
        </div>

        <p className="mt-6 text-sm tracking-[0.3em] text-white/60 uppercase">
          Preparando pantalla...
        </p>
      </div>
    );
  }

  if (!photos?.length) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-black">

        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-black to-black" />

        <div className="relative z-10 text-center">

          <div className="animate-breathe text-2xl tracking-[0.4em] text-white/80">
            LiveMoments
          </div>

          <div className="mt-8 text-5xl">
            📸
          </div>

          <h2 className="mt-8 text-3xl font-light text-white">
            Esperando las primeras fotos
          </h2>

          <p className="mt-4 text-white/50">
            Las imágenes aparecerán automáticamente.
          </p>

        </div>
  
      </div>
    );
  }

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden bg-black ${
        showCursor ? "cursor-default" : "cursor-none"
      }`}
    >
      {!isMosaic && (
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
      )}
  
    {style === "mosaico2" ? (
      <div className={` absolute inset-0 grid grid-cols-2 gap-1 transition-opacity duration-1000 ${fade ? "opacity-100" : "opacity-0"} `}>
        <img
          src={photos[mosaicIndex % photos.length].public_url}
          className={` h-full w-full object-cover animate-kenburns ${fade ? "opacity-100" : "opacity-0"} transition-opacity duration-1000 `}
        />

        <img
          src={photos[(mosaicIndex + 1) % photos.length].public_url}
          className={` h-full w-full object-cover animate-kenburns ${fade ? "opacity-100" : "opacity-0"} transition-opacity duration-1000 `}
        />
      </div>

    ) : style === "mosaico4" ? (

      <div className={` absolute inset-0 grid grid-cols-2 gap-1 transition-opacity duration-1000 ${fade ? "opacity-100" : "opacity-0"} `}>
        {[0, 1, 2, 3].map((offset) => (
          <img
            key={offset}
            src={photos[(mosaicIndex + offset) % photos.length].public_url}
            className={` h-full w-full object-cover animate-kenburns ${fade ? "opacity-100" : "opacity-0"} transition-opacity duration-1000 `}
          />
        ))}
      </div>

    ) : (

      <img
        src={photos[index].public_url}
        className={`
          absolute inset-0
          h-full w-full
          ${
            currentStyle.animation ||
            (isVertical
              ? "animate-pan-vertical"
              : "animate-pan-horizontal")
          }
          object-contain
          ${currentStyle.transition}
          ${fade ? "opacity-100" : "opacity-0"}
          transition-opacity 
        `}
      />
    
        )}

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