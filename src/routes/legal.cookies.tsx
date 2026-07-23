import { createFileRoute, Link } from "@tanstack/react-router";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({ meta: [{ title: "Aviso de Cookies — LiveMoments" }] }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link to="/"><LiveMomentsLogo className="h-8" /></Link>
      <h1 className="mt-8 font-display text-3xl">Aviso de Cookies y Almacenamiento Local</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: [COMPLETAR FECHA]</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground/90">
        <p>
          LiveMoments <strong>no utiliza cookies de rastreo publicitario</strong> ni herramientas de analítica de
          terceros. Lo que sí usamos es el <strong>almacenamiento local del navegador (localStorage)</strong>,
          exclusivamente para hacer funcionar el servicio:
        </p>
        <ul>
          <li>
            <strong>Sesión de organizador:</strong> si creaste una cuenta, guardamos tu sesión de forma local para
            que no tengas que volver a iniciar sesión cada vez que abrís la aplicación.
          </li>
          <li>
            <strong>Identidad de invitado por evento:</strong> cuando participás de un evento (confirmás asistencia,
            subís una foto, escribís un mensaje), guardamos un identificador local para reconocerte si volvés a
            entrar al mismo evento desde el mismo navegador — por ejemplo, para mostrarte tu propia confirmación de
            RSVP ya cargada.
          </li>
        </ul>
        <p>
          Estos datos se guardan únicamente en tu propio dispositivo, no se comparten con terceros con fines
          publicitarios, y son estrictamente necesarios para el funcionamiento del servicio — por eso no mostramos un
          banner pidiendo tu consentimiento previo para usarlos, tal como lo permiten las guías vigentes sobre
          almacenamiento estrictamente necesario.
        </p>
        <p>
          Podés borrar esta información en cualquier momento desde la configuración de tu navegador (borrando los
          datos de sitio / almacenamiento local de livemoments-ruddy.vercel.app). Al hacerlo, tu sesión de
          organizador se cerrará, y dejaremos de reconocerte automáticamente como el mismo invitado en los eventos
          en los que hayas participado desde ese navegador.
        </p>
        <p>
          Para más información sobre qué datos personales tratamos y con qué finalidad, consultá nuestra{" "}
          <Link to="/legal/privacidad" className="underline">Política de Privacidad</Link>.
        </p>
      </div>
    </div>
  );
}
