-- =====================================================================
-- Anonymous Auth — Paso 2: función helper de distinción organizador/invitado
-- =====================================================================
-- Contexto: al habilitar Anonymous Auth, una sesión de invitado anónimo
-- recibe un JWT con rol "authenticated" igual que un organizador real
-- (con el claim adicional is_anonymous=true). Varias policies del
-- proyecto (ej. "owner insert event") solo verifican "authenticated",
-- sin distinguir si esa sesión es un organizador registrado o un
-- invitado anónimo — esta función es la pieza que permite corregir eso,
-- reutilizable desde cualquier policy presente o futura.
--
-- Por qué NO es SECURITY DEFINER: a diferencia de is_event_owner() o
-- event_accepts_public() (que sí lo necesitan, porque consultan la
-- tabla "events" y deben bypassear su propia RLS), esta función no
-- consulta ninguna tabla — solo lee auth.jwt(), el JWT ya verificado de
-- la sesión actual. Sin tabla de por medio no hay RLS que bypassear, y
-- agregar SECURITY DEFINER acá sería privilegio elevado sin ningún
-- beneficio real. Corre con los mismos permisos de quien la llama.
--
-- Por qué no depende de profiles/guests/events: el claim is_anonymous
-- viene firmado por el propio servidor de Supabase Auth en el momento
-- de emitir el JWT — no hace falta ir a buscarlo a ninguna tabla
-- nuestra, y por lo tanto no hay ninguna posibilidad de recursión de
-- RLS (no hay ninguna tabla propia involucrada en absoluto).
--
-- IMPORTANTE — esta migración, por sí sola, no cambia ningún
-- comportamiento: la función queda creada pero ninguna policy la usa
-- todavía. Ese es exactamente el alcance pedido para este paso.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_organizer_session()
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

COMMENT ON FUNCTION public.is_organizer_session() IS
  'True si la sesión actual es de un organizador real (no anónima). '
  'No consulta ninguna tabla — lee únicamente el claim is_anonymous del '
  'JWT emitido por Supabase Auth. Pensada para reutilizarse en cualquier '
  'policy que hoy asuma "authenticated = organizador".';

-- =====================================================================
-- Rollback (sin UP/DOWN formal en este proyecto, se documenta el
-- equivalente exacto): DROP FUNCTION IF EXISTS public.is_organizer_session();
-- Reversión segura: ninguna policy la usa todavía en este paso.
-- =====================================================================
