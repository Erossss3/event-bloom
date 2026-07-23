-- =====================================================================
-- Storage — corrección de "auth delete avatars"
-- =====================================================================
-- Hallazgo (auditoría Paso 1): a diferencia de "covers"/"gallery"/
-- "memories"/"exports" (ya corregidas en la Fase 1 con verificación de
-- ownership por path), "auth delete avatars" nunca fue reemplazada —
-- sigue con USING (bucket_id = 'avatars'), sin ninguna restricción de
-- propietario. Cualquier usuario authenticated (incluida una futura
-- sesión Anonymous Auth) puede borrar cualquier archivo de este bucket.
--
-- Verificado antes de escribir esto (sin asumir nada):
--   - grep exhaustivo en todo src/: ningún archivo del frontend sube
--     nada al bucket "avatars" (ni storage.from("avatars"), ni
--     uploadToBucket("avatars", ...)). El único rastro es la variable
--     "avatarUrl" en GuestJoinDialog.tsx, declarada pero nunca asignada
--     — siempre null. No existe hoy ninguna función real de subida de
--     avatares, y por lo tanto tampoco ninguna convención de path real
--     que verificar en producción.
--   - Ante la ausencia de una convención propia, se aplica la misma ya
--     usada y probada para "covers" (mismo tipo de recurso: un archivo
--     por usuario autenticado): primer segmento del path = auth.uid()
--     de quien lo subió. Esto no reacciona a ningún flujo real existente
--     (no hay ninguno), sino que deja el bucket correctamente cerrado
--     para cuando esa función se construya.
--   - Solo existen 3 policies sobre "avatars" en total (SELECT, INSERT,
--     DELETE) — se confirma que ninguna otra de DELETE existe para este
--     bucket, así que el DROP + CREATE no deja duplicados.
-- =====================================================================

DROP POLICY IF EXISTS "auth delete avatars" ON storage.objects;

CREATE POLICY "auth delete avatars" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "auth delete avatars" ON storage.objects;
--   CREATE POLICY "auth delete avatars" ON storage.objects FOR DELETE TO authenticated
--     USING (bucket_id = 'avatars');
-- =====================================================================
