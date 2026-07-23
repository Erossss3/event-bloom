/**
 * URL pública del sitio publicado (nunca la del preview con login).
 */
export const PUBLIC_BASE_URL = "https://livemoments-ruddy.vercel.app";

export function publicEventUrl(slug: string) {
  return `${PUBLIC_BASE_URL}/e/${slug}`;
}
export function publicRsvpUrl(slug: string) {
  return `${PUBLIC_BASE_URL}/r/${slug}`;
}
