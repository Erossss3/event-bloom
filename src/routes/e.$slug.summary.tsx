import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { z } from "zod";

const STYLE_PALETTES: Record<string, string> = {
  wedding: "from-rose-900/50 via-black to-amber-900/40",
  fifteen: "from-fuchsia-900/60 via-black to-pink-900/40",
  birthday: "from-amber-800/60 via-black to-yellow-800/40",
  party: "from-violet-900/70 via-black to-indigo-900/50",
  romantic: "from-rose-800/60 via-black to-orange-800/40",
  cinematic: "from-slate-950 via-slate-900 to-black",
  corporate: "from-neutral-800 via-neutral-900 to-black",
  tropical: "from-emerald-900/60 via-black to-teal-900/40",
};

const search = z.object({
  style: z.string().optional(),
});

export const Route = createFileRoute("/e/$slug/summary")({
  validateSearch: search,

  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select(
        "id, slug, title, cover_url, event_type, starts_at"
      )
      .eq("slug", params.slug)
      .maybeSingle();

    if (!data) {
      throw notFound();
    }

    return {
      event: data,
    };
  },

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Video resumen — ${loaderData.event.title}`
          : "Video resumen",
      },
    ],
  }),

  component: SummaryPage,
});


interface Photo {
  id: string;
  public_url: string;
}


interface Msg {
  id: string;
  author_name: string;
  body: string;
  emoji: string | null;
}


function SummaryCover() {
  return (
    <motion.div
      key="cover"
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        duration: 1,
      }}
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
    >
      <h1 className="font-display text-7xl md:text-9xl leading-tight">
        ✨ Gracias por compartir este momento ✨
      </h1>

      <p className="mt-16 text-lg opacity-70">
        Creado con LiveMoments
      </p>
    </motion.div>
  );
}


function PhotoSlide({
  photo,
  index,
}: {
  photo: Photo;
  index: number;
}) {
  return (
    <motion.img
      key={photo.id}
      src={photo.public_url}
      initial={{
        opacity: 0,
        scale: 1.15,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        x: index % 2 === 0 ? -15 : 15,
        y: index % 3 === 0 ? -10 : 10,
      }}
      exit={{
        opacity: 0,
        scale: 0.96,
      }}
      transition={{
        duration: 4,
        ease: "easeInOut",
      }}
      className="absolute inset-0 h-full w-full object-contain"
    />
  );
}


function MessageCard({
  message,
  frame,
}: {
  message: Msg;
  frame: number;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${message.id}-${frame}`}
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
          }}
          className="mx-auto max-w-3xl"
        >
          <p className="font-display text-2xl md:text-3xl">
            {message.emoji ? `${message.emoji} ` : ""}
            “{message.body}”
          </p>

          <p className="mt-2 text-sm opacity-70">
            — {message.author_name}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


function SummaryPage() {
  const { event } = Route.useLoaderData();
  const { style } = Route.useSearch();

  const palette =
    STYLE_PALETTES[style ?? "wedding"] ??
    STYLE_PALETTES.wedding;


  const [photos, setPhotos] = useState<Photo[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);


  const END_SCREEN = photos.length;
    useEffect(() => {
    async function loadSummaryData() {
      const { data: photoData } = await supabase
        .from("gallery")
        .select("id, public_url")
        .eq("event_id", event.id)
        .eq("moderation", "approved")
        .eq("kind", "photo")
        .order("featured", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        })
        .limit(60);

      setPhotos(photoData ?? []);


      const { data: messageData } = await supabase
        .from("messages")
        .select("id, author_name, body, emoji")
        .eq("event_id", event.id)
        .eq("moderation", "approved")
        .order("featured", {
          ascending: false,
        })
        .limit(20);

      setMessages(messageData ?? []);
    }


    loadSummaryData();
  }, [event.id]);



  useEffect(() => {
    if (photos.length === 0) {
      return;
    }


    let interval:
      ReturnType<typeof setInterval> | undefined;


    const start = setTimeout(() => {
      setCurrentIndex(0);


      interval = setInterval(() => {
        setCurrentIndex((index) => {
          if (index < photos.length - 1) {
            return index + 1;
          }


          return END_SCREEN;
        });
      }, 4200);


    }, 4000);



    return () => {
      clearTimeout(start);

      if (interval) {
        clearInterval(interval);
      }
    };

  }, [photos.length]);



  const currentPhoto =
    currentIndex >= 0 &&
    currentIndex < photos.length
      ? photos[currentIndex]
      : null;



  const currentMessage =
    currentIndex >= 0 &&
    currentIndex % 5 === 4 &&
    messages.length > 0
      ? messages[
          Math.floor(currentIndex / 5) %
            messages.length
        ]
      : null;
      return (
    <div
      className={`fixed inset-0 z-40 bg-gradient-to-br ${palette} text-white`}
    >

      <div className="absolute left-6 top-6 z-10">
        <p className="text-xs uppercase tracking-[0.4em] opacity-70">
          Video resumen · {style ?? "wedding"}
        </p>

        <h1 className="mt-1 font-display text-2xl">
          {event.title}
        </h1>
      </div>


      <AnimatePresence mode="wait">

        {currentIndex === -1 && (
          <SummaryCover />
        )}


        {currentPhoto && (
          <PhotoSlide
            key={currentPhoto.id}
            photo={currentPhoto}
            index={currentIndex}
          />
        )}


        {!currentPhoto &&
          currentIndex >= 0 &&
          currentIndex !== END_SCREEN && (
            <div className="flex h-full items-center justify-center">
              <p className="font-display text-3xl">
                Aún no hay fotos aprobadas para el resumen.
              </p>
            </div>
          )}



        {currentIndex === END_SCREEN && (
          <motion.div
            key="end"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="absolute inset-0 flex items-center justify-center text-center px-8"
          >

            <div>
              <h2 className="font-display text-5xl md:text-7xl">
                Gracias por ser parte
              </h2>

              <p className="mt-6 text-lg opacity-70">
                Revive los mejores momentos de {event.title}
              </p>
            </div>

          </motion.div>
        )}

      </AnimatePresence>


      {currentMessage && (
        <MessageCard
          message={currentMessage}
          frame={currentIndex}
        />
      )}

    </div>
  );
}
