-- =====================================================================
-- Anonymous Auth — corrección de "owner insert event"
-- =====================================================================
-- Hallazgo (auditoría Paso 1): esta policy solo verificaba
-- "auth.uid() = owner_id" — cualquier sesión con rol authenticated,
-- incluida una sesión anónima de Supabase Auth, podía crear un evento
-- asignándose a sí misma como owner_id. Es la única policy de INSERT
-- sobre "events" (confirmado: ninguna otra existe para esta operación).
--
-- Verificado antes de escribir esto:
--   - Solo hay una policy de INSERT sobre events ("owner insert event").
--   - DROP + CREATE con el mismo nombre reemplaza la policy sin dejar
--     dos activas para la misma operación.
--   - No se toca ninguna policy de UPDATE/DELETE/SELECT.
-- =====================================================================

DROP POLICY IF EXISTS "owner insert event" ON public.events;

CREATE POLICY "owner insert event" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND NOT public.is_anonymous_session());

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "owner insert event" ON public.events;
--   CREATE POLICY "owner insert event" ON public.events FOR INSERT TO authenticated
--     WITH CHECK (auth.uid() = owner_id);
-- =====================================================================
