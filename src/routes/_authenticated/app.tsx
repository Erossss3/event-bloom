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
      <header className="border-b bg-cream/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/app"><LiveMomentsLogo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={signOut} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
