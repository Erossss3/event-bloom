import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveMomentsLogo } from "@/components/Logo";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Nueva contraseña — LiveMoments" }] }),
  component: ResetPasswordPage,
});

type LinkStatus = "checking" | "ready" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;

    // Un enlace de recuperación expirado o inválido llega con un error en el
    // hash o en el query string de la URL (Supabase lo agrega directamente) —
    // lo detectamos antes de esperar cualquier otra cosa.
    const hasError = window.location.hash.includes("error=") || window.location.search.includes("error=");
    if (hasError) {
      setStatus("invalid");
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        clearTimeout(timeoutRef.current);
        // Limpiamos el token de la URL: una vez que la sesión de recuperación
        // quedó establecida, no hace falta (ni conviene) dejarlo visible en la
        // barra de direcciones ni en el historial del navegador.
        window.history.replaceState(null, "", window.location.pathname);
        setStatus("ready");
      }
    });

    // Si Supabase ya procesó el enlace antes de que este componente montara
    // el listener, puede que ya haya una sesión activa de recuperación.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session && window.location.hash.includes("type=recovery")) {
        window.history.replaceState(null, "", window.location.pathname);
        setStatus("ready");
      }
    });

    // Si en unos segundos no pasó nada, el enlace no es válido (vencido, ya
    // usado, o se entró directamente a esta página sin pasar por el email).
    timeoutRef.current = setTimeout(() => {
      if (!cancelled) setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 5000);

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada. Ya podés ingresar.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar la contraseña.");
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
            Elegí una contraseña nueva y segura.
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
          {status === "checking" && (
            <div role="status" aria-live="polite" className="space-y-4 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-gold" />
              <p className="text-sm text-muted-foreground">Verificando tu enlace…</p>
            </div>
          )}

          {status === "invalid" && (
            <div role="alert" className="rounded-2xl border bg-card p-6 text-center shadow-soft">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-2xl">Este enlace ya no es válido</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Puede haber expirado o ya haberse usado. Pedí uno nuevo para continuar.
              </p>
              <Link to="/auth/forgot-password">
                <Button type="button" className="mt-6 w-full rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  Pedir un nuevo enlace
                </Button>
              </Link>
            </div>
          )}

          {status === "ready" && (
            <>
              <div>
                <h1 className="font-display text-3xl">Nueva contraseña</h1>
                <p className="mt-1 text-sm text-muted-foreground">Elegí una contraseña nueva para tu cuenta.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      autoFocus
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-r-md"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {confirmPassword.length > 0 && confirmPassword !== password && (
                    <p className="mt-1.5 text-xs text-destructive">Las contraseñas no coinciden.</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-70"
                >
                  {loading ? "Guardando…" : "Guardar nueva contraseña"}
                </Button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
