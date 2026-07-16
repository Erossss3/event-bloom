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
    ico: `${base}/favicon/favicon.ico`,
    png16: `${base}/favicon/favicon-16x16.png`,
    png32: `${base}/favicon/favicon-32x32.png`,
    png48: `${base}/favicon/favicon-48x48.png`,
    png64: `${base}/favicon/favicon-64x64.png`,
    png128: `${base}/favicon/favicon-128x128.png`,
    png256: `${base}/favicon/favicon-256x256.png`,
    png512: `${base}/favicon/favicon-512x512.png`,
  },

  app: {
    androidChrome192: `${base}/app/android-chrome-192x192.png`,
    androidChrome512: `${base}/app/android-chrome-512x512.png`,
    appleTouchIcon180: `${base}/app/apple-touch-icon-180x180.png`,
    appIcon1024: `${base}/app/app-icon-1024x1024.png`,
  },

  social: {
    ogImage: `${base}/social/og-image-1200x630.png`,
    twitterCard: `${base}/social/twitter-card-1200x600.png`,
  },

  manifest: `${base}/site.webmanifest`,
};

/** Devuelve la ruta del logo pedido. Uso: logoSrc("horizontal", "dark") */
export function logoSrc(type: LogoType, variant: LogoVariant = "dark") {
  return BRAND.logo[type][variant];
}
