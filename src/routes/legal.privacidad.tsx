import { createFileRoute, Link } from "@tanstack/react-router";
import { LiveMomentsLogo } from "@/components/Logo";

export const Route = createFileRoute("/legal/privacidad")({
  head: () => ({ meta: [{ title: "Política de Privacidad — LiveMoments" }] }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link to="/"><LiveMomentsLogo className="h-8" /></Link>
      <h1 className="mt-8 font-display text-3xl">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: [COMPLETAR FECHA]</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground/90">
        <p>
          Este documento describe cómo <strong>LiveMoments</strong> ("LiveMoments", "nosotros") trata los datos
          personales de las personas que usan la plataforma: organizadores de eventos ("organizadores") e invitados
          que participan de un evento a través de un link o código QR ("invitados"). Este documento complementa
          nuestros <Link to="/legal/terminos" className="underline">Términos y Condiciones</Link>.
        </p>
        <p>
          LiveMoments está operado por <strong>[COMPLETAR: razón social / nombre del titular del servicio]</strong>,
          con domicilio en <strong>[COMPLETAR: domicilio legal]</strong>
          {" "}[COMPLETAR: CUIT/CUIL o identificador fiscal equivalente, si corresponde].
          A los efectos de la Ley 25.326 de Protección de Datos Personales de la República Argentina, este sujeto es
          el responsable del tratamiento de los datos descriptos en este documento.
        </p>

        <h2 className="font-display text-xl">1. Qué datos recolectamos</h2>
        <ul>
          <li><strong>Datos de cuenta del organizador:</strong> nombre, email y contraseña (o autenticación con Google) al crear una cuenta.</li>
          <li><strong>Datos del evento:</strong> título, fecha, lugar, descripción e imagen de portada que el organizador carga.</li>
          <li>
            <strong>Datos de RSVP:</strong> nombre completo, cantidad de adultos y niños, restricciones alimentarias y
            notas que un invitado completa al confirmar asistencia. Las restricciones alimentarias pueden constituir
            un dato relacionado con la salud; se recolectan únicamente si el invitado decide completarlas
            voluntariamente, y con la única finalidad de que el organizador pueda planificar el evento.
          </li>
          <li><strong>Contenido de invitados:</strong> fotos, videos, mensajes y recuerdos que los invitados suben o escriben durante el evento.</li>
          <li>
            <strong>Identificación técnica de sesión:</strong> LiveMoments usa autenticación anónima para reconocer a
            un mismo invitado en visitas sucesivas al mismo evento, sin pedirle que cree una cuenta. Esto se apoya en
            un identificador guardado en el almacenamiento local del navegador (ver nuestro{" "}
            <Link to="/legal/cookies" className="underline">Aviso de Cookies y Almacenamiento Local</Link>).
          </li>
          <li><strong>Datos técnicos:</strong> los que genera normalmente la infraestructura que aloja el servicio (por ejemplo, direcciones IP en registros de acceso), con fines de seguridad y disponibilidad.</li>
        </ul>
        <p>LiveMoments no recolecta datos a través de cookies de rastreo publicitario ni utiliza herramientas de analítica de terceros.</p>

        <h2 className="font-display text-xl">2. Para qué usamos estos datos</h2>
        <ul>
          <li>Crear y administrar la cuenta del organizador y sus eventos.</li>
          <li>Permitir que los invitados confirmen asistencia, suban contenido y vean la galería, mensajes y recuerdos del evento.</li>
          <li>Permitir que el organizador descargue, para su propio uso, un archivo ZIP con las fotos y videos aprobados del evento, y un PDF con el listado de confirmaciones de asistencia.</li>
          <li>Generar el video resumen del evento a pedido del organizador, a partir del contenido ya aprobado del evento — ver sección 6.</li>
          <li>Enviar los emails operativos estrictamente necesarios (por ejemplo, recuperación de contraseña).</li>
          <li>Mantener la seguridad del servicio y prevenir usos indebidos.</li>
        </ul>

        <h2 className="font-display text-xl">3. Quién puede ver el contenido de un evento</h2>
        <p>
          El organizador decide, a través de la configuración del evento, si la galería, los mensajes y los
          recuerdos son visibles solo para quien tenga el link/QR del evento, o si además permite que los invitados
          suban contenido y confirmen asistencia. Cualquier persona que acceda al link o código QR de un evento
          público puede ver el contenido que el organizador haya habilitado. LiveMoments no controla con quién el
          organizador comparte ese link o QR — es responsabilidad del organizador distribuirlo únicamente entre las
          personas invitadas al evento.
        </p>

        <h2 className="font-display text-xl">4. Menores de edad</h2>
        <p>
          Es habitual que un evento incluya fotos, videos o menciones de menores de edad (hijos e hijas de
          invitados, festejados/as, etc.). LiveMoments no está dirigido a que menores de edad creen cuentas de
          organizador por sí mismos. La carga de contenido que incluya a menores es responsabilidad de quien lo sube
          (el invitado) y del organizador del evento, quienes deben contar con el consentimiento correspondiente de
          madres, padres o tutores para hacerlo. Cualquier persona puede solicitar la eliminación de contenido que
          identifique a un menor de edad escribiendo a <strong>[COMPLETAR: email de contacto/privacidad]</strong>.
        </p>

        <h2 className="font-display text-xl">5. Derechos de imagen y contenido generado por invitados</h2>
        <p>
          Quien sube una foto, video o mensaje a un evento declara ser su autor o tener autorización para
          compartirlo, y otorga al organizador del evento y a LiveMoments una licencia para almacenarlo, mostrarlo
          dentro del evento y procesarlo con la única finalidad de operar el servicio (incluyendo, si el organizador
          lo solicita, incluirlo en el video resumen del evento). Esa licencia no le quita a quien subió el contenido
          la titularidad sobre él. El organizador del evento es responsable de moderar el contenido subido por sus
          invitados y de contar con los permisos de imagen que correspondan según la relación con sus invitados.
        </p>

        <h2 className="font-display text-xl">6. Video resumen</h2>
        <p>
          El video resumen es un video generado automáticamente a partir de las fotos y mensajes ya aprobados de un
          evento, a pedido del organizador. Su generación no utiliza reconocimiento facial ni ninguna técnica de
          identificación biométrica de las personas que aparecen en las fotos: selecciona y anima el contenido según
          el estilo elegido por el organizador. El archivo resultante se almacena junto con el resto del contenido
          del evento y queda sujeto a las mismas reglas de acceso y eliminación que el resto del contenido.
        </p>

        <h2 className="font-display text-xl">7. Dónde se almacenan los datos</h2>
        <p>
          LiveMoments utiliza proveedores de infraestructura para alojar la base de datos y los archivos subidos
          (fotos, videos, videos resumen). Esos proveedores pueden procesar y almacenar datos en servidores ubicados
          fuera de la República Argentina. Al usar LiveMoments, el organizador y los invitados aceptan esta
          transferencia internacional de datos, realizada con la única finalidad de prestar el servicio.
        </p>

        <h2 className="font-display text-xl">8. Conservación de los datos</h2>
        <p>
          Conservamos los datos de una cuenta y sus eventos mientras la cuenta permanezca activa. Si un organizador
          elimina un evento, se elimina junto con él el contenido asociado (invitados, confirmaciones, fotos,
          mensajes, recuerdos y videos resumen). Los datos pueden persistir por un plazo adicional en copias de
          respaldo técnicas, según la política de retención de backups vigente
          ([COMPLETAR: plazo de conservación de backups]), antes de eliminarse definitivamente.
        </p>

        <h2 className="font-display text-xl">9. Tus derechos</h2>
        <p>
          Como titular de tus datos personales, tenés derecho a acceder a ellos, rectificarlos, actualizarlos o
          solicitar su supresión, en los términos de la Ley 25.326 (Argentina). Si sos usuario ubicado en la Unión
          Europea, además podés ejercer los derechos que te reconoce el Reglamento General de Protección de Datos
          (GDPR), en la medida en que resulte aplicable a tu caso. Podés ejercer estos derechos, o consultar
          cualquier duda, escribiendo a <strong>[COMPLETAR: email de contacto/privacidad]</strong>. Ver también
          nuestra <Link to="/legal/eliminar-datos" className="underline">página de eliminación de datos</Link>.
        </p>
        <p>
          En Argentina, la Agencia de Acceso a la Información Pública (AAIP) es la autoridad de control en materia
          de protección de datos personales y tiene la atribución de atender denuncias y reclamos que interpongan
          quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes.
        </p>

        <h2 className="font-display text-xl">10. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta política para reflejar cambios en el servicio o en la normativa aplicable.
          Publicaremos cualquier cambio en esta misma página, indicando la fecha de la última actualización.
        </p>

        <h2 className="font-display text-xl">11. Contacto</h2>
        <p>
          Ante cualquier consulta sobre esta política o sobre el tratamiento de tus datos, escribinos a{" "}
          <strong>[COMPLETAR: email de contacto]</strong>.
        </p>
      </div>
    </div>
  );
}
