import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/e/$slug/live")({
  component: LiveScreen,
});

function LiveScreen() {
  const { slug } = Route.useParams();
  const [showCursor, setShowCursor] = useState(true);
  const [fade, setFade] = useState(true);
  const [mosaicIndex, setMosaicIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [isVertical, setIsVertical] = useState(false);
  const [style, setStyle] = useState<
    "elegante" | "minimalista" | "fiesta" | "moderno" | "vertical" | "mosaico2" | "mosaico4"
  >("mosaico2");
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
    refetchInterval: 5000,
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
      <div className="absolute inset-0 grid grid-cols-2 gap-1">
        <img
          src={photos[mosaicIndex % photos.length].public_url}
          className="h-full w-full object-cover"
        />

        <img
          src={photos[(mosaicIndex + 1) % photos.length].public_url}
          className="h-full w-full object-cover"
        />
      </div>

    ) : style === "mosaico4" ? (

      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
        {[0, 1, 2, 3].map((offset) => (
          <img
            key={offset}
            src={photos[(mosaicIndex + offset) % photos.length].public_url}
            className="h-full w-full object-cover"
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