-- =====================================================================
-- Corrección de claim_guest_identity — nunca devolver un guest_id ajeno
-- =====================================================================
-- Bug encontrado en la auditoría de seguridad de la función: cuando el
-- device_token recibido ya pertenece a OTRO auth_user_id, el SELECT de
-- respaldo al final de la función devolvía igual el id de esa fila
-- ajena. La fila en sí nunca cambiaba de dueño (is_own_guest() ya
-- protegía cualquier escritura posterior), pero la función no debía
-- devolver ese valor en absoluto.
--
-- Corrección: se reemplaza el SELECT de respaldo incondicional por una
-- verificación explícita. Si la fila existente pertenece a la misma
-- sesión (carrera legítima entre dos pestañas del mismo usuario, ya
-- resuelta por la otra pestaña), se devuelve su id con normalidad. Si
-- pertenece a un auth_user_id distinto, se lanza una excepción en vez
-- de devolver ese id.
--
-- CREATE OR REPLACE es suficiente (la firma de parámetros no cambia) —
-- no hace falta DROP.
-- =====================================================================

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
  v_existing_uid uuid;
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

  -- 2) existe una fila vieja (por device_token) todavía sin reclamar
  UPDATE public.guests
    SET auth_user_id = v_uid
    WHERE event_id = p_event_id AND device_token = p_device_token AND auth_user_id IS NULL
    RETURNING id INTO v_guest_id;
  IF v_guest_id IS NOT NULL THEN
    RETURN v_guest_id;
  END IF;

  -- 3) invitado nuevo — se crea ya reclamado
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

  IF v_guest_id IS NOT NULL THEN
    RETURN v_guest_id;
  END IF;

  -- 4) ni el UPDATE del paso 2 ni el upsert del paso 3 aplicaron: la
  --    fila con ese device_token ya existe con un auth_user_id no nulo
  --    (el paso 1 ya descartó que sea el nuestro). Puede ser:
  --    (a) la misma sesión, reclamada un instante antes por otra
  --        pestaña (carrera legítima) → devolver el id con normalidad.
  --    (b) una identidad distinta → nunca devolver ese id.
  SELECT id, auth_user_id INTO v_guest_id, v_existing_uid
    FROM public.guests
    WHERE event_id = p_event_id AND device_token = p_device_token;

  IF v_existing_uid = v_uid THEN
    RETURN v_guest_id;
  END IF;

  RAISE EXCEPTION 'this device is already associated with another identity';
END;
$$;

-- Principio de mínimo privilegio: quien llama a esta función siempre
-- pasó antes por signInAnonymously() o ya tenía sesión (confirmado:
-- ensureGuestSession() en el frontend siempre garantiza sesión antes
-- de invocar el RPC) — nunca hace falta el rol "anon" puro. Se acota
-- el GRANT a "authenticated" únicamente.
REVOKE EXECUTE ON FUNCTION public.claim_guest_identity(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_identity(uuid, text, text, text) TO authenticated;

-- =====================================================================
-- Rollback: restaurar el GRANT a anon y el cuerpo original de la
-- función (con el SELECT de respaldo incondicional) desde
-- 20260721110000_guest_identity_functions.sql.
-- =====================================================================
