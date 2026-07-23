-- Sesión A — corre en paralelo con session_b_insert.sql (mismo device_token, fila NO existe todavía)
SELECT set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, false);
SELECT pg_sleep(0.5); -- sincroniza el arranque con la sesión B
SELECT public.claim_guest_identity(
  '00000000-0000-0000-0000-000000000001', 'device-token-RACE-INSERT', 'Sesion A', NULL
) AS guest_id_sesion_a;
