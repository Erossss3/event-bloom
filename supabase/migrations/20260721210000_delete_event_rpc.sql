-- =====================================================================
-- delete_event() — RPC faltante que "Eliminar evento" ya invocaba
-- =====================================================================
-- Hallazgo: app.events.$id.tsx:362 ya llama a
-- supabase.rpc("delete_event", { event_uuid: id }) desde antes de esta
-- migración, pero la función nunca fue creada — el botón fallaba
-- siempre con "function public.delete_event(uuid) does not exist".
-- Esta migración crea exactamente esa función, con el mismo nombre de
-- parámetro ("event_uuid") que el frontend ya envía, sin tocar ningún
-- otro archivo de frontend.
--
-- Integridad referencial: TODAS las tablas con event_id (event_settings,
-- guests, rsvps, gallery, messages, memories, slideshows, videos,
-- event_visits, event_tables — verificado por grep de
-- "REFERENCES public.events(id)" en todas las migraciones) usan
-- ON DELETE CASCADE. gallery_reactions y slideshow_items no referencian
-- a events directamente, pero cascadean a través de gallery/slideshows,
-- que sí cascadean desde events. rsvps.table_id usa ON DELETE SET NULL
-- hacia event_tables, que a su vez cascadea desde events — al borrarse
-- event_tables en cascada, rsvps.table_id queda en NULL en vez de
-- apuntar a una mesa inexistente (no es una fila huérfana: rsvps sigue
-- existiendo hasta que también cascadea por su propio event_id).
-- Conclusión: un DELETE simple sobre "events" ya elimina, sin ninguna
-- fila huérfana, absolutamente todo lo relacionado en la base — no hace
-- falta (ni es correcto) borrar tabla por tabla a mano.
--
-- Storage: los archivos en los buckets (gallery/memories/exports/covers)
-- no están ligados por foreign key — nada en la base los referencia de
-- forma que un ON DELETE los alcance, y una función SQL no puede
-- invocar la API de Storage. Por eso esta función se limita a los datos
-- de la base (su responsabilidad real); la limpieza de Storage se hace
-- del lado del cliente, en el mismo botón, ANTES de invocar esta RPC
-- (ver app.events.$id.tsx).
--
-- Seguridad: SECURITY DEFINER porque, igual que is_own_guest() y
-- guest_is_unclaimed(), evita cualquier duda sobre RLS al ejecutar el
-- DELETE en cascada — pero la verificación de ownership se hace de
-- forma explícita y redundante: primero con is_event_owner() (función
-- ya existente, sin modificar) para dar un mensaje de error claro, y
-- además el propio DELETE exige "owner_id = auth.uid()" en su WHERE,
-- así que aunque is_event_owner() no existiera, el DELETE por sí solo
-- ya sería seguro. Solo "authenticated": un organizador real nunca es
-- una sesión anónima (mismo criterio ya usado en claim_guest_identity()
-- y en la policy "owner insert event").
-- =====================================================================

CREATE OR REPLACE FUNCTION public.delete_event(event_uuid uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF event_uuid IS NULL THEN
    RAISE EXCEPTION 'event_uuid required';
  END IF;

  IF NOT public.is_event_owner(event_uuid) THEN
    RAISE EXCEPTION 'only the event owner can delete this event';
  END IF;

  DELETE FROM public.events WHERE id = event_uuid AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_event(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_event(uuid) TO authenticated;

-- =====================================================================
-- Rollback: DROP FUNCTION IF EXISTS public.delete_event(uuid);
-- =====================================================================
