import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Search, ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/events/$id/messages")({
  // Misma validación explícita que Mesas/Detalle del evento: no alcanza con
  // que RLS permita leer el evento (necesario para el flujo público) — acá
  // exigimos ownership real antes de renderizar.
  loader: async ({ params }) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw notFound();

    const { data, error } = await supabase
      .from("events")
      .select("id")
      .eq("id", params.id)
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (error || !data) throw notFound();
  },
  head: () => ({ meta: [{ title: "Mensajes — LiveMoments" }] }),
  component: EventMessagesPage,
});

type SortOrder = "recent" | "oldest";

interface MessageRow {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  featured: boolean;
}

/**
 * Una tarjeta = una carta. El destacado se siente como "guardar este
 * recuerdo", no como una acción de moderación: un corazón chico y discreto,
 * dorado solo cuando está guardado, sin caja ni fondo sólido alrededor.
 */
function MessageCard({
  message,
  onToggleFeatured,
  isToggling,
}: {
  message: MessageRow;
  onToggleFeatured: (message: MessageRow) => void;
  isToggling?: boolean;
}) {
  const initial = message.author_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      tabIndex={0}
      className={`group relative rounded-[2rem] border bg-card p-8 shadow-soft transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-elegant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:p-10 ${
        message.featured ? "border-gold/50" : "border-border/60"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleFeatured(message)}
        disabled={isToggling}
        aria-label={message.featured ? "Quitar de recuerdos guardados" : "Guardar este recuerdo"}
        aria-pressed={message.featured}
        title={message.featured ? "Quitar de recuerdos guardados" : "Guardar este recuerdo"}
        className="absolute right-6 top-6 rounded-full p-1.5 text-muted-foreground/50 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 sm:right-8 sm:top-8"
      >
        <Heart className={`h-4 w-4 transition-colors ${message.featured ? "fill-gold text-gold" : ""}`} />
      </button>

      <div className="flex items-start gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-gold font-display text-lg tracking-wide text-primary-foreground shadow-elegant">
          {initial}
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-display text-xl">{message.author_name}</p>
            <time dateTime={message.created_at} className="shrink-0 text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground/70">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: es })}
            </time>
          </div>

          {/* Separación clara entre quién escribe y lo que escribió — la
              carta empieza acá, no pegada al nombre. */}
          <p className="mt-5 max-w-prose whitespace-pre-wrap font-display text-[1.05rem] leading-[1.9] text-foreground/90">
            {message.body}
          </p>
        </div>
      </div>
    </motion.li>
  );
}

function EventMessagesPage() {
  const { id } = useParams({ from: "/_authenticated/app/events/$id/messages" });
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<SortOrder>("recent");

  // Encabezado liviano, mismo patrón que app.events.$id.tables.tsx: solo lo
  // necesario para el título/link de "volver", no todo el detalle del evento.
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event-messages-header", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, title").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  // Misma tabla `messages` que ya usa AdminMessages dentro del evento — acá
  // solo se pide el listado completo con diseño de lectura en vez de moderación.
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["event-messages-full", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, author_name, body, created_at, featured")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
  });

  // Mismo patrón de useMutation + invalidateQueries + toast que ya usan
  // TablesGrid/GuestSeatingList/VideoSummarySection en este mismo proyecto —
  // no una función suelta como en AdminMessages (esa vive en otro componente,
  // con su propio estado local, no con React Query).
  const toggleFeatured = useMutation({
    mutationFn: async (message: MessageRow) => {
      const { error } = await supabase
        .from("messages")
        .update({ featured: !message.featured })
        .eq("id", message.id);
      if (error) throw error;
      return !message.featured;
    },
    onSuccess: (nowFeatured) => {
      qc.invalidateQueries({ queryKey: ["event-messages-full", id] });
      toast.success(nowFeatured ? "Recuerdo guardado" : "Quitado de recuerdos guardados");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar el mensaje"),
  });

  const { featuredList, restList } = useMemo(() => {
    let list = messages ?? [];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) => m.author_name.toLowerCase().includes(q) || m.body.toLowerCase().includes(q)
      );
    }
    if (order === "oldest") {
      list = [...list].reverse();
    }
    // Dentro de cada grupo se respeta el orden de fecha ya elegido (más
    // recientes o más antiguos primero) — solo cambia cómo se agrupan y
    // presentan visualmente, no el orden de los datos en sí.
    return {
      featuredList: list.filter((m) => m.featured),
      restList: list.filter((m) => !m.featured),
    };
  }, [messages, query, order]);

  const filteredTotal = featuredList.length + restList.length;

  const loaded = !eventLoading && !messagesLoading;
  const total = messages?.length ?? 0;
  const featuredCount = messages?.filter((m) => m.featured).length ?? 0;
  // messages ya viene ordenado por created_at desc desde la query, sin
  // importar el orden que haya elegido el usuario en la UI — el primero
  // siempre es el más reciente de verdad.
  const lastMessageAt = messages?.[0]?.created_at;

  return (
    <div className="mx-auto max-w-2xl space-y-12 px-4 py-10 md:px-6">
      <div>
        <Link
          to="/app/events/$id"
          params={{ id }}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al evento
        </Link>

        {/* Portada del libro: título, nombre del evento y una frase que
            enmarca lo que sigue como algo para atesorar, no para administrar. */}
        <div className="mt-6 rounded-[2rem] border bg-gradient-to-b from-card to-cream/40 p-8 text-center shadow-soft sm:p-12">
          <p className="text-4xl">💌</p>
          <h1 className="mt-4 font-display text-4xl">Libro de recuerdos</h1>
          {event?.title && <p className="mt-2 font-display text-lg text-muted-foreground">{event.title}</p>}
          <p className="mx-auto mt-5 max-w-sm text-sm italic text-muted-foreground">
            Cada mensaje es una página de esta historia — guardá las que quieras volver a leer siempre.
          </p>

          {loaded && (
            <div className="mx-auto mt-8 flex w-fit items-center gap-8 border-t pt-6">
              <div>
                <p className="font-display text-2xl">{total}</p>
                <p className="text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">
                  {total === 1 ? "mensaje" : "mensajes"}
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="font-display text-2xl text-gold">{featuredCount}</p>
                <p className="text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground">
                  {featuredCount === 1 ? "guardado" : "guardados"}
                </p>
              </div>
            </div>
          )}

          {loaded && lastMessageAt && (
            <p className="mt-5 text-xs text-muted-foreground/70">
              Último mensaje recibido {formatDistanceToNow(new Date(lastMessageAt), { addSuffix: true, locale: es })}.
            </p>
          )}
        </div>
      </div>

      {loaded && total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o contenido…"
              aria-label="Buscar mensajes por nombre o contenido"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 rounded-full border bg-card p-1 shadow-soft">
            {([
              ["recent", "Más recientes"],
              ["oldest", "Más antiguos"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOrder(value)}
                aria-pressed={order === value}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  order === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loaded ? (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[2rem] bg-muted/40" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="rounded-[2rem] border border-dashed bg-cream/40 px-10 py-20 text-center">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gold/10" />
            <Mail className="h-9 w-9 text-gold/70" />
            <Heart className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 text-gold shadow-soft" />
          </div>
          <p className="mt-6 font-display text-2xl">Un libro esperando ser escrito</p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
            Todavía no llegó ningún mensaje. En cuanto tus invitados dejen los suyos, cada uno va a abrir una página nueva acá.
          </p>
        </div>
      ) : filteredTotal === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Ningún mensaje coincide con "{query}".
        </p>
      ) : (
        <div className="space-y-12">
          {featuredList.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-gold">
                <Heart className="h-4 w-4 fill-gold" />
                <h2 className="font-display text-lg tracking-wide">Recuerdos guardados</h2>
              </div>
              <ul className="space-y-6">
                <AnimatePresence initial={false}>
                  {featuredList.map((m) => (
                    <MessageCard
                      key={m.id}
                      message={m}
                      onToggleFeatured={(msg) => toggleFeatured.mutate(msg)}
                      isToggling={toggleFeatured.isPending && toggleFeatured.variables?.id === m.id}
                    />
                  ))}
                </AnimatePresence>
              </ul>

              {/* Separador elegante entre los recuerdos guardados y el resto
                  del libro — nada de una línea dura, sino un degradé sutil
                  con el mismo dorado de marca. */}
              <div className="flex items-center gap-4 pt-4 text-muted-foreground/50">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
                <p className="shrink-0 text-[0.7rem] uppercase tracking-[0.25em]">Todos los mensajes</p>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
              </div>
            </section>
          )}

          <ul className="space-y-6">
            <AnimatePresence initial={false}>
              {restList.map((m) => (
                <MessageCard
                  key={m.id}
                  message={m}
                  onToggleFeatured={(msg) => toggleFeatured.mutate(msg)}
                  isToggling={toggleFeatured.isPending && toggleFeatured.variables?.id === m.id}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}
