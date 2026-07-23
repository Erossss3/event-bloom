import type { StyleConfig } from "./types";
import { BRAND } from "../branding/brand";

/**
 * EMOTIVE — cálido y cercano: viñeta color-grade tibia (nunca grano ni
 * destellos), ritmo medio, y el estilo que más mensajes deja entrar —
 * la cercanía con los invitados es el punto central acá.
 */
export const emotive: StyleConfig = {
  id: "emotive",
  label: "Emotive",

  background: "oklch(0.94 0.03 40)",
  accent: "oklch(0.68 0.14 30)",
  textColor: BRAND.colors.ink,
  fontFamily: BRAND.fonts.display,

  photoDurationSeconds: 4.0,
  minPhotoDurationSeconds: 2.5,
  maxPhotoDurationSeconds: 6,
  introDurationSeconds: 3.5,
  creditsDurationSeconds: 5,

  kenBurns: [
    { fromScale: 1.02, toScale: 1.12, fromXPercent: 0, toXPercent: 4, fromYPercent: 0, toYPercent: -4 },
    { fromScale: 1.12, toScale: 1.02, fromXPercent: 4, toXPercent: -4, fromYPercent: -3, toYPercent: 3 },
  ],

  transition: "slide",
  transitionDurationSeconds: 0.6,

  backgroundBlurPx: 50,
  messageEveryNPhotos: 4,
  maxMessages: 8,

  overlay: "warmVignette",
};
