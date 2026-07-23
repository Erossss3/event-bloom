-- =====================================================================
-- STORAGE — límites de tamaño y tipo MIME reforzados del lado del servidor
-- =====================================================================
-- Hallazgo de la auditoría de Release Candidate: MAX_PHOTO_SIZE_MB,
-- MAX_VIDEO_SIZE_MB, MAX_AUDIO_SIZE_MB y MAX_COVER_SIZE_MB (en
-- e.$slug.gallery.tsx, e.$slug.memories.tsx y app.events.new.tsx) solo se
-- validan en el navegador antes de subir. Ningún archivo de migración
-- configura "file_size_limit"/"allowed_mime_types" en storage.buckets —
-- un cliente que llame directamente a la API de Storage puede subir
-- cualquier tamaño o tipo de archivo.
--
-- Esta migración hace cumplir esos mismos límites del lado del servidor,
-- vía las columnas nativas de storage.buckets (mecanismo propio de
-- Supabase Storage, aplicado por el propio servicio de Storage antes de
-- aceptar el archivo — no depende de RLS ni de ninguna función nueva).
-- Se usa UPDATE, no INSERT: estos buckets ya existen (creados fuera de
-- las migraciones de este repo); un UPDATE solo toca las dos columnas en
-- cuestión y no asume ni sobreescribe ningún otro valor de configuración
-- del bucket (público/privado, nombre, etc.) que no se conoce con certeza
-- desde acá. Si el bucket no existiera, el UPDATE no afecta filas — no
-- falla, no crea nada por las dudas.
--
-- Los límites reflejan EXACTAMENTE los que ya declara el frontend, para
-- no cambiar el comportamiento actual: storage.buckets solo admite un
-- único "file_size_limit" por bucket (no puede diferenciar por tipo
-- dentro del mismo bucket), así que se usa el mayor de los límites que
-- ese bucket ya acepta hoy — sigue siendo estrictamente más permisivo que
-- cualquier combinación que el frontend ya permite, nunca más
-- restrictivo, así que no rompe ningún caso de uso existente.
-- =====================================================================

-- gallery: fotos hasta 20MB, videos hasta 300MB (MAX_PHOTO_SIZE_MB /
-- MAX_VIDEO_SIZE_MB en e.$slug.gallery.tsx) -> techo del bucket: 300MB.
UPDATE storage.buckets
SET file_size_limit = 314572800, -- 300 MB
    allowed_mime_types = ARRAY['image/*', 'video/*']
WHERE id = 'gallery';

-- memories: fotos hasta 20MB, videos hasta 300MB, audio hasta 50MB
-- (MAX_PHOTO_SIZE_MB / MAX_VIDEO_SIZE_MB / MAX_AUDIO_SIZE_MB en
-- e.$slug.memories.tsx) -> techo del bucket: 300MB.
UPDATE storage.buckets
SET file_size_limit = 314572800, -- 300 MB
    allowed_mime_types = ARRAY['image/*', 'video/*', 'audio/*']
WHERE id = 'memories';

-- covers: solo imágenes hasta 8MB (MAX_COVER_SIZE_MB y accept="image/*"
-- en app.events.new.tsx).
UPDATE storage.buckets
SET file_size_limit = 8388608, -- 8 MB
    allowed_mime_types = ARRAY['image/*']
WHERE id = 'covers';

-- No se toca "exports" (solo lo escribe el worker con service_role, nunca
-- un cliente) ni "avatars" (sin ningún flujo de subida activo hoy,
-- confirmado en auditorías anteriores) — fuera del alcance de este
-- hallazgo, que es específicamente sobre uploads de clientes.

-- =====================================================================
-- Rollback:
--   UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id = 'gallery';
--   UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id = 'memories';
--   UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id = 'covers';
-- =====================================================================
