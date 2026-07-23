-- =====================================================================
-- GUESTS — corrección de "public can join event" (bypass de
-- claim_guest_identity() vía INSERT directo)
-- =====================================================================
-- Hallazgo verificado en auditoría final: la policy de INSERT sobre
-- "guests" nunca fue tocada en ninguna migración desde su creación
-- original (20260711162751...sql:144) — solo se corrigieron SELECT
-- (20260719180000) y UPDATE (20260721120000). Sigue vigente:
--
--   CREATE POLICY "public can join event" ON public.guests FOR INSERT
--     TO anon, authenticated WITH CHECK (public.event_accepts_public(event_id));
--
-- Esa condición no valida "auth_user_id" en absoluto. Como el GRANT
-- INSERT sobre "guests" (20260711162751...sql:139) no restringe
-- columnas, un cliente puede enviar un INSERT directo vía REST con
-- "auth_user_id" ya seteado a cualquier id existente en auth.users,
-- sin pasar por ninguna de las verificaciones de claim_guest_identity()
-- (sesión propia, reclamo por device_token, colisión de identidad).
-- Verificado antes de escribir esto que ninguna migración posterior
-- corrige esto (grep de "guests" en las 13 migraciones del sprint +
-- las 2 originales + supabase/migrations/poc/, ninguna reemplaza esta
-- policy) y que ningún flujo real depende de insertar "auth_user_id"
-- directamente:
--   - claim_guest_identity() es SECURITY DEFINER: su propio INSERT
--     (paso 3) bypasea esta RLS por completo — no se ve afectado por
--     este cambio.
--   - ensureGuestSession() (src/lib/guest-session.ts) llama siempre a
--     la RPC, nunca inserta en "guests" directamente.
--   - El único INSERT directo a "guests" del lado del cliente
--     (GuestJoinDialog.tsx) solo envía event_id/device_token/first_name
--     — nunca auth_user_id (el default de columna es NULL).
--
-- Corrección: se exige auth_user_id IS NULL en el INSERT directo. No
-- se agrega "OR auth_user_id = auth.uid()" porque ningún flujo real lo
-- necesita (ver arriba) y esa permisividad adicional permitiría
-- saltear igual toda la lógica de idempotencia/colisión de la función,
-- quedando protegida solo por la constraint UNIQUE en vez de por las
-- reglas de negocio reales. La asignación de auth_user_id sigue siendo
-- responsabilidad exclusiva de claim_guest_identity(), que no pasa por
-- esta policy.
--
-- No se modifica claim_guest_identity(), is_own_guest(),
-- guest_is_unclaimed() ni sus tests — no hace falta: ninguno depende
-- de esta policy para funcionar.
-- =====================================================================

DROP POLICY IF EXISTS "public can join event" ON public.guests;

CREATE POLICY "public can join event" ON public.guests FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND auth_user_id IS NULL
  );

-- Forzar recarga del caché de esquema de PostgREST (mismo motivo que en
-- migraciones anteriores de RLS: evita falsos negativos si esto se
-- corre pegado directo en el SQL Editor en vez de vía CLI/migraciones).
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Rollback:
--   DROP POLICY IF EXISTS "public can join event" ON public.guests;
--   CREATE POLICY "public can join event" ON public.guests FOR INSERT
--     TO anon, authenticated WITH CHECK (public.event_accepts_public(event_id));
-- =====================================================================
