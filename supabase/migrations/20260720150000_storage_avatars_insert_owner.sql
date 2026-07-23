-- =====================================================================
-- Storage — corrección de "anyone upload avatars" (INSERT)
-- =====================================================================
-- Hallazgo: "anyone upload avatars" permitía subir a CUALQUIER path del
-- bucket, a los roles anon Y authenticated, sin ninguna verificación de
-- ownership — igual de abierta que la policy DELETE ya corregida en
-- 20260720140000.
--
-- Verificado antes de escribir esto (sin asumir nada):
--   - No existe ninguna policy UPDATE para "avatars" hoy — no se crea
--     una nueva, solo se corrige la que sí existe (INSERT).
--   - Confirmado por grep exhaustivo (storage.from("avatars"), avatar_url
--     en todo src/): sigue sin existir ningún código real que suba
--     archivos a este bucket. GuestJoinDialog.tsx declara "avatarUrl"
--     pero nunca lo asigna.
--   - Se adopta la convención avatars/{auth.uid()}/{filename}, la misma
--     ya usada y probada en "owner upload covers" — no se inventa un
--     patrón nuevo.
--   - El rol se acota a "authenticated" únicamente (se quita "anon" de
--     la lista): la condición exige auth.uid(), que es NULL para
--     peticiones sin sesión — mantener "anon" en la lista de roles sin
--     que pueda cumplir nunca la condición sería una policy que promete
--     algo que no cumple, mismo tipo de problema ya corregido en el
--     hallazgo anterior. Se renombra a "owner upload avatars" para que
--     el nombre describa lo que la policy realmente hace, siguiendo la
--     misma convención de nombres ya usada para covers/exports/gallery.
-- =====================================================================

DROP POLICY IF EXISTS "anyone upload avatars" ON storage.objects;

CREATE POLICY "owner upload avatars" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "owner upload avatars" ON storage.objects;
--   CREATE POLICY "anyone upload avatars" ON storage.objects FOR INSERT TO anon, authenticated
--     WITH CHECK (bucket_id = 'avatars');
-- =====================================================================
