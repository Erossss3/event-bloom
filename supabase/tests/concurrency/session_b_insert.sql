-- Sesión B — corre en paralelo con session_a_insert.sql (mismo device_token, distinta identidad)
SELECT set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, false);
SELECT pg_sleep(0.5); -- sincroniza el arranque con la sesión A
SELECT public.claim_guest_identity(
  '00000000-0000-0000-0000-000000000001', 'device-token-RACE-INSERT', 'Sesion B', NULL
) AS guest_id_sesion_b;
