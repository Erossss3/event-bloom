-- =====================================================================
-- GALLERY / MESSAGES — moderación server-side real basada en
-- event_settings.moderate_photos / moderate_messages
-- =====================================================================
-- Hallazgo verificado en la auditoría anterior: "moderate_photos" y
-- "moderate_messages" (event_settings, 20260711162751...sql:95-96)
-- nunca fueron leídas por ninguna función, trigger ni policy — el
-- INSERT siempre terminaba en moderation='approved' por el DEFAULT de
-- columna (líneas 191/236 de la misma migración), sin importar el
-- valor de esos toggles. La migración 20260721170000 ya cerró la vía
-- por la que un cliente podía forzar "moderation" manualmente, pero no
-- implementaba el comportamiento que "moderate_photos"/"moderate_messages"
-- deberían producir — eso es lo que esta migración agrega.
--
-- Diseño: un trigger BEFORE INSERT en cada tabla sobreescribe
-- NEW.moderation según event_settings.moderate_photos/moderate_messages
-- del evento de la fila, sin importar qué haya intentado enviar el
-- cliente (y aunque el cliente ya no puede enviarlo, por la migración
-- anterior). Es SECURITY DEFINER porque "event_settings" tiene su
-- propia RLS ("settings visible con event_accepts_public OR
-- is_event_owner") — igual criterio ya usado en is_own_guest()/
-- guest_is_unclaimed() para no depender de que la sesión que inserta
-- tenga por sí sola acceso de lectura a esa fila.
--
-- Atomicidad (requisito explícito): al ser BEFORE INSERT, NEW.moderation
-- se fija ANTES de que la fila exista físicamente — la fila nace ya con
-- el valor correcto en la misma sentencia INSERT. No hay un INSERT con
-- 'approved' seguido de un UPDATE a 'pending': no existe tal fila ni tal
-- ventana en ningún momento.
--
-- MEMORIES: no se agrega trigger. No existe "moderate_memories" en
-- event_settings, no hay ningún toggle ni control de organizador para
-- ello en el producto (grep confirmado: "memories" no aparece en
-- ninguna referencia de moderación de event_settings), y agregar una
-- columna/feature nueva sin que el producto la exponga en ningún lado
-- sería una funcionalidad nueva no pedida. Se mantiene el
-- comportamiento actual: moderation='approved' por DEFAULT de columna,
-- ya protegido de sobreescritura por el cliente desde 20260721170000.
--
-- No se toca ninguna policy (ni de gallery/messages ni de event_settings),
-- ningún GRANT, claim_guest_identity(), ni ninguna migración existente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.tg_gallery_enforce_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moderate boolean;
BEGIN
  SELECT moderate_photos INTO v_moderate
    FROM public.event_settings WHERE event_id = NEW.event_id;

  NEW.moderation := CASE
    WHEN COALESCE(v_moderate, false) THEN 'pending'::public.moderation_status
    ELSE 'approved'::public.moderation_status
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gallery_enforce_moderation ON public.gallery;
CREATE TRIGGER trg_gallery_enforce_moderation
  BEFORE INSERT ON public.gallery
  FOR EACH ROW EXECUTE FUNCTION public.tg_gallery_enforce_moderation();

CREATE OR REPLACE FUNCTION public.tg_messages_enforce_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moderate boolean;
BEGIN
  SELECT moderate_messages INTO v_moderate
    FROM public.event_settings WHERE event_id = NEW.event_id;

  NEW.moderation := CASE
    WHEN COALESCE(v_moderate, false) THEN 'pending'::public.moderation_status
    ELSE 'approved'::public.moderation_status
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_enforce_moderation ON public.messages;
CREATE TRIGGER trg_messages_enforce_moderation
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_messages_enforce_moderation();

-- =====================================================================
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_gallery_enforce_moderation ON public.gallery;
--   DROP FUNCTION IF EXISTS public.tg_gallery_enforce_moderation();
--   DROP TRIGGER IF EXISTS trg_messages_enforce_moderation ON public.messages;
--   DROP FUNCTION IF EXISTS public.tg_messages_enforce_moderation();
-- =====================================================================
