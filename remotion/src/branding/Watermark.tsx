import { AbsoluteFill, Img, staticFile } from "remotion";
import type { VideoStyleId } from "../types";

/**
 * Overlay de marca, presente durante toda la composición (no solo en
 * intro/créditos) — igual criterio que usan las plataformas de video
 * (marca de agua discreta en una esquina). El variant claro/oscuro se
 * elige según el estilo, para que siempre haya contraste contra el fondo
 * predominante de cada uno (ver styles/*.ts).
 */
export function Watermark({ style }: { style: VideoStyleId }) {
  const variant: "light" | "dark" = style === "luxury" ? "dark" : "light";
  const src = staticFile(`logos/mark-${variant}.svg`);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          bottom: 48,
          right: 48,
          opacity: 0.85,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
        }}
      >
        <Img src={src} style={{ height: 40, width: "auto" }} />
      </div>
    </AbsoluteFill>
  );
}
