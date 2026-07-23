-- =====================================================================
-- Anonymous Auth — reemplazo de is_organizer_session() por
-- is_anonymous_session()
-- =====================================================================
-- Contexto: la función creada en 20260720110000 (is_organizer_session)
-- tenía un bug real de lógica, encontrado en la validación técnica
-- contra la documentación oficial de Supabase: usaba
-- COALESCE(...,false) = false, que ante un claim ausente (auth.jwt()
-- sin la clave is_anonymous — ej. clave anon, service_role, SQL
-- Editor, migraciones, psql directo) fallaba ABIERTO (trataba la
-- ausencia del claim como "es organizador"). El ejemplo oficial de
-- Supabase para este mismo caso usa "IS TRUE"/"IS FALSE", que ante un
-- valor NULL siempre resuelve a un booleano (nunca a NULL) y falla
-- CERRADO. Esta migración corrige eso, y además renombra la función:
-- "is_organizer_session" era una interpretación del claim; el nombre
-- nuevo describe exactamente y sin ambigüedad lo que la función lee.
--
-- Verificado antes de escribir esto: is_organizer_session() no tiene
-- ninguna referencia en ninguna policy, función ni archivo del
-- proyecto (grep en todo el repo) — se puede eliminar sin generar
-- ningún error de dependencia.
-- =====================================================================

DROP FUNCTION IF EXISTS public.is_organizer_session();

-- Sin SECURITY DEFINER: no consulta ninguna tabla, solo lee auth.jwt()
-- (el JWT ya verificado de la sesión actual) — no hay RLS que
-- bypassear. STABLE porque el resultado depende de algo externo a los
-- argumentos (el contexto de la sesión) pero no cambia dentro de una
-- misma sentencia — mismo criterio ya usado en is_event_owner() y
-- event_accepts_public().
CREATE OR REPLACE FUNCTION public.is_anonymous_session()
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE;
$$;

COMMENT ON FUNCTION public.is_anonymous_session() IS
  'True si la sesión actual es una sesión anónima de Supabase Auth '
  '(signInAnonymously). Lee únicamente el claim is_anonymous del JWT, '
  'sin consultar ninguna tabla. Usar NOT public.is_anonymous_session() '
  'en cualquier policy que deba exigir un organizador real.';

-- =====================================================================
-- Rollback (sin UP/DOWN formal en este proyecto, se documenta el
-- equivalente exacto):
--
--   DROP FUNCTION IF EXISTS public.is_anonymous_session();
--   CREATE OR REPLACE FUNCTION public.is_organizer_session()
--   RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public AS $$
--     SELECT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
--   $$;
--
-- Reversión segura porque, en este punto del plan, ninguna policy usa
-- todavía ninguna de las dos funciones.
-- =====================================================================
