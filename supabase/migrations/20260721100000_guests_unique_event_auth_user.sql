-- =====================================================================
-- Identidad de invitado — constraint única (event_id, auth_user_id)
-- =====================================================================
-- Necesaria para que "claim_guest_identity" (próxima migración) pueda
-- resolver de forma atómica "¿esta sesión ya reclamó una fila en este
-- evento?" y para que dos reclamos concurrentes del mismo auth.uid()
-- nunca produzcan dos filas de guests para el mismo evento. Permite
-- múltiples NULL (comportamiento estándar de UNIQUE en PostgreSQL) —
-- no afecta a los invitados todavía no reclamados.
-- =====================================================================

ALTER TABLE public.guests
  ADD CONSTRAINT guests_event_auth_user_unique UNIQUE (event_id, auth_user_id);

-- Rollback: ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_event_auth_user_unique;
