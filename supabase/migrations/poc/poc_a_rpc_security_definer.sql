-- =====================================================================
-- PoC A — RPC SECURITY DEFINER sobre el modelo actual de device_token
-- =====================================================================
-- NO reemplaza ninguna policy existente de rsvps/guests. El flujo actual
-- (e.$slug.rsvp.tsx, r.$slug.tsx) sigue funcionando exactamente igual.
-- Estas dos funciones son un camino ALTERNATIVO, aislado, para comparar.
--
-- Diseño: el device_token deja de usarse solo como filtro de conveniencia
-- del cliente y pasa a ser un parámetro obligatorio verificado DENTRO de
-- la función, contra el valor real guardado en `guests`. A diferencia de
-- una policy RLS declarativa, acá SÍ hay una comparación real fila-por-
-- parámetro que no puede sortearse solo con un `id` público.
-- =====================================================================

-- Lee el RSVP propio, identificando al invitado por (event_id, device_token)
-- en vez de por un `id` públicamente legible.
CREATE OR REPLACE FUNCTION public.poc_a_get_own_rsvp(
  p_event_id uuid,
  p_device_token text
)
RETURNS TABLE (
  id uuid, status text, adults int, children int,
  dietary text, dietary_items jsonb, note text, full_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guest_id uuid;
BEGIN
  SELECT g.id INTO v_guest_id
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.device_token = p_device_token;

  IF v_guest_id IS NULL THEN
    RETURN; -- sin filas: dispositivo nunca se unió a este evento
  END IF;

  RETURN QUERY
  SELECT r.id, r.status, r.adults, r.children, r.dietary, r.dietary_items, r.note, r.full_name
  FROM public.rsvps r
  WHERE r.event_id = p_event_id AND r.guest_id = v_guest_id;
END;
$$;

-- Crea o actualiza el RSVP propio. El guest se resuelve/crea siempre por
-- (event_id, device_token) DENTRO de la función — nunca por un `id` que
-- el cliente pueda inventar o copiar de otra fila.
CREATE OR REPLACE FUNCTION public.poc_a_upsert_rsvp(
  p_event_id uuid,
  p_device_token text,
  p_full_name text,
  p_status text,
  p_adults int,
  p_children int,
  p_dietary text,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guest_id uuid;
  v_rsvp_id uuid;
BEGIN
  IF NOT public.event_accepts_public(p_event_id) THEN
    RAISE EXCEPTION 'event is not public';
  END IF;
  IF p_status NOT IN ('confirmed','declined') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  IF length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'full_name required';
  END IF;

  SELECT g.id INTO v_guest_id
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.device_token = p_device_token;

  IF v_guest_id IS NULL THEN
    INSERT INTO public.guests (event_id, device_token, first_name)
    VALUES (p_event_id, p_device_token, split_part(p_full_name, ' ', 1))
    RETURNING id INTO v_guest_id;
  END IF;

  SELECT r.id INTO v_rsvp_id
  FROM public.rsvps r
  WHERE r.event_id = p_event_id AND r.guest_id = v_guest_id;

  IF v_rsvp_id IS NULL THEN
    INSERT INTO public.rsvps (event_id, guest_id, full_name, status, adults, children, dietary, note)
    VALUES (p_event_id, v_guest_id, p_full_name, p_status, p_adults, p_children, p_dietary, p_note)
    RETURNING id INTO v_rsvp_id;
  ELSE
    UPDATE public.rsvps
    SET full_name = p_full_name, status = p_status, adults = p_adults,
        children = p_children, dietary = p_dietary, note = p_note
    WHERE id = v_rsvp_id;
  END IF;

  RETURN v_rsvp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.poc_a_get_own_rsvp(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poc_a_upsert_rsvp(uuid, text, text, text, int, int, text, text) TO anon, authenticated;

-- Nota deliberada: NO se revocan los GRANT/policies directos de rsvps/guests
-- en esta PoC. Un rollout real recién ahí cerraría el acceso directo de
-- anon a esas tablas, dejando la RPC como único camino de escritura.
