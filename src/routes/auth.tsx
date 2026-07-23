import { createFileRoute, useNavigate, useSearch, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveMomentsLogo } from "@/components/Logo";
import { Eye, EyeOff } from "lucide-react";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Ingresar — LiveMoments" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSubPage = pathname.endsWith("/forgot-password") || pathname.endsWith("/reset-password");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const goNext = () => navigate({ to: redirect ?? "/app" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/app", data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Ya podés empezar.");
        goNext();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenida de vuelta");
        goNext();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/app`,
        },
      });

      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar con Google");
      setGoogleLoading(false);
    }
  }

  if (isSubPage) {
    return <Outlet />;
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden bg-gradient-hero p-14 md:flex md:flex-col md:justify-between">
        <Link to="/" className="w-fit rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2"><LiveMomentsLogo className="h-14" /></Link>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Para organizadoras</p>
          <h2 className="mt-4 max-w-md font-display text-4xl leading-tight">
            Diseñamos herramientas para que tu evento fluya.
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
          <div>
            <h1 className="font-display text-3xl">{mode === "signin" ? "Ingresá" : "Creá tu cuenta"}</h1>
            <p className="text-sm text-muted-foreground">Accedé a tu panel de organizadora.</p>
          </div>

          <Button type="button" variant="outline" disabled={googleLoading} className="w-full rounded-full" onClick={handleGoogle}>
            <GoogleIcon /> {googleLoading ? "Redirigiendo…" : "Continuar con Google"}
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {mode === "signin" && (
                  <Link
                    to="/auth/forgot-password"
                    className="rounded-sm text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
            <Button type="submit" disabled={loading} className="w-full rounded-full bg-gradient-gold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-70">
              {loading ? "Un momento…" : mode === "signin" ? "Ingresar" : "Crear cuenta"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Al continuar, aceptás los{" "}
            <Link to="/legal/terminos" className="underline underline-offset-2">Términos y Condiciones</Link>{" "}
            y la{" "}
            <Link to="/legal/privacidad" className="underline underline-offset-2">Política de Privacidad</Link>{" "}
            de LiveMoments.
          </p>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <button
              type="button"
              className="rounded-sm font-medium text-foreground underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Registrate" : "Ingresá"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
