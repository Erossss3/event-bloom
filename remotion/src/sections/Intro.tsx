import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { EventInfo } from "../types";
import type { StyleConfig } from "../styles/types";

interface IntroProps {
  event: EventInfo;
  style: StyleConfig;
  durationInFrames: number;
}

function formatEventDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * Entrada elegante en 3 tiempos, dentro de la misma duración de intro:
 *   1) el logo de LiveMoments aparece solo, centrado (marca de la app)
 *   2) el logo se achica y sube, el nombre del evento aparece debajo
 *   3) fade-out de todo el bloque hacia el timeline de fotos
 * Antes esta sección no incluía el logo en absoluto — solo texto.
 */
export function Intro({ event, style, durationInFrames }: IntroProps) {
  const frame = useCurrentFrame();
  const logoVariant = style.id === "luxury" ? "dark" : "light";

  const logoOnlyPhase = Math.min(30, Math.round(durationInFrames * 0.35));
  const logoOpacity = interpolate(frame, [0, 15, logoOnlyPhase, logoOnlyPhase + 15], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoScale = interpolate(frame, [0, logoOnlyPhase], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleStart = logoOnlyPhase;
  const titleOpacity = interpolate(frame, [titleStart, titleStart + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [titleStart, titleStart + 18], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dateLabel = formatEventDate(event.eventDate);

  return (
    <AbsoluteFill style={{ backgroundColor: style.background, alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: logoOpacity, transform: `scale(${logoScale})` }}>
        <Img src={staticFile(`logos/wordmark-${logoVariant}.svg`)} style={{ height: 72 }} />
      </AbsoluteFill>

      <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
        <h1 style={{ fontFamily: style.fontFamily, fontSize: 96, color: style.textColor, margin: 0, fontWeight: 500 }}>
          {event.title}
        </h1>
        {dateLabel && (
          <p style={{ fontFamily: style.fontFamily, fontSize: 34, color: style.accent, marginTop: 20 }}>{dateLabel}</p>
        )}
      </div>
    </AbsoluteFill>
  );
}
