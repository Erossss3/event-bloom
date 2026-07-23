import type { StyleConfig } from "./types";
import { BRAND } from "../branding/brand";

/**
 * LUXURY — el más pausado de los 4, casi estático, con un destello
 * dorado diagonal que cruza la pantalla (evoca invitaciones de boda de
 * gama alta). Fondo claro, tipografía display protagonista.
 */
export const luxury: StyleConfig = {
  id: "luxury",
  label: "Luxury",

  background: BRAND.colors.cream,
  accent: BRAND.colors.gold,
  textColor: BRAND.colors.ink,
  fontFamily: BRAND.fonts.display,

  photoDurationSeconds: 5.5,
  minPhotoDurationSeconds: 4,
  maxPhotoDurationSeconds: 8,
  introDurationSeconds: 5,
  creditsDurationSeconds: 6,

  kenBurns: [
    { fromScale: 1.0, toScale: 1.05, fromXPercent: 0, toXPercent: -1.5, fromYPercent: 0, toYPercent: 0 },
    { fromScale: 1.04, toScale: 1.0, fromXPercent: -1, toXPercent: 1, fromYPercent: 1, toYPercent: -0.5 },
  ],

  transition: "fade",
  transitionDurationSeconds: 1.4,

  backgroundBlurPx: 40,
  messageEveryNPhotos: 5,
  maxMessages: 5,

  overlay: "goldSparkle",
};
