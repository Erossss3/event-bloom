-- Sesión B — corre en paralelo con session_a_update.sql
SELECT set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555', 'role', 'authenticated')::text, false);
SELECT pg_sleep(0.5);
SELECT public.claim_guest_identity(
  '00000000-0000-0000-0000-000000000001', 'device-token-RACE-UPDATE', 'Sesion B', NULL
) AS guest_id_sesion_b;
