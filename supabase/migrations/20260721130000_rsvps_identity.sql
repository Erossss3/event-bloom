-- =====================================================================
-- RSVPS — corrección de identidad (H1)
-- =====================================================================
-- Hallazgo crítico verificado antes de escribir esto: GuestSeatingList
-- (asignación de mesas del organizador) actualiza rsvps a través de
-- ESTA MISMA policy de UPDATE — no existe ninguna policy separada para
-- el organizador en esta tabla. La condición nueva agrega
-- "OR is_event_owner(event_id)" explícitamente para no romper esa
-- función.
--
-- Misma condición graduada que en guests: fila no reclamada → igual
-- que antes; fila reclamada → exige is_own_guest(guest_id, event_id)
-- (usa la función SECURITY DEFINER porque "guests" tiene su propia RLS
-- restringida — sin ella, la subconsulta vería siempre cero filas).
-- =====================================================================

-- SELECT: además de la condición existente, se acota a la fila propia
-- una vez reclamada (cierra también el lado de lectura de H1, no solo
-- la escritura) — el organizador conserva visibilidad total.
DROP POLICY IF EXISTS "public view rsvps of event" ON public.rsvps;

CREATE POLICY "public view rsvps of event" ON public.rsvps FOR SELECT TO anon, authenticated
  USING (
    public.is_event_owner(event_id)
    OR (
      public.event_accepts_public(event_id)
      AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
    )
  );

-- INSERT: se mantienen los límites de longitud ya agregados, sumando
-- la verificación de identidad con la misma condición graduada.
DROP POLICY IF EXISTS "public create rsvp" ON public.rsvps;

CREATE POLICY "public create rsvp" ON public.rsvps FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND length(full_name) BETWEEN 1 AND 200
    AND (dietary IS NULL OR length(dietary) <= 500)
    AND (note IS NULL OR length(note) <= 1000)
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

-- UPDATE: la corrección central de H1.
DROP POLICY IF EXISTS "public update rsvp" ON public.rsvps;

CREATE POLICY "public update rsvp" ON public.rsvps FOR UPDATE TO anon, authenticated
  USING (
    public.is_event_owner(event_id)
    OR (
      public.event_accepts_public(event_id)
      AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
    )
  )
  WITH CHECK (
    public.is_event_owner(event_id)
    OR (
      public.event_accepts_public(event_id)
      AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
    )
  );

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "public view rsvps of event" ON public.rsvps;
--   CREATE POLICY "public view rsvps of event" ON public.rsvps FOR SELECT TO anon, authenticated
--     USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
--
--   DROP POLICY IF EXISTS "public create rsvp" ON public.rsvps;
--   CREATE POLICY "public create rsvp" ON public.rsvps FOR INSERT TO anon, authenticated
--     WITH CHECK (
--       public.event_accepts_public(event_id)
--       AND length(full_name) BETWEEN 1 AND 200
--       AND (dietary IS NULL OR length(dietary) <= 500)
--       AND (note IS NULL OR length(note) <= 1000)
--     );
--
--   DROP POLICY IF EXISTS "public update rsvp" ON public.rsvps;
--   CREATE POLICY "public update rsvp" ON public.rsvps FOR UPDATE TO anon, authenticated
--     USING (public.event_accepts_public(event_id));
-- =====================================================================
