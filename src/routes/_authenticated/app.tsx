import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, PlusCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/app", label: "Mis eventos", icon: LayoutDashboard, exact: true },
    { to: "/app/events/new", label: "Nuevo evento", icon: PlusCircle, exact: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/app" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2"><LiveMomentsLogo className="h-10 md:h-14" /></Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  title={n.label}
                  aria-label={n.label}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-2.5 py-2 text-sm transition-colors md:px-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" /> <span className="hidden md:inline">{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <button onClick={signOut} title="Salir" aria-label="Cerrar sesión" className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
