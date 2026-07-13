import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Camera, MessageCircleHeart, QrCode, Sparkles, ArrowRight, Play } from "lucide-react";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LiveMoments — Viví cada evento juntos" },
      { name: "description", content: "Plataforma para casamientos, 15, cumpleaños y eventos corporativos. Invitá con QR, compartí fotos y mensajes en tiempo real, y llevate un video resumen inolvidable." },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  { icon: QrCode, title: "Invitados con QR", desc: "Cada evento genera un QR único. Los invitados se unen escaneando, sin cuenta ni contraseñas." },
  { icon: Camera, title: "Galería colaborativa", desc: "Todos suben fotos y videos en tiempo real. Reacciones, moderación y pantalla en vivo para proyector." },
  { icon: MessageCircleHeart, title: "Mensajes y recuerdos", desc: "Un muro de emociones que queda guardado para siempre." },
  { icon: Sparkles, title: "Video resumen", desc: "Al terminar el evento, generá un video con las mejores fotos y momentos elegidos por IA." },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/"><LiveMomentsLogo /></Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Ingresar</Link>
          <Link to="/auth" className="rounded-full bg-foreground px-5 py-2 text-sm text-background hover:opacity-90">
            Empezar
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-gold">LiveMoments · Eventos memorables</p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-7xl">
              Cada evento merece <span className="italic text-gold">recordarse</span> para siempre.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Casamientos, 15, cumpleaños, corporativos. Creá tu evento, invitá con QR, y viví
              cada foto, mensaje y momento en tiempo real. Al final, llevate un video resumen.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-elegant hover:opacity-95"
              >
                Crear mi evento <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#como-funciona" className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm hover:bg-accent">
                <Play className="h-4 w-4" /> Cómo funciona
              </a>
            </div>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-gold opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent opacity-40 blur-3xl" />
      </section>

      <section id="como-funciona" className="border-t bg-cream/50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="font-display text-4xl md:text-5xl">Todo lo que tu evento necesita</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">Diseñado para funcionar con cientos de invitados conectados al mismo tiempo.</p>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border bg-card p-6 shadow-soft"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="font-display text-4xl md:text-5xl">Listo para tu próximo evento</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          Creá tu evento en 2 minutos. Sin instalaciones. Sin apps para tus invitados.
        </p>
        <Link
          to="/auth"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-gold px-8 py-4 text-sm font-medium text-primary-foreground shadow-elegant"
        >
          Comenzar gratis <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} LiveMoments
      </footer>
    </div>
  );
}
