import { createFileRoute, Link } from "@tanstack/react-router";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/legal/eliminar-datos")({
  head: () => ({ meta: [{ title: "Eliminación de datos — LiveMoments" }] }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link to="/"><LiveMomentsLogo className="h-8" /></Link>
      <h1 className="mt-8 font-display text-3xl">Eliminación de datos</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: [COMPLETAR FECHA]</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground/90">
        <p>
          Como titular de tus datos personales, tenés derecho a solicitar el acceso, la rectificación o la supresión
          de los datos que LiveMoments trate sobre vos, en los términos de la Ley 25.326 (Argentina) y, cuando
          corresponda, del Reglamento General de Protección de Datos (GDPR).
        </p>

        <h2 className="font-display text-xl">Si sos organizador</h2>
        <p>
          Podés eliminar un evento completo (junto con sus invitados, confirmaciones, galería, mensajes, recuerdos y
          videos resumen) vos mismo desde el panel de administración del evento, con la opción "Eliminar evento".
          Esa acción es permanente y no se puede deshacer.
        </p>
        <p>
          Si además querés eliminar tu cuenta de organizador, escribinos a{" "}
          <strong>[COMPLETAR: email de contacto/privacidad]</strong> desde el mismo email con el que te registraste,
          indicando que querés eliminar tu cuenta.
        </p>

        <h2 className="font-display text-xl">Si sos invitado</h2>
        <p>
          Si subiste una foto, un video, un mensaje o un recuerdo a un evento y querés que lo eliminemos, podés
          pedírselo directamente al organizador del evento (quien puede moderarlo o eliminarlo), o escribirnos a{" "}
          <strong>[COMPLETAR: email de contacto/privacidad]</strong> indicando el evento y describiendo el contenido
          en cuestión, para que evaluemos tu solicitud.
        </p>
        <p>
          Si completaste una confirmación de asistencia (RSVP) y querés que se elimine, también podés escribirnos a
          la misma dirección.
        </p>

        <h2 className="font-display text-xl">Menores de edad</h2>
        <p>
          Si identificás contenido que muestra a un menor de edad y considerás que fue subido sin el consentimiento
          correspondiente, escribinos a <strong>[COMPLETAR: email de contacto/privacidad]</strong> y le daremos
          prioridad a tu solicitud.
        </p>

        <h2 className="font-display text-xl">Plazos</h2>
        <p>
          Procesamos las solicitudes de eliminación dentro de los plazos que establece la normativa aplicable
          ([COMPLETAR: plazo específico que el titular del servicio se compromete a cumplir]). Parte de la
          información puede persistir temporalmente en copias de respaldo técnicas hasta su ciclo normal de
          renovación, según nuestra{" "}
          <Link to="/legal/privacidad" className="underline">Política de Privacidad</Link>.
        </p>

        <h2 className="font-display text-xl">Autoridad de control</h2>
        <p>
          Si no quedás conforme con nuestra respuesta, en Argentina podés recurrir a la Agencia de Acceso a la
          Información Pública (AAIP) como autoridad de control en materia de protección de datos personales.
        </p>
      </div>
    </div>
  );
}
