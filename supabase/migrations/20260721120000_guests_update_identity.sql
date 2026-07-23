-- =====================================================================
-- GUESTS — corrección de "public can update own guest row" (H2)
-- =====================================================================
-- No necesita ninguna función auxiliar para el UPDATE de esta misma
-- tabla: auth_user_id ya está en la propia fila, sin subconsulta ni
-- riesgo de recursión.
--
-- Condición graduada:
--   - auth_user_id IS NULL  → todavía no reclamada, se comporta igual
--     que hoy (compatibilidad total con invitados no migrados).
--   - auth_user_id = auth.uid() → reclamada por esta misma sesión.
--   - is_event_owner(event_id) → el organizador conserva su acceso
--     total (ya lo tenía vía "owner delete guests"/panel de admin;
--     esta tabla no tenía antes una policy de UPDATE para el
--     organizador porque nunca hizo falta — se agrega por completitud
--     y consistencia con el resto de las tablas).
-- =====================================================================

DROP POLICY IF EXISTS "public can update own guest row" ON public.guests;

CREATE POLICY "public can update own guest row" ON public.guests FOR UPDATE TO anon, authenticated
  USING (
    (public.event_accepts_public(event_id) AND (auth_user_id IS NULL OR auth_user_id = auth.uid()))
    OR public.is_event_owner(event_id)
  )
  WITH CHECK (
    (public.event_accepts_public(event_id) AND (auth_user_id IS NULL OR auth_user_id = auth.uid()))
    OR public.is_event_owner(event_id)
  );

-- Rollback:
--   DROP POLICY IF EXISTS "public can update own guest row" ON public.guests;
--   CREATE POLICY "public can update own guest row" ON public.guests FOR UPDATE TO anon, authenticated
--     USING (public.event_accepts_public(event_id));
