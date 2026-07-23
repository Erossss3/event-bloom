-- =====================================================================
-- PoC B — Anonymous Auth de Supabase
-- =====================================================================
-- NO reemplaza ninguna policy existente. Agrega una columna de vínculo y
-- policies nuevas que conviven con las actuales. El invitado que use el
-- flujo PoC B tendrá una sesión anónima real (auth.uid()) además de su
-- device_token — no se le pide email ni contraseña en ningún momento.
-- =====================================================================

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guests_auth_user_id ON public.guests(auth_user_id);

-- El invitado solo puede crear/leer/editar SU PROPIA fila de guests,
-- verificado por el servidor vía auth.uid() — no por un valor que el
-- cliente afirma poseer.
CREATE POLICY "poc_b guest insert own guest row" ON public.guests
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "poc_b guest select own guest row" ON public.guests
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "poc_b guest update own guest row" ON public.guests
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid());

-- Mismo criterio para rsvps: la fila debe pertenecer a un guest cuyo
-- auth_user_id sea el de la sesión actual.
CREATE POLICY "poc_b guest select own rsvp" ON public.rsvps
  FOR SELECT TO authenticated
  USING (guest_id IN (SELECT id FROM public.guests WHERE auth_user_id = auth.uid()));

CREATE POLICY "poc_b guest insert own rsvp" ON public.rsvps
  FOR INSERT TO authenticated
  WITH CHECK (
    public.event_accepts_public(event_id)
    AND guest_id IN (SELECT id FROM public.guests WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "poc_b guest update own rsvp" ON public.rsvps
  FOR UPDATE TO authenticated
  USING (guest_id IN (SELECT id FROM public.guests WHERE auth_user_id = auth.uid()));

-- Nota: requiere que "Anonymous sign-ins" esté habilitado en el proyecto
-- de Supabase (Dashboard → Authentication → Providers). No puedo
-- verificar ni activar eso desde el código.
