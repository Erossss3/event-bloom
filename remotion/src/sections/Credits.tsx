import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { StyleConfig } from "../styles/types";

interface CreditsProps {
  style: StyleConfig;
  durationInFrames: number;
}

/**
 * Cierre en 2 tiempos: agradecimiento + logo aparecen con la misma
 * elegancia que el intro, y sobre el final TODO el cuadro funde a negro
 * (no solo a opacidad del contenido) — el "cierre cinematográfico" real,
 * en vez de un corte seco al final del video.
 */
export function Credits({ style, durationInFrames }: CreditsProps) {
  const frame = useCurrentFrame();

  const contentOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contentScale = interpolate(frame, [0, 20], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeToBlackStart = durationInFrames - 25;
  const fadeToBlack = interpolate(frame, [fadeToBlackStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoVariant = style.id === "luxury" ? "dark" : "light";

  return (
    <AbsoluteFill style={{ backgroundColor: style.background, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", opacity: contentOpacity, transform: `scale(${contentScale})` }}>
        <p style={{ fontFamily: style.fontFamily, fontSize: 44, color: style.textColor, marginBottom: 40 }}>
          Gracias por celebrar con nosotros
        </p>
        <Img src={staticFile(`logos/wordmark-${logoVariant}.svg`)} style={{ height: 44, margin: "0 auto" }} />
      </div>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeToBlack }} />
    </AbsoluteFill>
  );
}
