-- =====================================================================
-- Identidad de invitado — funciones SECURITY DEFINER
-- =====================================================================
-- Las tres funciones consultan "guests", cuya policy de SELECT hoy es
-- owner-only — sin SECURITY DEFINER, cualquier subconsulta desde el
-- contexto de un invitado devolvería siempre cero filas (mismo problema
-- de recursión ya identificado y corregido en el diseño de este sprint).
-- =====================================================================

-- ¿La fila de guests (p_guest_id, en p_event_id) pertenece a la sesión
-- actual? Solo es verdadero si ya fue reclamada (auth_user_id no nulo)
-- y coincide con auth.uid(). Un guest_id NULL nunca puede ser "propio".
CREATE OR REPLACE FUNCTION public.is_own_guest(p_guest_id uuid, p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guests
    WHERE id = p_guest_id AND event_id = p_event_id
      AND auth_user_id IS NOT NULL AND auth_user_id = auth.uid()
  );
$$;

-- ¿La fila de guests p_guest_id todavía NO fue reclamada por nadie?
-- Es la rama de compatibilidad: mientras sea verdadero, las policies se
-- comportan exactamente igual que antes de esta migración. Un guest_id
-- NULL se considera "no reclamado" (preserva el comportamiento actual
-- para filas sin invitado asociado).
CREATE OR REPLACE FUNCTION public.guest_is_unclaimed(p_guest_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.guests WHERE id = p_guest_id AND auth_user_id IS NOT NULL
  );
$$;

-- Resuelve/crea/reclama la fila de guests para (evento, sesión actual),
-- de forma atómica. Requiere una sesión real (auth.uid() no nulo, sea
-- organizador o Anonymous Auth) y que el evento acepte público.
CREATE OR REPLACE FUNCTION public.claim_guest_identity(
  p_event_id uuid,
  p_device_token text,
  p_first_name text,
  p_last_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_guest_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT public.event_accepts_public(p_event_id) THEN
    RAISE EXCEPTION 'event is not public';
  END IF;
  IF p_device_token IS NULL OR length(trim(p_device_token)) = 0 THEN
    RAISE EXCEPTION 'device_token required';
  END IF;

  -- 1) esta sesión ya reclamó una fila en este evento antes
  SELECT id INTO v_guest_id FROM public.guests
    WHERE event_id = p_event_id AND auth_user_id = v_uid;
  IF v_guest_id IS NOT NULL THEN
    RETURN v_guest_id;
  END IF;

  -- 2) existe una fila vieja (por device_token) todavía sin reclamar —
  --    se reclama para siempre, sin tocar ninguna otra tabla (rsvps,
  --    gallery, messages, memories siguen apuntando al mismo guest_id).
  UPDATE public.guests
    SET auth_user_id = v_uid
    WHERE event_id = p_event_id AND device_token = p_device_token AND auth_user_id IS NULL
    RETURNING id INTO v_guest_id;
  IF v_guest_id IS NOT NULL THEN
    RETURN v_guest_id;
  END IF;

  -- 3) invitado nuevo — se crea ya reclamado. ON CONFLICT cubre la
  --    carrera de dos pestañas insertando al mismo tiempo: si otra
  --    ganó y ya reclamó, no se pisa (el WHERE de la cláusula exige
  --    que siga sin reclamar); si perdió la carrera limpiamente, el
  --    SELECT final debajo recupera el id real, sin duplicar filas
  --    (protegido por UNIQUE(event_id, device_token), ya existente).
  INSERT INTO public.guests (event_id, device_token, auth_user_id, first_name, last_name)
  VALUES (
    p_event_id, p_device_token, v_uid,
    COALESCE(NULLIF(trim(p_first_name), ''), 'Invitado'),
    NULLIF(trim(COALESCE(p_last_name, '')), '')
  )
  ON CONFLICT (event_id, device_token) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
    WHERE public.guests.auth_user_id IS NULL
  RETURNING id INTO v_guest_id;

  IF v_guest_id IS NULL THEN
    SELECT id INTO v_guest_id FROM public.guests
      WHERE event_id = p_event_id AND device_token = p_device_token;
  END IF;

  RETURN v_guest_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_own_guest(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_is_unclaimed(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_identity(uuid, text, text, text) TO anon, authenticated;

-- Rollback:
--   DROP FUNCTION IF EXISTS public.claim_guest_identity(uuid, text, text, text);
--   DROP FUNCTION IF EXISTS public.guest_is_unclaimed(uuid);
--   DROP FUNCTION IF EXISTS public.is_own_guest(uuid, uuid);
