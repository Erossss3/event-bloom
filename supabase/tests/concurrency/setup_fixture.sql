-- =====================================================================
-- Fixture para los tests de concurrencia.
-- =====================================================================
-- CORRECCIÓN: la versión anterior intentaba INSERT INTO auth.users
-- directamente. Es una tabla gestionada por el servicio de Auth de
-- Supabase (GoTrue) con columnas NOT NULL adicionales y comportamiento
-- interno que no puedo garantizar desde este entorno — insertar ahí a
-- mano es frágil y, en un proyecto real, innecesario: ya existe al
-- menos un usuario real (vos, el organizador) para usar como owner_id.
--
-- ANTES DE CORRER: reemplazá TODAS las apariciones de
--   99999999-9999-9999-9999-999999999999
-- por un id real y existente de tu tabla auth.users (por ejemplo, tu
-- propio usuario organizador — podés obtenerlo con:
--   SELECT id FROM auth.users LIMIT 1;
-- ejecutado antes, en el SQL Editor).
-- =====================================================================

INSERT INTO public.events (id, owner_id, slug, title, event_type, starts_at, status)
VALUES ('00000000-0000-0000-0000-000000000001',
        '99999999-9999-9999-9999-999999999999',
        'test-claim-guest-identity', 'Evento de prueba', 'wedding',
        now() + interval '1 day', 'published')
ON CONFLICT (id) DO UPDATE SET status = 'published';

-- Fila SIN reclamar para el escenario UPDATE vs UPDATE
INSERT INTO public.guests (event_id, device_token, first_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'device-token-RACE-UPDATE', 'Sin reclamar')
ON CONFLICT (event_id, device_token) DO NOTHING;
