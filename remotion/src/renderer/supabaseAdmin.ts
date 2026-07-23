import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Único punto de construcción del cliente de Supabase del worker — siempre
 * con la service_role key, nunca con la anon key (ver justificación en
 * fetchEventData.ts). Cacheado por proceso: el worker vive corriendo y
 * procesando jobs en un loop, no tiene sentido reconectar por cada uno.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno del worker (ver remotion/.env.example).",
    );
  }

  cachedClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return cachedClient;
}
