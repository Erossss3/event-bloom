-- MITIGACIONES TEMPORALES DE SEGURIDAD — pre lanzamiento V1
-- Contexto: auditoría encontró que "guests"/"rsvps" son escribibles por
-- cualquier visitante anónimo filtrando por `id` (H1/H2), porque las policies
-- de UPDATE solo verifican que el evento sea público, no que la fila
-- pertenezca a quien la edita. La solución de fondo (Anonymous Auth) queda
-- para un sprint posterior. Esta migración reduce la superficie de ataque
-- práctica SIN cambiar el modelo de identidad ni el frontend: si un `id` no
-- se puede descubrir por API, el ataque deja de ser practicable aunque la
-- policy de escritura siga siendo, en teoría, insuficiente.
--
-- Verificado contra el código real antes de escribir esto (grep en todo
-- src/): ningún flujo del invitado hace SELECT sobre "guests", y los únicos
-- SELECT sobre "rsvps"/"gallery"/"messages"/"memories" del lado invitado
-- usan exactamente las columnas listadas en los GRANT de abajo — ninguna
-- de estas restricciones rompe una consulta existente.

-- ============================================================
-- 1) GUESTS: el invitado nunca lee esta tabla (solo hace insert/upsert al
--    unirse). El SELECT público existente no aportaba nada al producto y
--    era la vía más directa para descubrir el `id` de otros invitados y
--    atacarlos vía la policy de UPDATE de "guests" (H2). Se remueve por
--    completo el acceso de lectura anónimo; el organizador conserva acceso
--    total a través de is_event_owner, sin ningún cambio para él.
-- ============================================================
DROP POLICY IF EXISTS "public can view guests of accessible event" ON public.guests;

CREATE POLICY "owner can view guests" ON public.guests FOR SELECT TO authenticated
  USING (public.is_event_owner(event_id));

-- ============================================================
-- 2) GALLERY / MESSAGES / MEMORIES: el portal público de invitados nunca
--    lee `guest_id` (confirmado por grep en e.$slug.gallery.tsx,
--    e.$slug.messages.tsx, e.$slug.memories.tsx). Ese campo es exactamente
--    lo que permitía descubrir `guests.id` ajenos por una vía alternativa,
--    incluso después de bloquear la lectura directa de "guests" en el
--    punto 1. Se acota la lectura anónima a las columnas que el portal
--    público realmente usa (select + where + order), sin tocar el rol
--    "authenticated" (el panel del organizador sigue con acceso completo,
--    ya protegido a nivel de fila por is_event_owner).
-- ============================================================
REVOKE SELECT ON public.gallery FROM anon;
GRANT SELECT (id, event_id, public_url, kind, moderation, created_at) ON public.gallery TO anon;

REVOKE SELECT ON public.messages FROM anon;
GRANT SELECT (id, event_id, author_name, body, emoji, moderation, created_at) ON public.messages TO anon;

REVOKE SELECT ON public.memories FROM anon;
GRANT SELECT (id, event_id, author_name, text_content, media_url, moderation, created_at) ON public.memories TO anon;

-- ============================================================
-- 3) RSVPS: a diferencia de "guests", acá NO se puede remover el acceso de
--    lectura anónimo por completo — e.$slug.rsvp.tsx y r.$slug.tsx dependen
--    de leer la propia respuesta anterior (función real del producto:
--    "editá tu RSVP"), filtrando por event_id + guest_id. Mitigación
--    parcial: se acota a las columnas que ese flujo usa, quitando
--    `table_id` (asignación de mesa — dato de planificación del
--    organizador, sin motivo para ser público) y las marcas de tiempo
--    internas. `id` y `guest_id` deben permanecer legibles porque la propia
--    consulta legítima los necesita en el WHERE — esto significa que la
--    mitigación de "rsvps" queda incompleta a propósito: no cierra H1 del
--    todo, solo reduce columnas expuestas sin necesidad. Documentado como
--    riesgo residual en el informe, no se puede resolver sin tocar el
--    frontend o sin autenticación real.
-- ============================================================
REVOKE SELECT ON public.rsvps FROM anon;
GRANT SELECT (id, event_id, guest_id, full_name, status, adults, children, dietary, dietary_items, note) ON public.rsvps TO anon;

-- ============================================================
-- Forzar recarga del caché de esquema de PostgREST (mismo motivo que en
-- la migración de Fase 1: evita falsos negativos si esto se corre pegado
-- directo en el SQL Editor en vez de vía CLI/migraciones).
-- ============================================================
NOTIFY pgrst, 'reload schema';
