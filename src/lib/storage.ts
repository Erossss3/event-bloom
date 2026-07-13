import { supabase } from "@/integrations/supabase/client";

/**
 * URL pública para un objeto en un bucket privado a través de firma con 1 año de duración.
 * Los buckets son privados por política de la plataforma pero las policies permiten SELECT a anon,
 * así que usamos createSignedUrl que funciona con la anon key.
 */
export async function signedUrl(bucket: string, path: string, expiresIn = 60 * 60 * 24 * 365): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("No pudo firmarse URL");
  return data.signedUrl;
}

export function publicOrSignedPath(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadToBucket(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType?: string,
): Promise<{ path: string; url: string }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: contentType ?? (file instanceof File ? file.type : undefined),
    cacheControl: "3600",
  });
  if (error) throw error;
  const url = await signedUrl(bucket, path);
  return { path, url };
}
