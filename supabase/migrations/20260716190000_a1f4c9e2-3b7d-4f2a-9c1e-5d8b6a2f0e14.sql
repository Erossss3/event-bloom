-- SPRINT 4: Gestor de mesas
-- Crea un sistema de mesas por evento y permite asignar cada RSVP (grupo de invitados)
-- a una mesa. Se asigna a nivel de RSVP (no de guest) porque un RSVP ya representa
-- la unidad real de asiento: un grupo con `adults` + `children` personas.
-- No se modifica ninguna tabla existente de forma destructiva.
-- Escrita de forma idempotente: es segura de correr más de una vez.

-- EVENT_TABLES
CREATE TABLE IF NOT EXISTS public.event_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INT,
  capacity INT NOT NULL DEFAULT 8,
  color TEXT,
  description TEXT,
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_tables_event ON public.event_tables(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_tables TO authenticated;
GRANT ALL ON public.event_tables TO service_role;

ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;

-- Solo el dueño del evento administra sus mesas (herramienta interna del organizador,
-- no expuesta a invitados públicos).
DROP POLICY IF EXISTS "owner manage tables" ON public.event_tables;
CREATE POLICY "owner manage tables" ON public.event_tables FOR ALL TO authenticated
  USING (public.is_event_owner(event_id))
  WITH CHECK (public.is_event_owner(event_id));

DROP TRIGGER IF EXISTS trg_event_tables_updated ON public.event_tables;
CREATE TRIGGER trg_event_tables_updated BEFORE UPDATE ON public.event_tables
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- RSVPS: agregar asignación de mesa (nullable, no rompe RSVPs existentes)
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.event_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rsvps_table ON public.rsvps(table_id);

-- Seguridad: la política pública de UPDATE sobre rsvps ("public update rsvp") permite
-- que un invitado actualice su propia fila para cambiar su estado/datos de RSVP.
-- Restringimos por columna para que el rol anon NUNCA pueda modificar table_id
-- (eso es exclusivo del organizador autenticado). Esto no cambia ningún comportamiento
-- que ya usen los invitados hoy.
REVOKE UPDATE ON public.rsvps FROM anon;
GRANT UPDATE (full_name, status, adults, children, dietary, dietary_items, note) ON public.rsvps TO anon;
