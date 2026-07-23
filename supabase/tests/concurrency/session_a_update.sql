-- Sesión A — la fila con device-token-RACE-UPDATE ya fue creada SIN
-- reclamar por setup_fixture.sql antes de correr esto en paralelo.
SELECT set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text, false);
SELECT pg_sleep(0.5);
SELECT public.claim_guest_identity(
  '00000000-0000-0000-0000-000000000001', 'device-token-RACE-UPDATE', 'Sesion A', NULL
) AS guest_id_sesion_a;
