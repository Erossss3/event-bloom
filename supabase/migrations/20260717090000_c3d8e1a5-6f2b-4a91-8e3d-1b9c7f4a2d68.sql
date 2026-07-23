-- SPRINT 4 (fix de esquema): la tabla public.event_tables ya existe en producción,
-- pero con una forma distinta a la que espera el frontend (el error real observado fue
-- "Could not find the 'color' column of 'event_tables' in the schema cache").
--
-- Esta migración es puramente aditiva: NO recrea la tabla, NO borra columnas ni datos.
-- Agrega, con IF NOT EXISTS, cada columna que el código realmente usa hoy:
--   - TablesGrid.tsx      → name, number, capacity, color, description
--   - GuestSeatingList.tsx→ name, capacity (vía tablas ya cargadas)
--   - TablesPrintView.tsx → name, number, capacity, description
--   - app.events.$id.tables.tsx → number, capacity, name
--   - src/lib/tables.ts   → capacity
-- position_x / position_y se incluyen también: están declarados en types.ts y
-- pensados para la vista de distribución visual futura.

ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS number INT;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 8;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS position_x DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS position_y DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Si la tabla ya tenía filas creadas antes de que existiera 'name' (poco probable,
-- pero posible si se probó a medias), les damos un nombre por defecto en vez de
-- dejarlas con NULL, que rompería la UI (TablesGrid asume t.name como string).
UPDATE public.event_tables SET name = 'Mesa sin nombre' WHERE name IS NULL;
ALTER TABLE public.event_tables ALTER COLUMN name SET NOT NULL;

-- Índice de ordenamiento por número (usado por .order("number") en la app).
CREATE INDEX IF NOT EXISTS idx_event_tables_event ON public.event_tables(event_id);

-- Confirmar que RLS sigue activo y la policy del dueño sigue en pie
-- (agregar columnas no las afecta, pero las re-declaramos para que esta
-- migración sea autocontenida y funcione incluso en una base recién creada).
ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manage tables" ON public.event_tables;
CREATE POLICY "owner manage tables" ON public.event_tables FOR ALL TO authenticated
  USING (public.is_event_owner(event_id))
  WITH CHECK (public.is_event_owner(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_tables TO authenticated;
GRANT ALL ON public.event_tables TO service_role;

DROP TRIGGER IF EXISTS trg_event_tables_updated ON public.event_tables;
CREATE TRIGGER trg_event_tables_updated BEFORE UPDATE ON public.event_tables
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
