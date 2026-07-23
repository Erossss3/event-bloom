-- ============================================================
-- DIAGNÓSTICO: reproducir exactamente lo que ve Usuario B
-- ============================================================
-- Reemplazá 'PEGAR-SLUG-AQUI' por el slug real del evento de Usuario A,
-- y 'PEGAR-UUID-DE-USUARIO-B-AQUI' por el auth.uid() de Usuario B
-- (lo sacás de auth.users o del dashboard de Authentication).

BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"PEGAR-UUID-DE-USUARIO-B-AQUI","role":"authenticated"}';

  -- Esto es EXACTAMENTE lo que corre e.$slug.tsx, con el rol y el JWT de B simulados.
  SELECT id, slug, title, status, owner_id
  FROM public.events
  WHERE slug = 'PEGAR-SLUG-AQUI';
ROLLBACK;

-- Si esa consulta devuelve la fila acá pero la app sigue dando 404,
-- es 100% caché de PostgREST desactualizado → correr esto:
NOTIFY pgrst, 'reload schema';

-- Si esa consulta NO devuelve ninguna fila (0 rows) acá mismo en el SQL
-- Editor, el problema es realmente la policy/RLS, no el caché — y en ese
-- caso necesito que me pases el resultado exacto (0 filas o error) para
-- seguir el diagnóstico sobre eso puntualmente.

-- También revisá que las policies queden exactamente así (deben ser 2 para SELECT):
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'events'
ORDER BY policyname;
