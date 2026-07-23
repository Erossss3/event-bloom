// Sesión de invitado con identidad real (Anonymous Auth + reclamo
// server-side). Reutiliza guest-identity.ts tal cual (device_token,
// localStorage) — no lo reemplaza, lo complementa: el device_token
// sigue siendo la clave de "reconocer este dispositivo", pero ahora se
// verifica del lado del servidor en vez de confiarse ciegamente.
import { supabase } from "@/integrations/supabase/client";
import { getGuest, saveGuest, generateDeviceToken } from "./guest-identity";

/**
 * Garantiza una sesión de Supabase Auth (anónima si no hay ninguna) y
 * reclama/crea la fila de guests correspondiente para este evento,
 * devolviendo su id real. Si algo falla, devuelve null — el llamador
 * decide cómo degradar (por ejemplo, seguir mostrando el formulario
 * sin bloquear al invitado).
 */
export async function ensureGuestSession(
  eventId: string,
  fallbackFirstName: string,
): Promise<string | null> {
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Anonymous auth error:", error);
        return null;
      }
      session = data.session;
    }
    if (!session) return null;

    const local = getGuest(eventId);
    const deviceToken = local?.deviceToken ?? generateDeviceToken();
    const firstName = local?.firstName || fallbackFirstName || "Invitado";

    const { data: guestId, error: claimError } = await supabase.rpc("claim_guest_identity", {
      p_event_id: eventId,
      p_device_token: deviceToken,
      p_first_name: firstName,
      p_last_name: local?.lastName ?? null,
    });
    if (claimError || !guestId) {
      console.error("Claim guest identity error:", claimError, guestId);
      return null;
    }

    saveGuest(eventId, {
      guestId: guestId as string,
      deviceToken,
      firstName,
      lastName: local?.lastName,
      avatarUrl: local?.avatarUrl,
    });

    return guestId as string;
  } catch {
    return null;
  }
}
