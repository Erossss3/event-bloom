import { createFileRoute, Link } from "@tanstack/react-router";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/legal/terminos")({
  head: () => ({ meta: [{ title: "Términos y Condiciones — LiveMoments" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link to="/"><LiveMomentsLogo className="h-8" /></Link>
      <h1 className="mt-8 font-display text-3xl">Términos y Condiciones</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: [COMPLETAR FECHA]</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground/90">
        <p>
          Estos Términos y Condiciones regulan el uso de <strong>LiveMoments</strong>, un servicio para crear
          eventos, invitar por QR y compartir en vivo fotos, mensajes, recuerdos y confirmaciones de asistencia.
          LiveMoments es operado por <strong>[COMPLETAR: razón social / nombre del titular del servicio]</strong>,
          con domicilio en <strong>[COMPLETAR: domicilio legal]</strong>. Al crear una cuenta, crear un evento, o
          participar como invitado de un evento, aceptás estos términos.
        </p>

        <h2 className="font-display text-xl">1. Cuentas de organizador</h2>
        <p>
          Para crear un evento hace falta una cuenta. Sos responsable de la información que cargues sobre tu evento,
          de mantener la confidencialidad de tu contraseña, y de la actividad que ocurra bajo tu cuenta. Las cuentas
          de organizador están destinadas a personas mayores de edad, o a menores con la supervisión y autorización
          de madre, padre o tutor.
        </p>

        <h2 className="font-display text-xl">2. Invitados y acceso por QR</h2>
        <p>
          Los invitados acceden a un evento a través de un link o código QR que el organizador comparte, sin
          necesidad de crear una cuenta propia. Según lo que el organizador habilite, un invitado puede confirmar
          asistencia, subir fotos y videos, y escribir mensajes o recuerdos. El organizador es responsable de
          compartir ese link o QR únicamente con las personas que efectivamente invitó.
        </p>

        <h2 className="font-display text-xl">3. Contenido subido por invitados</h2>
        <p>
          Al subir una foto, un video o escribir un mensaje o recuerdo, declarás que sos su autor o que contás con
          autorización para compartirlo, y que no vulnera derechos de terceros. Le otorgás al organizador del evento
          y a LiveMoments una licencia para almacenar, mostrar dentro del evento y procesar ese contenido con el
          único fin de operar el servicio — incluyendo, si el organizador lo pide, incorporarlo al video resumen del
          evento. Esa licencia no te quita la titularidad sobre lo que subiste.
        </p>
        <p>
          El organizador puede moderar (aprobar o rechazar) el contenido subido por sus invitados antes de que se
          muestre públicamente, según la configuración de moderación que haya elegido para su evento.
        </p>

        <h2 className="font-display text-xl">4. Contenido prohibido</h2>
        <p>
          No está permitido subir contenido ilegal, que viole derechos de terceros, que incluya discurso de odio,
          acoso, contenido sexual que involucre a menores de edad, ni ningún contenido que LiveMoments razonablemente
          considere inapropiado para la plataforma. LiveMoments puede remover contenido que incumpla esto, y el
          organizador puede además moderar y remover cualquier contenido de su propio evento en cualquier momento.
        </p>

        <h2 className="font-display text-xl">5. Responsabilidad del organizador</h2>
        <p>
          El organizador es responsable de: (a) contar con el consentimiento de sus invitados para recolectar sus
          datos de RSVP; (b) contar con las autorizaciones de imagen que correspondan respecto de las personas
          (incluidos menores de edad) que puedan aparecer en el contenido de su evento; y (c) el uso que le dé al
          contenido descargado desde LiveMoments (por ejemplo, el video resumen) fuera de la plataforma.
        </p>

        <h2 className="font-display text-xl">6. Responsabilidad de LiveMoments</h2>
        <p>
          LiveMoments provee la infraestructura para crear, compartir y almacenar contenido de eventos. El servicio
          se presta "tal cual está disponible", sin garantizar disponibilidad ininterrumpida. LiveMoments no es
          responsable por el contenido que organizadores e invitados suban, ni por el uso que le den al link o QR de
          un evento, más allá de las obligaciones de moderación y eliminación descriptas en estos términos y en
          nuestra <Link to="/legal/privacidad" className="underline">Política de Privacidad</Link>.
        </p>

        <h2 className="font-display text-xl">7. Video resumen</h2>
        <p>
          El video resumen es una funcionalidad opcional que el organizador puede solicitar para generar un video a
          partir del contenido ya aprobado de su evento. El organizador es responsable de solicitarlo únicamente
          cuando cuente con las autorizaciones necesarias respecto del contenido que se va a incluir.
        </p>

        <h2 className="font-display text-xl">8. Eliminación de eventos y cuentas</h2>
        <p>
          El organizador puede eliminar un evento desde el panel de administración; esa acción elimina de forma
          permanente el evento y todo su contenido asociado (invitados, confirmaciones, galería, mensajes, recuerdos
          y videos resumen), según se describe en nuestra{" "}
          <Link to="/legal/privacidad" className="underline">Política de Privacidad</Link>. Para solicitar la
          eliminación de una cuenta, ver nuestra{" "}
          <Link to="/legal/eliminar-datos" className="underline">página de eliminación de datos</Link>.
        </p>

        <h2 className="font-display text-xl">9. Propiedad intelectual</h2>
        <p>
          La marca LiveMoments, su logo y el diseño de la plataforma son propiedad de{" "}
          <strong>[COMPLETAR: razón social / nombre del titular del servicio]</strong>. El contenido que organizadores
          e invitados suban sigue siendo de su autoría, sujeto a la licencia descripta en la sección 3.
        </p>

        <h2 className="font-display text-xl">10. Modificaciones</h2>
        <p>
          Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa aplicable.
          Publicaremos cualquier cambio en esta misma página, indicando la fecha de la última actualización.
        </p>

        <h2 className="font-display text-xl">11. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes de <strong>[COMPLETAR: jurisdicción, ej. la República Argentina]</strong>,
          sin perjuicio de los derechos que la normativa de protección al consumidor o de protección de datos de tu
          país de residencia pueda reconocerte de forma imperativa.
        </p>

        <h2 className="font-display text-xl">12. Contacto</h2>
        <p>
          Ante cualquier consulta sobre estos términos, escribinos a <strong>[COMPLETAR: email de contacto]</strong>.
        </p>
      </div>
    </div>
  );
}
