import { useState } from "react";
import { AbsoluteFill, Img } from "remotion";
import type { GalleryPhotoInput } from "../types";
import { getFitMode } from "../lib/fit";

interface BackgroundBlurProps {
  photo: GalleryPhotoInput;
  blurPx: number;
  background: string;
}

/**
 * Muchas fotos de invitados son verticales (celular) mientras que el
 * resumen se renderiza en 16:9 — en vez de dejar barras negras a los
 * costados, se pone la misma foto de fondo, agrandada y desenfocada, detrás
 * de la versión "contain" que sí se ve nítida (mismo recurso visual que
 * usan Instagram Stories/Spotify Canvas para fotos de otra relación de
 * aspecto).
 *
 * Si getFitMode() ya decidió "cover" para esta foto (aspect ratio cercano
 * a 16:9), la foto en primer plano llena el cuadro entero y este fondo
 * nunca sería visible — no tiene sentido componerlo (es trabajo de
 * decodificación/filtro de imagen que Chrome haría para nada), así que
 * directamente no se renderiza nada.
 */
export function BackgroundBlur({ photo, blurPx, background }: BackgroundBlurProps) {
  const fitMode = getFitMode(photo);
  const [failed, setFailed] = useState(false);

  if (fitMode === "cover") {
    return null;
  }

  if (photo.kind === "video" || failed) {
    // Un <video> de fondo duplicado sería doble decodificación por frame —
    // demasiado costoso para un blur que de por sí queda casi irreconocible.
    // Para videos, o si la foto de fondo falló al cargar, se usa
    // directamente el color de fondo del estilo.
    return <AbsoluteFill style={{ backgroundColor: background }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: background, overflow: "hidden" }}>
      <Img
        src={photo.url}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: `blur(${blurPx}px) brightness(0.55)`,
          transform: "scale(1.15)", // evita que el borde desenfocado del blur se note en los bordes del frame
        }}
      />
    </AbsoluteFill>
  );
}
