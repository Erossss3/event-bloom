import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { LiveMomentsLogo } from "@/components/Logo";
import { BRAND } from "@/lib/branding";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-fade-up">
        <LiveMomentsLogo className="mx-auto h-10" />
        <h1 className="mt-6 font-display text-6xl text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Esta página no existe o el evento no está disponible.</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-gradient-gold px-6 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <LiveMomentsLogo className="mx-auto h-9" />
        <h1 className="mt-6 font-display text-2xl">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-gradient-gold px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Reintentar
          </button>
          <a href="/" className="rounded-full border px-5 py-2 text-sm transition-colors hover:bg-accent">Inicio</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "LiveMoments — Viví y compartí cada evento" },
      { name: "description", content: "Creá tu evento, invitá con QR y viví cada foto, mensaje y recuerdo en tiempo real. Casamientos, 15, cumpleaños y más." },
      { name: "theme-color", content: BRAND.themeColor },
      { name: "application-name", content: BRAND.name },
      { name: "apple-mobile-web-app-title", content: BRAND.name },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { property: "og:site_name", content: BRAND.name },
      { property: "og:title", content: "LiveMoments — Viví y compartí cada evento" },
      { property: "og:description", content: "Creá tu evento, invitá con QR y viví cada foto, mensaje y recuerdo en tiempo real." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: BRAND.social.ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "LiveMoments — Viví y compartí cada evento" },
      { name: "twitter:description", content: "Creá tu evento, invitá con QR y viví cada foto, mensaje y recuerdo en tiempo real." },
      { name: "twitter:image", content: BRAND.social.twitterCard },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: BRAND.favicon.ico, sizes: "any" },
      { rel: "icon", href: BRAND.favicon.png16, sizes: "16x16", type: "image/png" },
      { rel: "icon", href: BRAND.favicon.png32, sizes: "32x32", type: "image/png" },
      { rel: "icon", href: BRAND.favicon.png48, sizes: "48x48", type: "image/png" },
      { rel: "icon", href: BRAND.favicon.png64, sizes: "64x64", type: "image/png" },
      { rel: "icon", href: BRAND.favicon.png128, sizes: "128x128", type: "image/png" },
      { rel: "icon", href: BRAND.favicon.png256, sizes: "256x256", type: "image/png" },
      { rel: "icon", href: BRAND.favicon.png512, sizes: "512x512", type: "image/png" },
      { rel: "apple-touch-icon", href: BRAND.app.appleTouchIcon180, sizes: "180x180" },
      { rel: "manifest", href: BRAND.manifest },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
