import { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { VideoSummaryInputProps } from "../types";
import { getStyleConfig } from "../styles";
import { buildTimeline } from "../lib/timeline";
import { loadBrandFonts } from "../lib/loadFonts";
import { Intro } from "../sections/Intro";
import { TimelineSection } from "../sections/Timeline";
import { Credits } from "../sections/Credits";
import { Watermark } from "../branding/Watermark";
import { Overlay } from "../components/Overlay";

loadBrandFonts();

/**
 * Composición única y paramétrica — NO hay una composición por estilo.
 * El estilo es un prop más (`props.style`), igual que en la app principal
 * (VideoSummarySection.tsx), así que agregar un quinto estilo el día de
 * mañana es agregar un archivo en styles/ y una entrada en styles/index.ts,
 * nunca una composición nueva acá.
 */
export function VideoSummary(props: VideoSummaryInputProps) {
  const { fps } = useVideoConfig();
  const style = getStyleConfig(props.style);

  // Remotion invoca este componente una vez POR CUADRO (para un video de
  // 90s a 30fps, 2700 veces) — buildTimeline() no depende de "frame", solo
  // de las props y el estilo, así que recalcular el reparto completo en
  // cada uno de esos renders sería trabajo repetido sin ninguna necesidad.
  const timeline = useMemo(() => buildTimeline(props, style, fps), [props, style, fps]);

  const introEntry = timeline.entries.find((e) => e.type === "intro");
  const creditsEntry = timeline.entries.find((e) => e.type === "credits");
  const contentEntries = timeline.entries.filter((e) => e.type === "photo" || e.type === "message");

  if (!introEntry || !creditsEntry) {
    // No debería pasar nunca: buildTimeline() siempre agrega intro/credits.
    // Se deja como guarda explícita en vez de un `!` para que un cambio futuro
    // en lib/timeline.ts falle de forma ruidosa acá en vez de silenciosa.
    throw new Error("El timeline generado no tiene intro/credits — revisar lib/timeline.ts");
  }

  return (
    <AbsoluteFill style={{ backgroundColor: style.background }}>
      <Sequence from={introEntry.startFrame} durationInFrames={introEntry.durationInFrames}>
        <Intro event={props.event} style={style} durationInFrames={introEntry.durationInFrames} />
      </Sequence>

      <Sequence from={contentEntries[0]?.startFrame ?? introEntry.durationInFrames}>
        <TimelineSection entries={contentEntries} style={style} />
      </Sequence>

      <Sequence from={creditsEntry.startFrame} durationInFrames={creditsEntry.durationInFrames}>
        <Credits style={style} durationInFrames={creditsEntry.durationInFrames} />
      </Sequence>

      {/* El overlay corre durante TODA la composición (intro + timeline +
          créditos), no solo sobre las fotos — es lo que le da identidad
          continua al estilo elegido, no un efecto puntual sobre cada foto. */}
      <Overlay kind={style.overlay} style={style} />

      <Watermark style={props.style} />
    </AbsoluteFill>
  );
}
