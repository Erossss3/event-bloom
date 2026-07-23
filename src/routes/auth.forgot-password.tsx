import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveMomentsLogo } from "@/components/Logo";
import { ArrowLeft, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar contraseña — LiveMoments" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos enviar el correo. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden bg-gradient-hero p-14 md:flex md:flex-col md:justify-between">
        <Link to="/" className="w-fit rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2">
          <LiveMomentsLogo className="h-14" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Para organizadoras</p>
          <h2 className="mt-4 max-w-md font-display text-4xl leading-tight">
            Te ayudamos a recuperar el acceso a tu panel.
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} LiveMoments</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm space-y-6"
        >
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a ingresar
          </Link>

          {sent ? (
            <div role="status" aria-live="polite" className="rounded-2xl border bg-card p-6 text-center shadow-soft">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-2xl">Revisá tu email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Si existe una cuenta con <span className="font-medium text-foreground">{email}</span>, te enviamos un enlace para elegir una nueva contraseña. Puede tardar unos minutos — revisá también la carpeta de spam.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full rounded-full"
                onClick={() => setSent(false)}
              >
                Usar otro email
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-3xl">¿Olvidaste tu contraseña?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ingresá tu email y te mandamos un enlace para crear una nueva.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-70"
                >
                  {loading ? "Enviando…" : "Enviar instrucciones"}
                </Button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
