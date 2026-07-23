-- =====================================================================
-- GALLERY / MESSAGES / MEMORIES — bloqueo de columnas moderation/
-- featured/uploaded_by_owner en INSERT (bypass de moderación)
-- =====================================================================
-- Hallazgo verificado en auditoría final: el GRANT INSERT sobre estas
-- tres tablas nunca tuvo lista de columnas — "GRANT SELECT, INSERT ON
-- public.gallery TO anon;" (20260711162751...sql:196), ídem para
-- messages (:238) y memories (:264), y el GRANT INSERT para
-- "authenticated" (:194/:236/:262) tampoco restringe columnas. Como
-- "moderation" (DEFAULT 'approved') y "featured" (DEFAULT false, solo
-- existe en gallery y messages) no tienen ningún trigger ni policy que
-- las valide, un cliente podía incluirlas explícitamente en el payload
-- del INSERT y forzar su propio valor: publicar contenido ya
-- "approved" saltando la cola de moderación, o auto-destacar su propio
-- contenido.
--
-- Verificado antes de escribir esto (sin asumir nada):
--   - grep exhaustivo de los únicos 3 INSERT reales sobre estas tablas
--     en todo el frontend:
--       gallery:   e.$slug.gallery.tsx:108  → event_id, guest_id, kind,
--                  storage_path, public_url
--       messages:  e.$slug.messages.tsx:76  → event_id, guest_id,
--                  author_name, body, emoji
--       memories:  e.$slug.memories.tsx:98  → event_id, guest_id,
--                  author_name, text_content, media_url, media_kind
--     Ninguno de los tres envía moderation, featured ni
--     uploaded_by_owner.
--   - "featured" solo se escribe hoy vía UPDATE, exclusivamente por el
--     organizador (AdminGallery.tsx:33 y AdminMessages.tsx:27), ya
--     protegido por las policies "owner update gallery"/"owner update
--     messages" (is_event_owner) — no se toca ese UPDATE.
--   - "uploaded_by_owner" (gallery) y "width"/"height"/"caption"
--     (gallery) no se usan en ningún INSERT ni UPDATE de todo el
--     proyecto.
--
-- Corrección: se reemplaza el GRANT INSERT de tabla completa por uno
-- con lista explícita de columnas — exactamente las que cada INSERT
-- real usa hoy, para anon y authenticated (invitados con Anonymous
-- Auth también pasan por "authenticated"). Cualquier INSERT que
-- incluya moderation/featured/uploaded_by_owner falla con "permission
-- denied for column"; las columnas no listadas toman siempre su
-- DEFAULT de tabla. No se toca ningún UPDATE, ninguna policy RLS,
-- ninguna función SECURITY DEFINER, ni el rol service_role.
-- =====================================================================

REVOKE INSERT ON public.gallery FROM anon, authenticated;
GRANT INSERT (event_id, guest_id, kind, storage_path, public_url)
  ON public.gallery TO anon, authenticated;

REVOKE INSERT ON public.messages FROM anon, authenticated;
GRANT INSERT (event_id, guest_id, author_name, body, emoji)
  ON public.messages TO anon, authenticated;

REVOKE INSERT ON public.memories FROM anon, authenticated;
GRANT INSERT (event_id, guest_id, author_name, text_content, media_url, media_kind)
  ON public.memories TO anon, authenticated;

-- Forzar recarga del caché de esquema de PostgREST (mismo motivo que en
-- migraciones anteriores de RLS/GRANT: evita falsos negativos si esto
-- se corre pegado directo en el SQL Editor en vez de vía CLI/migraciones).
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Rollback:
--   GRANT INSERT ON public.gallery TO anon, authenticated;
--   GRANT INSERT ON public.messages TO anon, authenticated;
--   GRANT INSERT ON public.memories TO anon, authenticated;
-- =====================================================================
