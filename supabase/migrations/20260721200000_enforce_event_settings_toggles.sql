-- =====================================================================
-- RSVPS / GALLERY / MESSAGES / MEMORIES — hacer cumplir del lado del
-- servidor los toggles de event_settings (allow_rsvp,
-- allow_guest_uploads, allow_messages, allow_memories)
-- =====================================================================
-- Hallazgo verificado en la auditoría funcional: estos 4 toggles solo
-- afectaban el frontend (o, en el caso de allow_rsvp, ni siquiera eso —
-- e.$slug.rsvp.tsx y r.$slug.tsx nunca lo leían). Ninguna policy de
-- INSERT los consultaba — un invitado con el link directo, o cualquier
-- cliente REST, podía seguir enviando RSVP/fotos/mensajes/recuerdos
-- después de que el organizador desactivara la función correspondiente.
--
-- Corrección: 4 funciones SECURITY DEFINER (una por toggle, mismo
-- criterio que is_own_guest()/guest_is_unclaimed() para no depender de
-- que la sesión que inserta tenga por sí sola acceso de lectura a
-- event_settings) y el agregado de la condición correspondiente a cada
-- una de las 4 policies de INSERT ya existentes. No se toca SELECT,
-- UPDATE ni DELETE de ninguna tabla, ni ninguna otra condición ya
-- presente en estas policies (event_accepts_public, límites de
-- longitud, guest_is_unclaimed/is_own_guest siguen exactamente igual).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.event_allows_rsvp(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT allow_rsvp FROM public.event_settings WHERE event_id = _event_id), true);
$$;

CREATE OR REPLACE FUNCTION public.event_allows_guest_uploads(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT allow_guest_uploads FROM public.event_settings WHERE event_id = _event_id), true);
$$;

CREATE OR REPLACE FUNCTION public.event_allows_messages(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT allow_messages FROM public.event_settings WHERE event_id = _event_id), true);
$$;

CREATE OR REPLACE FUNCTION public.event_allows_memories(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT allow_memories FROM public.event_settings WHERE event_id = _event_id), true);
$$;

-- RSVPS
DROP POLICY IF EXISTS "public create rsvp" ON public.rsvps;
CREATE POLICY "public create rsvp" ON public.rsvps FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND public.event_allows_rsvp(event_id)
    AND length(full_name) BETWEEN 1 AND 200
    AND (dietary IS NULL OR length(dietary) <= 500)
    AND (note IS NULL OR length(note) <= 1000)
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

-- GALLERY
DROP POLICY IF EXISTS "public upload to event" ON public.gallery;
CREATE POLICY "public upload to event" ON public.gallery FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND public.event_allows_guest_uploads(event_id)
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

-- MESSAGES
DROP POLICY IF EXISTS "public post message" ON public.messages;
CREATE POLICY "public post message" ON public.messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND public.event_allows_messages(event_id)
    AND length(body) BETWEEN 1 AND 1000
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

-- MEMORIES
DROP POLICY IF EXISTS "public create memory" ON public.memories;
CREATE POLICY "public create memory" ON public.memories FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND public.event_allows_memories(event_id)
    AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
  );

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "public create rsvp" ON public.rsvps;
--   CREATE POLICY "public create rsvp" ON public.rsvps FOR INSERT TO anon, authenticated
--     WITH CHECK (
--       public.event_accepts_public(event_id)
--       AND length(full_name) BETWEEN 1 AND 200
--       AND (dietary IS NULL OR length(dietary) <= 500)
--       AND (note IS NULL OR length(note) <= 1000)
--       AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
--     );
--
--   DROP POLICY IF EXISTS "public upload to event" ON public.gallery;
--   CREATE POLICY "public upload to event" ON public.gallery FOR INSERT TO anon, authenticated
--     WITH CHECK (
--       public.event_accepts_public(event_id)
--       AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
--     );
--
--   DROP POLICY IF EXISTS "public post message" ON public.messages;
--   CREATE POLICY "public post message" ON public.messages FOR INSERT TO anon, authenticated
--     WITH CHECK (
--       public.event_accepts_public(event_id)
--       AND length(body) BETWEEN 1 AND 1000
--       AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
--     );
--
--   DROP POLICY IF EXISTS "public create memory" ON public.memories;
--   CREATE POLICY "public create memory" ON public.memories FOR INSERT TO anon, authenticated
--     WITH CHECK (
--       public.event_accepts_public(event_id)
--       AND (public.guest_is_unclaimed(guest_id) OR public.is_own_guest(guest_id, event_id))
--     );
--
--   DROP FUNCTION IF EXISTS public.event_allows_rsvp(uuid);
--   DROP FUNCTION IF EXISTS public.event_allows_guest_uploads(uuid);
--   DROP FUNCTION IF EXISTS public.event_allows_messages(uuid);
--   DROP FUNCTION IF EXISTS public.event_allows_memories(uuid);
-- =====================================================================
