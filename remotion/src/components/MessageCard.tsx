import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { MessageInput } from "../types";
import type { StyleConfig } from "../styles/types";

interface MessageCardProps {
  message: MessageInput;
  style: StyleConfig;
  durationInFrames: number;
}

const MAX_DISPLAY_CHARS = 220;

function truncateForDisplay(text: string): string {
  if (text.length <= MAX_DISPLAY_CHARS) return text;
  // Corta en el último espacio antes del límite para no partir una
  // palabra a la mitad — "messages.body" permite hasta 1000 caracteres
  // (constraint de la base), muy por encima de lo que un cuadro de video
  // puede mostrar legible.
  const cut = text.slice(0, MAX_DISPLAY_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : MAX_DISPLAY_CHARS)}…`;
}

export function MessageCard({ message, style, durationInFrames }: MessageCardProps) {
  const frame = useCurrentFrame();
  const displayBody = truncateForDisplay(message.body);
  // Mensajes largos (aun truncados a 220 caracteres) necesitan una
  // tipografía más chica que uno corto para no apretarse — nunca por
  // debajo de un piso legible.
  const fontSize = displayBody.length > 140 ? 38 : displayBody.length > 70 ? 46 : 52;

  // Fade-in/out suave dentro de su propia duración, independiente de la
  // transición entre secciones (esta es la animación INTERNA de la tarjeta).
  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: style.background,
        alignItems: "center",
        justifyContent: "center",
        padding: 120,
        opacity,
      }}
    >
      <div style={{ maxWidth: "70%", textAlign: "center" }}>
        {message.emoji && <div style={{ fontSize: 64, marginBottom: 24 }}>{message.emoji}</div>}
        <p
          style={{
            fontFamily: style.fontFamily,
            fontSize,
            lineHeight: 1.4,
            color: style.textColor,
            margin: 0,
          }}
        >
          “{displayBody}”
        </p>
        <p
          style={{
            marginTop: 32,
            fontFamily: style.fontFamily,
            fontSize: 30,
            color: style.accent,
            fontWeight: 600,
          }}
        >
          — {message.authorName}
        </p>
      </div>
    </AbsoluteFill>
  );
}
