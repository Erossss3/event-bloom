import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayKind, StyleConfig } from "../styles/types";

/**
 * Grano de película + barras de letterbox — look "cine" para el estilo
 * Cinematic. El grano se genera con un filtro SVG feTurbulence cuyo
 * "seed" cambia por frame (useCurrentFrame()), así se ve como ruido en
 * movimiento real, no una textura estática pegada encima.
 */
function FilmGrainLetterbox() {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const barHeight = height * 0.07;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <filter id="film-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 50} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-grain)" />
      </svg>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: barHeight, backgroundColor: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: barHeight, backgroundColor: "#000" }} />
      <AbsoluteFill
        style={{ boxShadow: "inset 0 0 220px rgba(0,0,0,0.55)" }}
      />
    </AbsoluteFill>
  );
}

/** Destello dorado diagonal que barre la pantalla lentamente, en loop —
 * el detalle "premium" del estilo Luxury. */
function GoldSparkle({ accent }: { accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cycleFrames = fps * 6;
  const t = (frame % cycleFrames) / cycleFrames;
  const sweepPercent = interpolate(t, [0, 1], [-40, 140]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: `${sweepPercent}%`,
          width: "18%",
          height: "140%",
          transform: "rotate(20deg)",
          background: `linear-gradient(90deg, transparent, ${accent}33, transparent)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 180px rgba(0,0,0,0.12)" }} />
    </AbsoluteFill>
  );
}

/** Viñeta cálida constante — el tratamiento de color del estilo Emotive. */
function WarmVignette() {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: "radial-gradient(circle at center, transparent 45%, rgba(120,50,20,0.35) 100%)",
        mixBlendMode: "multiply",
      }}
    />
  );
}

/** Destellos tipo flash de cámara, en intervalos irregulares (semilla
 * determinística por frame vía random() de Remotion — reproducible
 * cuadro a cuadro, no Math.random()). El pulso del estilo Party. */
function PartyFlash() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatFrames = Math.round(fps * 0.9);
  const beatIndex = Math.floor(frame / beatFrames);
  const positionInBeat = frame % beatFrames;

  const shouldFlash = random(`party-flash-${beatIndex}`) > 0.6;
  const flashOpacity = shouldFlash
    ? interpolate(positionInBeat, [0, 3, 10], [0, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flashOpacity }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 140px rgba(120,20,180,0.25)" }} />
    </AbsoluteFill>
  );
}

export function Overlay({ kind, style }: { kind: OverlayKind; style: StyleConfig }) {
  switch (kind) {
    case "filmGrainLetterbox":
      return <FilmGrainLetterbox />;
    case "goldSparkle":
      return <GoldSparkle accent={style.accent} />;
    case "warmVignette":
      return <WarmVignette />;
    case "partyFlash":
      return <PartyFlash />;
  }
}
