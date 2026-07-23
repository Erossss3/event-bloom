import type { StyleConfig } from "./types";
import { BRAND } from "../branding/brand";

/**
 * CINEMATIC — ritmo pausado, tratamiento de "película": barras de
 * letterbox, grano sutil, zoom lento y amplio. Menos mensajes, más
 * protagonismo de la imagen.
 */
export const cinematic: StyleConfig = {
  id: "cinematic",
  label: "Cinematic",

  background: "oklch(0.18 0.01 260)",
  accent: BRAND.colors.gold,
  textColor: "#F5F1E8",
  fontFamily: BRAND.fonts.display,

  photoDurationSeconds: 4.5,
  minPhotoDurationSeconds: 3,
  maxPhotoDurationSeconds: 7,
  introDurationSeconds: 4,
  creditsDurationSeconds: 5,

  kenBurns: [
    { fromScale: 1.0, toScale: 1.18, fromXPercent: 0, toXPercent: -5, fromYPercent: 0, toYPercent: -3 },
    { fromScale: 1.12, toScale: 1.0, fromXPercent: -4, toXPercent: 3, fromYPercent: 3, toYPercent: 0 },
    { fromScale: 1.0, toScale: 1.22, fromXPercent: 3, toXPercent: -3, fromYPercent: -3, toYPercent: 4 },
  ],

  transition: "fade",
  transitionDurationSeconds: 1.0,

  backgroundBlurPx: 60,
  messageEveryNPhotos: 6,
  maxMessages: 4,

  overlay: "filmGrainLetterbox",
};
