/**
 * Sistema centralizado de branding de LiveMoments.
 *
 * Todos los recursos de marca (logos, favicons, app icons, imágenes sociales)
 * viven en /public/branding y se referencian únicamente desde acá.
 * Si un recurso cambia de ruta, solo hay que actualizarlo en este archivo.
 */

export type LogoVariant = "dark" | "light";
export type LogoType = "horizontal" | "vertical" | "mark" | "wordmark";

const base = "/branding";

/**
 * Se incrementa cada vez que cambian los assets de marca (favicons, app icons, manifest).
 * Los navegadores cachean favicons de forma muy agresiva; este query param fuerza
 * que se vuelvan a descargar en vez de servir la versión vieja desde caché.
 */
const BRAND_VERSION = "2";
function v(path: string) {
  return `${path}?v=${BRAND_VERSION}`;
}

export const BRAND = {
  name: "LiveMoments",
  tagline: "Viví y compartí cada evento",
  themeColor: "#b8946a",

  logo: {
    horizontal: {
      dark: `${base}/logos/horizontal/logo-dark.svg`,
      light: `${base}/logos/horizontal/logo-light.svg`,
    },
    vertical: {
      dark: `${base}/logos/vertical/logo-dark.svg`,
      light: `${base}/logos/vertical/logo-light.svg`,
    },
    mark: {
      dark: `${base}/logos/mark/mark-dark.svg`,
      light: `${base}/logos/mark/mark-light.svg`,
    },
    wordmark: {
      dark: `${base}/logos/wordmark/wordmark-dark.svg`,
      light: `${base}/logos/wordmark/wordmark-light.svg`,
    },
  } satisfies Record<LogoType, Record<LogoVariant, string>>,

  favicon: {
    ico: v(`${base}/favicon/favicon.ico`),
    png16: v(`${base}/favicon/favicon-16x16.png`),
    png32: v(`${base}/favicon/favicon-32x32.png`),
    png48: v(`${base}/favicon/favicon-48x48.png`),
    png64: v(`${base}/favicon/favicon-64x64.png`),
    png128: v(`${base}/favicon/favicon-128x128.png`),
    png256: v(`${base}/favicon/favicon-256x256.png`),
    png512: v(`${base}/favicon/favicon-512x512.png`),
  },

  app: {
    androidChrome192: v(`${base}/app/android-chrome-192x192.png`),
    androidChrome512: v(`${base}/app/android-chrome-512x512.png`),
    appleTouchIcon180: v(`${base}/app/apple-touch-icon-180x180.png`),
    appIcon1024: v(`${base}/app/app-icon-1024x1024.png`),
  },

  social: {
    ogImage: v(`${base}/social/og-image-1200x630.png`),
    twitterCard: v(`${base}/social/twitter-card-1200x600.png`),
  },

  manifest: v(`${base}/site.webmanifest`),
};

/** Devuelve la ruta del logo pedido. Uso: logoSrc("horizontal", "dark") */
export function logoSrc(type: LogoType, variant: LogoVariant = "dark") {
  return BRAND.logo[type][variant];
}
