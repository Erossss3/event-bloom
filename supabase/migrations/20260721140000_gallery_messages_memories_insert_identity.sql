-- =====================================================================
-- GALLERY / MESSAGES / MEMORIES — corrección de INSERT (H3)
-- =====================================================================
-- Misma condición graduada que rsvps/guests: mientras el guest_id no
-- esté reclamado, se comporta igual que hoy (compatibilidad); una vez
-- reclamado, is_own_guest(guest_id, event_id) exige que el guest sea
-- de ESE evento y pertenezca a la sesión actual — cierra el vector de
-- inserción cross-tenant para invitados ya migrados (no pueden usar un
-- guest_id propio de otro evento para insertar en uno ajeno).
-- =====================================================================

DROP POLICY IF EXISTS "public upload to event" ON public.gallery;
CREATE POLICY "public upload to event" ON public.gallery FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

DROP POLICY IF EXISTS "public post message" ON public.messages;
CREATE POLICY "public post message" ON public.messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND length(body) BETWEEN 1 AND 1000
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

DROP POLICY IF EXISTS "public create memory" ON public.memories;
CREATE POLICY "public create memory" ON public.memories FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "public upload to event" ON public.gallery;
--   CREATE POLICY "public upload to event" ON public.gallery FOR INSERT TO anon, authenticated
--     WITH CHECK (public.event_accepts_public(event_id));
--
--   DROP POLICY IF EXISTS "public post message" ON public.messages;
--   CREATE POLICY "public post message" ON public.messages FOR INSERT TO anon, authenticated
--     WITH CHECK (public.event_accepts_public(event_id) AND length(body) BETWEEN 1 AND 1000);
--
--   DROP POLICY IF EXISTS "public create memory" ON public.memories;
--   CREATE POLICY "public create memory" ON public.memories FOR INSERT TO anon, authenticated
--     WITH CHECK (public.event_accepts_public(event_id));
-- =====================================================================
