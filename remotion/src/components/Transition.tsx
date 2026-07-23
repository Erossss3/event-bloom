import { linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { TransitionKind } from "../styles/types";

/**
 * <TransitionSeries.Transition> (usado en sections/Timeline.tsx) necesita un
 * objeto "presentation" + "timing" — esta función traduce el TransitionKind
 * declarativo de cada estilo (styles/*.ts) a la presentación real de
 * @remotion/transitions. "cut" no genera transición: se resuelve devolviendo
 * null y el timeline directamente no encierra ese tramo en un
 * <TransitionSeries.Transition>.
 */
export function getTransitionPresentation(kind: TransitionKind) {
  switch (kind) {
    case "fade":
      return fade();
    case "slide":
      return slide();
    case "wipe":
      return wipe();
    case "cut":
      return null;
  }
}

export function getTransitionTiming(durationInFrames: number) {
  return linearTiming({ durationInFrames });
}
