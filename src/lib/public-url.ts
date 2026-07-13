/**
 * URL pública del sitio publicado (nunca la del preview con login).
 * Usamos el dominio estable `project--<uuid>.lovable.app` que sirve la última publicación.
 */
const PROJECT_ID = "61a1528e-8aad-40ae-8862-4c73b8e99108";
export const PUBLIC_BASE_URL = `https://project--${PROJECT_ID}.lovable.app`;

export function publicEventUrl(slug: string) {
  return `${PUBLIC_BASE_URL}/e/${slug}`;
}
export function publicRsvpUrl(slug: string) {
  return `${PUBLIC_BASE_URL}/r/${slug}`;
}
export function publicSummaryUrl(slug: string, style: string) {
  return `${PUBLIC_BASE_URL}/e/${slug}/summary?style=${encodeURIComponent(style)}`;
}
