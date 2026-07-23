-- =====================================================================
-- RLS — límites de longitud en "public create rsvp"
-- =====================================================================
-- Hallazgo (auditoría completa de RLS): a diferencia de "public post
-- message" (que ya exige length(body) BETWEEN 1 AND 1000), "public
-- create rsvp" no tenía ningún límite de longitud en full_name/dietary/
-- note — vector de abuso de recursos (inserts con texto de tamaño
-- arbitrario). Esta corrección es independiente de la migración de
-- identidad de invitado en curso (Anonymous Auth): no requiere
-- auth.uid() ni ninguna verificación de fila, solo acota el tamaño de
-- los datos — por eso se corrige en este paso sin mezclarla con esa
-- migración.
--
-- Verificado antes de escribir esto:
--   - full_name es NOT NULL (columna ya obliga presencia) — se agrega
--     además un techo de longitud.
--   - dietary y note son nullable — se permite NULL, solo se acota su
--     longitud cuando están presentes.
--   - No existe ningún GRANT de columnas restringido para el INSERT de
--     "anon" sobre rsvps (a diferencia del UPDATE) — no hay conflicto
--     de privilegios de columna con este cambio.
-- =====================================================================

DROP POLICY IF EXISTS "public create rsvp" ON public.rsvps;

CREATE POLICY "public create rsvp" ON public.rsvps FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND length(full_name) BETWEEN 1 AND 200
    AND (dietary IS NULL OR length(dietary) <= 500)
    AND (note IS NULL OR length(note) <= 1000)
  );

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "public create rsvp" ON public.rsvps;
--   CREATE POLICY "public create rsvp" ON public.rsvps FOR INSERT TO anon, authenticated
--     WITH CHECK (public.event_accepts_public(event_id));
-- =====================================================================
