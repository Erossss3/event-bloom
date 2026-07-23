import type { VideoStyleId } from "../types";

/** Un recorrido de paneo/zoom (Ken Burns) expresado en porcentajes, no en píxeles —
 * así funciona igual sin importar el tamaño real de la composición. */
export interface KenBurnsRange {
  fromScale: number;
  toScale: number;
  fromXPercent: number;
  toXPercent: number;
  fromYPercent: number;
  toYPercent: number;
}

export type TransitionKind = "fade" | "slide" | "wipe" | "cut";

/** Overlay visual propio del estilo — esto es lo que hace que los 4
 * estilos sean 4 experiencias distintas y no la misma composición con
 * otra paleta de colores. Cada uno se implementa en components/Overlay.tsx. */
export type OverlayKind = "filmGrainLetterbox" | "goldSparkle" | "warmVignette" | "partyFlash";

export interface StyleConfig {
  id: VideoStyleId;
  label: string;

  background: string;
  accent: string;
  textColor: string;
  fontFamily: string;

  /** Duración IDEAL de cada foto en el timeline, en segundos — el ritmo
   * natural que define la identidad del estilo (cinematic pausado, party
   * ágil). lib/timeline.ts la usa como punto de partida, pero la
   * estira o comprime dentro de [minPhotoDurationSeconds,
   * maxPhotoDurationSeconds] para que la suma total siempre coincida con
   * la duración elegida (30/60/90s) sin importar cuántas fotos reales
   * haya disponibles. */
  photoDurationSeconds: number;
  /** Piso: por debajo de esto una foto se siente "demasiado rápida" — el
   * timeline nunca la deja caer más abajo aunque haya muchísimas fotos. */
  minPhotoDurationSeconds: number;
  /** Techo: por encima de esto una foto se siente "congelada" — el
   * timeline nunca la estira más aunque haya muy pocas fotos (en ese
   * caso, ver messageEveryNPhotos/maxMessages para llenar el resto). */
  maxPhotoDurationSeconds: number;

  introDurationSeconds: number;
  creditsDurationSeconds: number;

  /** Pool de variantes de Ken Burns; se van rotando foto a foto. La
   * amplitud de estos rangos (no solo su forma) es parte de lo que
   * distingue el "movimiento" de cada estilo — cinematic/luxury usan
   * rangos chicos y lentos, party usa rangos grandes y rápidos. */
  kenBurns: KenBurnsRange[];

  transition: TransitionKind;
  transitionDurationSeconds: number;

  /** Intensidad del blur de fondo (px) detrás de fotos verticales. */
  backgroundBlurPx: number;

  /** Cada cuántas fotos se intercala una MessageCard (0 = nunca). */
  messageEveryNPhotos: number;
  /** Tope de mensajes por video — el organizador (vía
   * VideoSummaryInputProps.maxMessages) puede bajarlo, nunca subirlo por
   * encima de este default del estilo. */
  maxMessages: number;

  /** Overlay visual exclusivo de este estilo (grano/viñeta/destello/etc). */
  overlay: OverlayKind;
}
