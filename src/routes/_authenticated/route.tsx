import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    // Una sesión de Anonymous Auth (signInAnonymously(), usada por los
    // invitados vía ensureGuestSession()) es una sesión válida a nivel de
    // Supabase Auth — getUser() no da error para ella. is_anonymous es el
    // claim que la distingue de una sesión real de organizador (mismo
    // criterio ya usado del lado del backend en is_anonymous_session()).
    // Debe tratarse exactamente igual que "sin sesión".
    if (error || !data.user || data.user.is_anonymous) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
