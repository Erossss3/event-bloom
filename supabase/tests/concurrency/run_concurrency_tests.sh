#!/usr/bin/env bash
# =====================================================================
# Ejecuta los escenarios 4, 7 y 8 (concurrencia real) contra tu
# proyecto real de Supabase.
#
# Uso:
#   export DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres"
#   ./run_concurrency_tests.sh
#
# Requiere psql instalado y la cadena de conexión directa a Postgres
# (Project Settings → Database → Connection string, modo "Session" o
# "Direct connection", no el pooler en modo transaction).
#
# IMPORTANTE: no se usa "set -e". En la carrera INSERT-vs-INSERT (y en
# la de UPDATE-vs-UPDATE con dos identidades) UNA de las dos sesiones
# DEBE terminar en excepción — eso es el comportamiento correcto, no
# un fallo del script. Cada carrera se verifica explícitamente abajo.
#
# CORRECCIÓN DE AUDITORÍA: todas las invocaciones a psql usan ahora
# "-v ON_ERROR_STOP=1". Sin esta variable, psql NO propaga los errores
# de SQL (como el RAISE EXCEPTION de claim_guest_identity, o el de los
# bloques de verificación de integridad de abajo) a su código de
# salida — el exit code 3 ("error en el script") sólo se produce si
# ON_ERROR_STOP está seteado; si no, psql imprime el error por stderr
# y sigue, terminando con código 0 igual. Sin esto, RC_A y RC_B daban
# SIEMPRE 0 (incluso cuando una sesión recibía correctamente la
# excepción esperada), lo que hacía que el script reportara "FALLÓ:
# las dos sesiones tuvieron éxito" de forma permanente — un falso
# negativo — y además los bloques de "verificación de integridad"
# nunca podían hacer fallar al script, aunque detectaran filas
# duplicadas o un auth_user_id incorrecto — un falso positivo, porque
# el mensaje final "TODOS LOS ESCENARIOS... PASARON" se imprimía sin
# condición alguna.
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL. Exportá la cadena de conexión antes de correr esto." >&2
  exit 1
fi

echo "== Preparando fixture =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f setup_fixture.sql || { echo "Fixture falló, abortando"; exit 1; }

echo ""
echo "== Escenario 4 y 7: INSERT vs INSERT (dos identidades, device_token nuevo) =="
echo "   (se espera que UNA de las dos sesiones falle con la excepción — no es un error)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f session_a_insert.sql > /tmp/out_a_insert.txt 2>&1 &
PID_A=$!
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f session_b_insert.sql > /tmp/out_b_insert.txt 2>&1 &
PID_B=$!
wait $PID_A; RC_A=$?
wait $PID_B; RC_B=$?
echo "--- salida sesión A (código $RC_A) ---"; cat /tmp/out_a_insert.txt
echo "--- salida sesión B (código $RC_B) ---"; cat /tmp/out_b_insert.txt

if [ "$RC_A" -eq 0 ] && [ "$RC_B" -eq 0 ]; then
  echo "FALLÓ: las dos sesiones tuvieron éxito — se esperaba que UNA fallara con la excepción" >&2
  exit 1
fi
if [ "$RC_A" -ne 0 ] && [ "$RC_B" -ne 0 ]; then
  echo "FALLÓ: las dos sesiones fallaron — se esperaba que UNA tuviera éxito" >&2
  exit 1
fi
if ! grep -qi "already associated with another identity" /tmp/out_a_insert.txt /tmp/out_b_insert.txt; then
  echo "FALLÓ: ninguna de las dos mostró el mensaje de excepción esperado" >&2
  exit 1
fi
echo "OK: exactamente una sesión ganó, la otra recibió la excepción esperada."

echo ""
echo "== Verificación de integridad INSERT vs INSERT =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE v_count int; v_uid uuid;
BEGIN
  SELECT count(*) INTO v_count FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-RACE-INSERT';
  IF NOT (v_count = 1) THEN
    RAISE EXCEPTION 'FALLÓ: quedó más de una fila tras la carrera INSERT vs INSERT';
  END IF;

  SELECT auth_user_id INTO v_uid FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-RACE-INSERT';
  -- "v_uid IS NULL OR v_uid NOT IN (...)" en vez de "NOT (v_uid IN (...))":
  -- si v_uid fuera NULL, "NULL IN (...)" da NULL, "NOT NULL" da NULL, y el
  -- IF nunca se cumple — dejaría pasar en silencio el caso donde el
  -- auth_user_id quedó sin asignar.
  IF v_uid IS NULL OR v_uid NOT IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') THEN
    RAISE EXCEPTION 'FALLÓ: auth_user_id final no corresponde a ninguna de las dos sesiones';
  END IF;

  RAISE NOTICE 'INSERT vs INSERT: PASS — una sola fila, reclamada por %', v_uid;
END $$;
SQL
if [ "$?" -ne 0 ]; then
  echo "FALLÓ: la verificación de integridad INSERT vs INSERT reportó un error (ver arriba)" >&2
  exit 1
fi

echo ""
echo "== Escenario 8: UPDATE vs UPDATE (fila ya existía sin reclamar) =="
echo "   (se espera que UNA de las dos sesiones falle con la excepción — no es un error)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f session_a_update.sql > /tmp/out_a_update.txt 2>&1 &
PID_A=$!
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f session_b_update.sql > /tmp/out_b_update.txt 2>&1 &
PID_B=$!
wait $PID_A; RC_A=$?
wait $PID_B; RC_B=$?
echo "--- salida sesión A (código $RC_A) ---"; cat /tmp/out_a_update.txt
echo "--- salida sesión B (código $RC_B) ---"; cat /tmp/out_b_update.txt

if [ "$RC_A" -eq 0 ] && [ "$RC_B" -eq 0 ]; then
  echo "FALLÓ: las dos sesiones tuvieron éxito — se esperaba que UNA fallara con la excepción" >&2
  exit 1
fi
if [ "$RC_A" -ne 0 ] && [ "$RC_B" -ne 0 ]; then
  echo "FALLÓ: las dos sesiones fallaron — se esperaba que UNA tuviera éxito" >&2
  exit 1
fi

echo ""
echo "== Verificación de integridad UPDATE vs UPDATE =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE v_count int; v_uid uuid;
BEGIN
  SELECT count(*) INTO v_count FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-RACE-UPDATE';
  IF NOT (v_count = 1) THEN
    RAISE EXCEPTION 'FALLÓ: quedó más de una fila tras la carrera UPDATE vs UPDATE';
  END IF;

  SELECT auth_user_id INTO v_uid FROM public.guests
    WHERE event_id = '00000000-0000-0000-0000-000000000001' AND device_token = 'device-token-RACE-UPDATE';
  -- Ídem: se evita "NOT (v_uid IN (...))" por el mismo motivo que en el
  -- bloque INSERT vs INSERT de más arriba.
  IF v_uid IS NULL OR v_uid NOT IN ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555') THEN
    RAISE EXCEPTION 'FALLÓ: auth_user_id final no corresponde a ninguna de las dos sesiones';
  END IF;

  RAISE NOTICE 'UPDATE vs UPDATE: PASS — una sola identidad terminó reclamando: %', v_uid;
END $$;
SQL
if [ "$?" -ne 0 ]; then
  echo "FALLÓ: la verificación de integridad UPDATE vs UPDATE reportó un error (ver arriba)" >&2
  exit 1
fi

echo ""
echo "== Limpieza del fixture =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM public.guests WHERE event_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.events WHERE id = '00000000-0000-0000-0000-000000000001';
SQL

echo ""
echo "=== TODOS LOS ESCENARIOS DE CONCURRENCIA PASARON ==="
