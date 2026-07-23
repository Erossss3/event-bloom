-- FASE 1: Aislamiento de cuentas multiusuario
-- Aditivo: no se elimina ninguna tabla ni se pierden datos. Solo se reemplazan policies.

-- ============================================================
-- 1) EVENTS — separar "acceso propio" de "acceso público" en dos
--    policies explícitas en vez de una sola condición OR combinada.
--    El resultado de permisos es equivalente (Postgres combina policies
--    permisivas del mismo comando con OR), pero queda auditable: cada
--    policy expresa un único motivo de acceso.
-- ============================================================
DROP POLICY IF EXISTS "public can view non-draft events" ON public.events;

CREATE POLICY "owner can view own events" ON public.events FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "public can view non-draft events" ON public.events FOR SELECT TO anon, authenticated
  USING (status <> 'draft');

-- Endurecimiento adicional: aunque la policy de arriba deja la FILA visible
-- (es inevitable si /e/$slug, /e/$slug/live y /r/$slug deben funcionar sin
-- login — RLS filtra filas, no "la forma en que se consultan"), no hace
-- falta que el rol anon reciba la columna owner_id en la respuesta: el
-- frontend público nunca la lee (confirmado por búsqueda en el código),
-- solo identifica al organizador dueño de la fila, sin aportar nada a la
-- experiencia de invitado. Restringimos el GRANT a un set de columnas
-- explícito para anon en vez del SELECT total que tenía antes.
REVOKE SELECT ON public.events FROM anon;
GRANT SELECT (
  id, slug, title, description, cover_url, event_type,
  location_name, location_address, latitude, longitude,
  starts_at, ends_at, timezone, status, theme_color,
  created_at, updated_at
) ON public.events TO anon;

-- Nota importante: esto NO cambia qué filas son técnicamente legibles vía RLS
-- (un evento publicado sigue siendo legible por cualquiera, como ya lo era,
-- porque así deben funcionar /e/$slug, /e/$slug/live y /r/$slug sin login).
-- La protección real contra "ver el panel de otro organizador" se agrega en
-- el código de las rutas administrativas (app.events.$id.tsx y
-- app.events.$id.tables.tsx), que ahora exigen owner_id = usuario actual
-- antes de renderizar cualquier dato, y en el dashboard (app.index.tsx),
-- que ahora filtra explícitamente por owner_id en la propia consulta.


-- ============================================================
-- 2) STORAGE — ownership real en vez de solo bucket_id
--
-- Paths reales usados hoy por la app (confirmados en el código):
--   gallery/{event_id}/{uuid}.ext     (e.$slug.gallery.tsx)
--   memories/{event_id}/{uuid}.ext    (e.$slug.memories.tsx)
--   covers/{user_id}/{slug}.ext       (app.events.new.tsx)
--   exports/...                       (bucket reservado, sin uso actual en el
--                                      frontend; se aplica el mismo criterio
--                                      que gallery/memories por consistencia)
-- No se cambia esta estructura de paths, solo se valida ownership sobre ella.
-- ============================================================

-- GALLERY: la subida pública y la lectura pública quedan igual.
-- Solo se restringe el borrado a que quien borra sea dueño del evento
-- al que pertenece la carpeta (primer segmento del path = event_id).
DROP POLICY IF EXISTS "auth delete gallery" ON storage.objects;
CREATE POLICY "owner delete gallery files" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_event_owner(((storage.foldername(name))[1])::uuid)
  );

-- MEMORIES: mismo criterio que gallery.
DROP POLICY IF EXISTS "auth delete memories" ON storage.objects;
CREATE POLICY "owner delete memories files" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'memories'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_event_owner(((storage.foldername(name))[1])::uuid)
  );

-- COVERS: el path usa el user_id como primer segmento (no event_id), porque
-- la portada se sube al crear el evento, antes/junto con el insert de la fila.
-- Restringimos INSERT/UPDATE/DELETE a que el primer segmento coincida con
-- el usuario autenticado (nadie puede escribir en la carpeta de otro).
DROP POLICY IF EXISTS "auth upload covers" ON storage.objects;
DROP POLICY IF EXISTS "auth manage covers" ON storage.objects;
DROP POLICY IF EXISTS "auth delete covers" ON storage.objects;

CREATE POLICY "owner upload covers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owner update covers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owner delete covers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- EXPORTS: mismo criterio que gallery/memories (event_id como primer segmento).
DROP POLICY IF EXISTS "auth upload exports" ON storage.objects;
DROP POLICY IF EXISTS "auth delete exports" ON storage.objects;

CREATE POLICY "owner upload exports" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_event_owner(((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "owner delete exports files" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_event_owner(((storage.foldername(name))[1])::uuid)
  );


-- ============================================================
-- 3) HALLAZGOS MENORES
-- ============================================================

-- gallery_reactions: el DELETE era USING(true) — cualquiera borraba
-- cualquier reacción de cualquier evento. Se acota a la misma regla que
-- usa el resto de las tablas de invitados: público del evento o dueño.
DROP POLICY IF EXISTS "anyone delete own reactions" ON public.gallery_reactions;
CREATE POLICY "delete reactions of accessible event" ON public.gallery_reactions FOR DELETE TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gallery g
      WHERE g.id = gallery_reactions.gallery_id
        AND (public.event_accepts_public(g.event_id) OR public.is_event_owner(g.event_id))
    )
  );

-- slideshow_items: el SELECT era USING(true) — exponía referencias de
-- gallery_id de cualquier evento, incluso borradores ajenos.
DROP POLICY IF EXISTS "view slideshow items" ON public.slideshow_items;
CREATE POLICY "view slideshow items of accessible event" ON public.slideshow_items FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.slideshows s
      WHERE s.id = slideshow_items.slideshow_id
        AND (public.event_accepts_public(s.event_id) OR public.is_event_owner(s.event_id))
    )
  );

-- ============================================================
-- Forzar recarga del caché de esquema de PostgREST. Los cambios de
-- GRANT/REVOKE/policies no siempre se reflejan de inmediato en la API
-- si este script se corre pegado directo en el SQL Editor (en vez de
-- vía CLI/migraciones) — esto evita esa clase de falso negativo.
-- ============================================================
NOTIFY pgrst, 'reload schema';
