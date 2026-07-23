import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import type { TimelineEntry } from "../lib/timeline";
import type { StyleConfig } from "../styles/types";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { BackgroundBlur } from "../components/BackgroundBlur";
import { MessageCard } from "../components/MessageCard";
import { getTransitionPresentation, getTransitionTiming } from "../components/Transition";

interface TimelineSectionProps {
  entries: TimelineEntry[];
  style: StyleConfig;
}

/**
 * Solo recibe las entradas de tipo "photo"/"message" (Root.tsx separa
 * "intro"/"credits" en sus propias secciones) — este componente arma la
 * secuencia central del video, encadenando cada tramo con la transición
 * declarada por el estilo (fade/slide/wipe/cut).
 *
 * Nota para el primer render real: @remotion/transitions superpone cada
 * <TransitionSeries.Transition> sobre el final de una secuencia y el
 * principio de la siguiente, por lo que la duración total efectiva queda
 * levemente por debajo de la suma de "durationInFrames" de lib/timeline.ts
 * (en función de transitionFrames * cantidad de transiciones). No afecta la
 * estructura del proyecto, pero es lo primero a verificar cuadro a cuadro
 * cuando se conecte el renderer.
 */
export function TimelineSection({ entries, style }: TimelineSectionProps) {
  const fps = 30;
  const transitionFrames = Math.round(fps * style.transitionDurationSeconds);
  const presentation = getTransitionPresentation(style.transition);

  return (
    <TransitionSeries>
      {entries.flatMap((entry, i) => {
        const isLast = i === entries.length - 1;

        const content =
          entry.type === "photo" ? (
            <AbsoluteFill>
              <BackgroundBlur photo={entry.photo} blurPx={style.backgroundBlurPx} background={style.background} />
              <KenBurnsImage photo={entry.photo} range={entry.kenBurns} durationInFrames={entry.durationInFrames} />
            </AbsoluteFill>
          ) : entry.type === "message" ? (
            <MessageCard message={entry.message} style={style} durationInFrames={entry.durationInFrames} />
          ) : null;

        if (!content) return [];

        const sequence = (
          <TransitionSeries.Sequence key={`${entry.type}-${i}`} durationInFrames={entry.durationInFrames}>
            {content}
          </TransitionSeries.Sequence>
        );

        if (isLast || !presentation) return [sequence];

        const transition = (
          <TransitionSeries.Transition
            key={`transition-${i}`}
            presentation={presentation}
            timing={getTransitionTiming(transitionFrames)}
          />
        );

        return [sequence, transition];
      })}
    </TransitionSeries>
  );
}
