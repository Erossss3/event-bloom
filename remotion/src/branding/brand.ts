/**
 * Tokens de marca portados directamente de src/styles.css y
 * src/lib/branding.ts de la app principal (LiveMoments). Se mantienen acá
 * en vez de importarse porque este es un proyecto Node/bundle
 * independiente — pero los VALORES tienen que seguir siendo los mismos
 * que usa la app. Si el branding cambia ahí, se replica acá a mano.
 */
export const BRAND = {
  name: "LiveMoments",
  tagline: "Viví y compartí cada evento",

  colors: {
    gold: "oklch(0.72 0.11 78)",
    goldSoft: "oklch(0.88 0.06 82)",
    cream: "oklch(0.97 0.02 82)",
    ink: "oklch(0.22 0.02 60)",
    white: "#ffffff",
  },

  gradientGold: "linear-gradient(135deg, oklch(0.78 0.11 78) 0%, oklch(0.62 0.09 68) 100%)",

  fonts: {
    display: "'Fraunces', 'Cormorant Garamond', Georgia, serif",
    sans: "'Inter', system-ui, -apple-system, sans-serif",
  },
} as const;
