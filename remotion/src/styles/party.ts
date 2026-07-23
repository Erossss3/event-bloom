import type { StyleConfig } from "./types";

/**
 * PARTY — el más rápido y físico: zoom marcado, wipes cortos, destellos
 * tipo flash de cámara entre fotos. Casi sin mensajes (el ritmo visual
 * es el protagonista, no el texto).
 */
export const party: StyleConfig = {
  id: "party",
  label: "Party",

  background: "oklch(0.16 0.04 300)",
  accent: "oklch(0.72 0.19 320)",
  textColor: "#FFFFFF",
  fontFamily: "'Inter', system-ui, sans-serif",

  photoDurationSeconds: 2.2,
  minPhotoDurationSeconds: 1.5,
  maxPhotoDurationSeconds: 3.5,
  introDurationSeconds: 2.5,
  creditsDurationSeconds: 4,

  kenBurns: [
    { fromScale: 1.0, toScale: 1.28, fromXPercent: 0, toXPercent: 0, fromYPercent: 0, toYPercent: 0 },
    { fromScale: 1.25, toScale: 1.0, fromXPercent: 5, toXPercent: -5, fromYPercent: 0, toYPercent: 0 },
    { fromScale: 1.1, toScale: 1.22, fromXPercent: -5, toXPercent: 5, fromYPercent: -4, toYPercent: 4 },
  ],

  transition: "wipe",
  transitionDurationSeconds: 0.3,

  backgroundBlurPx: 70,
  messageEveryNPhotos: 10,
  maxMessages: 3,

  overlay: "partyFlash",
};
