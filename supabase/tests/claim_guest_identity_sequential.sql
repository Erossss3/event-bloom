-- =====================================================================
-- Pruebas de claim_guest_identity() — parte secuencial
-- =====================================================================
-- CÓMO EJECUTAR: pegar este archivo completo en el SQL Editor de
-- Supabase (o correrlo con `psql "$DATABASE_URL" -f este_archivo.sql`)
-- contra el proyecto real, DESPUÉS de aplicar todas las migraciones.
-- No es una migración — no se aplica sola, es un script de test.
--
-- Cada bloque verifica explícitamente con IF/RAISE EXCEPTION: si la
-- condición es falsa, PostgreSQL detiene la ejecución con una
-- excepción real (no es una simulación teórica). Se usa esta forma en
-- vez de ASSERT porque ASSERT depende del parámetro de sesión
-- "plpgsql.check_asserts" — si estuviera desactivado en el proyecto,
-- las aserciones se saltearían en silencio sin avisar. IF/RAISE
-- EXCEPTION siempre se ejecuta, sin depender de ninguna configuración.
-- Un "COMMIT" final sin errores (acá siempre es un ROLLBACK a
-- propósito, ver el final del archivo) = todos los escenarios pasaron.
--
-- Truco de testing estándar de Supabase (documentado, no inventado):
-- auth.uid()/auth.jwt() leen current_setting('request.jwt.claims').
-- set_config(...) simula distintas sesiones dentro del mismo script,
-- sin necesitar un JWT real ni una llamada HTTP.
-- =====================================================================

BEGIN;

-- --- Fixture: un evento de prueba real, publicado ------------------
-- ANTES DE CORRER: reemplazá TODAS las apariciones de
--   99999999-9999-9999-9999-999999999999
-- por un id real y existente de tu tabla auth.users (por ejemplo, tu
-- propio usuario organizador). No se inserta nada en auth.users desde
-- este script — es una tabla gestionada por Supabase Auth y no
-- corresponde escribirla a mano.
INSERT INTO public.events (id, owner_id, slug, title, event_type, starts_at, status)
VALUES ('00000000-0000-0000-0000-000000000001',
        '99999999-9999-9999-9999-999999999999',
        'test-claim-guest-identity', 'Evento de prueba', 'wedding',
        now() + interval '1 day', 'published')
ON CONFLICT (id) DO UPDATE SET status = 'published';

-- Dos identidades simuladas para todo el archivo
-- USER_A = 11111111-1111-1111-1111-111111111111
-- USER_B = 22222222-2222-2222-2222-222222222222

-- =====================================================================
-- ESCENARIO 1 — Invitado nuevo
-- =====================================================================
SELECT set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

DO $$
DECLARE v_guest_id uuid; v_auth_user_id uuid; v_count int;
BEGIN
  v_guest_id := public.claim_guest_identity(
    '00000000-0000-0000-0000-000000000001', 'device-token-A', 'Ana', NULL
  );
  IF NOT (v_guest_id IS NOT NULL) THEN
    RAISE EXCEPTION 'ESCENARIO 1 FALLÓ: no devolvió guest_id';
  END IF;

  SELECT auth_user_id INTO v_auth_user_id FROM public.guests WHERE id = v_guest_id;
  -- Se usa IS DISTINCT FROM (no "="): si v_auth_user_id fuera NULL por un
  -- bug real, "=" da NULL, "NOT NULL" da NULL, y un IF con NULL en
  -- PL/pgSQL se comporta como false — la excepción nunca se lanzaría y
  -- el escenario quedaría como PASS aunque auth_user_id no se hubiera
  -- asignado. IS DISTINCT FROM nunca da NULL como resultado.
  IF v_auth_user_id IS DISTINCT FROM '11111111-1111-1111-1111-111111111111' THEN
    RAISE EXCEPTION 'ESCENARIO 1 FALLÓ: auth_user_id no quedó asignado correctamente';
  END IF;

  SELECT count(*) INTO v_count FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-A';
  IF NOT (v_count = 1) THEN
    RAISE EXCEPTION 'ESCENARIO 1 FALLÓ: se creó más de una fila';
  END IF;

  RAISE NOTICE 'ESCENARIO 1 (invitado nuevo): PASS — guest_id=%', v_guest_id;
END $$;

-- =====================================================================
-- ESCENARIO 2 — Invitado existente, misma sesión
-- =====================================================================
DO $$
DECLARE v_guest_id_1 uuid; v_guest_id_2 uuid; v_count int;
BEGIN
  SELECT id INTO v_guest_id_1 FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-A';

  -- misma sesión (mismo set_config de USER_A), se llama de nuevo
  v_guest_id_2 := public.claim_guest_identity(
    '00000000-0000-0000-0000-000000000001', 'device-token-A', 'Ana', NULL
  );

  -- IS DISTINCT FROM en vez de "=": si v_guest_id_1 viniera NULL (p.ej.
  -- porque el SELECT anterior no encontró la fila del Escenario 1), "="
  -- da NULL y el IF nunca se cumple, dejando pasar el escenario en falso.
  IF v_guest_id_1 IS DISTINCT FROM v_guest_id_2 THEN
    RAISE EXCEPTION 'ESCENARIO 2 FALLÓ: devolvió un guest_id distinto';
  END IF;

  SELECT count(*) INTO v_count FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-A';
  IF NOT (v_count = 1) THEN
    RAISE EXCEPTION 'ESCENARIO 2 FALLÓ: se creó una fila duplicada';
  END IF;

  RAISE NOTICE 'ESCENARIO 2 (invitado existente, misma sesión): PASS — guest_id=%', v_guest_id_2;
END $$;

-- =====================================================================
-- ESCENARIO 3 — "Dos pestañas" del mismo navegador (simulado en
-- secuencia: misma sesión, dos llamadas seguidas — no reemplaza al
-- test de concurrencia real de session_a.sql/session_b.sql, valida la
-- propiedad de idempotencia que ese escenario exige)
-- =====================================================================
DO $$
DECLARE v_tab1 uuid; v_tab2 uuid; v_count int;
BEGIN
  v_tab1 := public.claim_guest_identity('00000000-0000-0000-0000-000000000001', 'device-token-A', 'Ana', NULL);
  v_tab2 := public.claim_guest_identity('00000000-0000-0000-0000-000000000001', 'device-token-A', 'Ana', NULL);

  -- IS DISTINCT FROM: ídem Escenario 2, evita el falso PASS si alguno
  -- de los dos valores viniera NULL.
  IF v_tab1 IS DISTINCT FROM v_tab2 THEN
    RAISE EXCEPTION 'ESCENARIO 3 FALLÓ: las dos pestañas obtuvieron guest_id distintos';
  END IF;

  SELECT count(*) INTO v_count FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-A';
  IF NOT (v_count = 1) THEN
    RAISE EXCEPTION 'ESCENARIO 3 FALLÓ: quedó más de una fila';
  END IF;

  RAISE NOTICE 'ESCENARIO 3 (dos pestañas, secuencial): PASS';
END $$;

-- =====================================================================
-- ESCENARIO 5 — Reintentos automáticos (idempotencia)
-- =====================================================================
DO $$
DECLARE v_ids uuid[] := ARRAY[]::uuid[]; v_count int;
BEGIN
  FOR i IN 1..5 LOOP
    v_ids := array_append(v_ids, public.claim_guest_identity(
      '00000000-0000-0000-0000-000000000001', 'device-token-A', 'Ana', NULL));
  END LOOP;

  IF NOT ((SELECT count(DISTINCT x) FROM unnest(v_ids) x) = 1) THEN
    RAISE EXCEPTION 'ESCENARIO 5 FALLÓ: reintentos devolvieron guest_id distintos entre sí';
  END IF;

  SELECT count(*) INTO v_count FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-A';
  IF NOT (v_count = 1) THEN
    RAISE EXCEPTION 'ESCENARIO 5 FALLÓ: los reintentos crearon filas adicionales';
  END IF;

  RAISE NOTICE 'ESCENARIO 5 (reintentos automáticos): PASS — 5 llamadas, 1 fila';
END $$;

-- =====================================================================
-- ESCENARIO 9 — Reconexión / repetición de la misma llamada
-- (idéntico mecanismo que el 5, con datos frescos para dejar evidencia
-- separada en el reporte de NOTICE)
-- =====================================================================
DO $$
DECLARE v_first uuid; v_retry uuid;
BEGIN
  v_first := public.claim_guest_identity('00000000-0000-0000-0000-000000000001', 'device-token-A', 'Ana', NULL);
  -- simula una reconexión: se vuelve a llamar más tarde con los mismos datos
  v_retry := public.claim_guest_identity('00000000-0000-0000-0000-000000000001', 'device-token-A', 'Ana', NULL);
  -- IS DISTINCT FROM: ídem escenarios anteriores.
  IF v_first IS DISTINCT FROM v_retry THEN
    RAISE EXCEPTION 'ESCENARIO 9 FALLÓ: la repetición no fue idempotente';
  END IF;
  RAISE NOTICE 'ESCENARIO 9 (reconexión/repetición): PASS';
END $$;

-- =====================================================================
-- ESCENARIO 6 — Rollback después del reclamo
-- =====================================================================
SAVEPOINT before_scenario_6;

DO $$
DECLARE v_guest_id uuid;
BEGIN
  v_guest_id := public.claim_guest_identity(
    '00000000-0000-0000-0000-000000000001', 'device-token-ROLLBACK', 'Beto', NULL
  );
  IF NOT (v_guest_id IS NOT NULL) THEN
    RAISE EXCEPTION 'ESCENARIO 6 (previo) FALLÓ: no se pudo reclamar antes del rollback';
  END IF;
END $$;

-- Verificar que el reclamo existe ANTES del rollback
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT auth_user_id INTO v_uid FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-ROLLBACK';
  IF NOT (v_uid IS NOT NULL) THEN
    RAISE EXCEPTION 'ESCENARIO 6 FALLÓ: el reclamo no se aplicó antes del rollback';
  END IF;
END $$;

ROLLBACK TO SAVEPOINT before_scenario_6;

DO $$
DECLARE v_row_count int;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-ROLLBACK';
  IF NOT (v_row_count = 0) THEN
    RAISE EXCEPTION 'ESCENARIO 6 FALLÓ: la fila sobrevivió al rollback (no quedó sin cambios)';
  END IF;
  RAISE NOTICE 'ESCENARIO 6 (rollback): PASS — ningún cambio parcial sobrevivió';
END $$;

-- =====================================================================
-- ESCENARIO 10 — Pérdida completa de sesión (nuevo auth.uid())
-- =====================================================================
SELECT set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);

DO $$
DECLARE v_old_guest_id uuid; v_new_guest_id uuid;
BEGIN
  SELECT id INTO v_old_guest_id FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-A';

  -- Sesión nueva (nuevo auth.uid) + device_token nuevo (localStorage
  -- borrado) intentando "volver" con el mismo nombre — no debe recibir
  -- el guest_id anterior bajo ningún concepto.
  v_new_guest_id := public.claim_guest_identity(
    '00000000-0000-0000-0000-000000000001', 'device-token-NUEVO-TRAS-BORRAR-TODO', 'Ana', NULL
  );

  IF NOT (v_new_guest_id IS DISTINCT FROM v_old_guest_id) THEN
    RAISE EXCEPTION 'ESCENARIO 10 FALLÓ: recuperó el guest_id de la identidad anterior';
  END IF;

  RAISE NOTICE 'ESCENARIO 10 (pérdida de sesión): PASS — guest_id nuevo=%, anterior=% (distintos)', v_new_guest_id, v_old_guest_id;
END $$;

DO $$ BEGIN RAISE NOTICE '=== TODOS LOS ESCENARIOS SECUENCIALES PASARON ==='; END $$;

ROLLBACK; -- deshace TODO el fixture de prueba, incluido el evento — no deja rastro en la base real
