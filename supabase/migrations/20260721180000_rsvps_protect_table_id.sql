-- =====================================================================
-- RSVPS — protección de table_id (bypass vía Anonymous Auth)
-- =====================================================================
-- Hallazgo verificado en auditoría final: "GRANT SELECT, INSERT,
-- UPDATE, DELETE ON public.rsvps TO authenticated;"
-- (20260711162751...sql:167) nunca tuvo lista de columnas. La
-- restricción de columnas de 20260716190000_a1f4c9e2...sql:51-52
-- ("REVOKE UPDATE ON public.rsvps FROM anon; GRANT UPDATE (...) TO
-- anon;") solo se aplicó al rol "anon", asumiendo que "el invitado"
-- siempre actúa como ese rol. Desde el sprint de Anonymous Auth, todo
-- invitado que pasa por claim_guest_identity() obtiene una sesión con
-- rol "authenticated" (is_anonymous=true) — el mismo rol que un
-- organizador real, y que nunca perdió el UPDATE sin restricción de
-- columnas. La policy "public update rsvp" deja pasar a estos
-- invitados por diseño (para que editen su propio RSVP), así que
-- podían incluir table_id en el UPDATE (o en el INSERT original,
-- también sin restringir) y asignarse a sí mismos — o a cualquier
-- RSVP no reclamado — a cualquier mesa.
--
-- Por qué NO se corrige con GRANT por columna (como se hizo para
-- "anon"): el rol "authenticated" agrupa tanto a invitados con
-- Anonymous Auth como a organizadores reales (GuestSeatingList.tsx
-- necesita seguir pudiendo actualizar table_id como "authenticated").
-- Un GRANT/REVOKE de columna es por ROL, no distingue fila por fila
-- quién es el organizador — restringir la columna para "authenticated"
-- rompería también al organizador legítimo. Se necesita una
-- verificación que dependa de LA FILA (is_event_owner(event_id)), no
-- del rol — eso es exactamente lo que ya hacen las policies RLS, pero
-- RLS tampoco puede comparar el valor anterior de una columna contra
-- el nuevo dentro de un mismo WITH CHECK. Un trigger BEFORE
-- INSERT/UPDATE sí tiene acceso a OLD y NEW y puede aplicar la regla
-- real: "table_id solo puede fijarse o cambiar si quien escribe es el
-- dueño del evento", reutilizando is_event_owner() ya existente, sin
-- tocar ninguna policy, ningún GRANT, ni claim_guest_identity(),
-- is_own_guest() o guest_is_unclaimed().
-- =====================================================================

CREATE OR REPLACE FUNCTION public.tg_rsvps_protect_table_id()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.table_id IS NULL OR public.is_event_owner(NEW.event_id) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'table_id solo puede ser asignado por el organizador del evento';
  END IF;

  -- UPDATE: sin cambios en table_id, o el organizador del evento.
  IF NEW.table_id IS NOT DISTINCT FROM OLD.table_id OR public.is_event_owner(OLD.event_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'table_id solo puede ser modificado por el organizador del evento';
END;
$$;

DROP TRIGGER IF EXISTS trg_rsvps_protect_table_id ON public.rsvps;
CREATE TRIGGER trg_rsvps_protect_table_id
  BEFORE INSERT OR UPDATE ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.tg_rsvps_protect_table_id();

-- =====================================================================
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_rsvps_protect_table_id ON public.rsvps;
--   DROP FUNCTION IF EXISTS public.tg_rsvps_protect_table_id();
-- =====================================================================
