import { Link } from "@tanstack/react-router";

/**
 * Footer legal — se monta explícitamente en las páginas donde corresponde
 * (landing, login), no en el layout raíz: la pantalla Live y las vistas de
 * evento están pensadas como experiencias inmersivas/a pantalla completa,
 * donde un footer rompería el diseño existente.
 */
export function LegalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-cream/40 px-4 py-8 text-center text-xs text-muted-foreground">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link to="/legal/terminos" className="underline-offset-2 hover:underline">Términos y Condiciones</Link>
        <Link to="/legal/privacidad" className="underline-offset-2 hover:underline">Política de Privacidad</Link>
        <Link to="/legal/cookies" className="underline-offset-2 hover:underline">Cookies</Link>
        <Link to="/legal/eliminar-datos" className="underline-offset-2 hover:underline">Eliminación de datos</Link>
      </nav>
      <p className="mt-3">© {year} LiveMoments</p>
    </footer>
  );
}
