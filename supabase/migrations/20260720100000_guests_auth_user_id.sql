-- =====================================================================
-- Fase 2 — Preparación de base de datos para Anonymous Auth
-- =====================================================================
-- Alcance exacto de esta migración (según el plan aprobado):
--   1) Columna guests.auth_user_id
--   2) Índices para consultas por auth_user_id
--   3) NADA MÁS — ninguna policy nueva, ninguna policy vieja tocada,
--      RSVP/Gallery/Messages/Memories/Storage/frontend sin cambios.
--
-- El modelo viejo (device_token) sigue siendo el único mecanismo activo
-- de autorización después de esta migración. auth_user_id queda como
-- una columna presente pero sin ningún efecto todavía — ninguna policy
-- la lee. Es intencional: esta fase es pura preparación de esquema.
-- =====================================================================

-- auth_user_id es NULLABLE a propósito: los invitados existentes deben
-- quedar con NULL (sin ningún backfill) hasta que el bootstrap de
-- Anonymous Auth (fase posterior) los "reclame" en su próxima visita.
-- ON DELETE SET NULL: si la sesión anónima de un invitado se elimina
-- del lado de Auth, la fila de guests permanece intacta (con su
-- contenido histórico en rsvps/gallery/messages/memories), solo pierde
-- el vínculo — igual criterio que ya usa event_id/guest_id en el resto
-- del esquema para no perder datos ante un borrado en cascada ajeno.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice simple: soporta cualquier lookup futuro de "¿qué guest le
-- corresponde a este auth.uid()?" sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS idx_guests_auth_user_id ON public.guests(auth_user_id);

-- Índice compuesto: es el que usarán las policies de la fase de RSVP
-- (guest_id IN (SELECT id FROM guests WHERE auth_user_id = auth.uid())),
-- filtrando además por evento — coincide con el patrón de acceso real
-- (un invitado, un evento, un auth_user_id).
CREATE INDEX IF NOT EXISTS idx_guests_event_auth_user ON public.guests(event_id, auth_user_id);

-- =====================================================================
-- Rollback (este proyecto no usa migraciones UP/DOWN formales; se deja
-- documentado el equivalente exacto para revertir esta fase a mano):
--
--   DROP INDEX IF EXISTS public.idx_guests_event_auth_user;
--   DROP INDEX IF EXISTS public.idx_guests_auth_user_id;
--   ALTER TABLE public.guests DROP COLUMN IF EXISTS auth_user_id;
--
-- Reversión segura porque, en este punto del plan, ninguna policy ni
-- código de aplicación depende todavía de auth_user_id.
-- =====================================================================
