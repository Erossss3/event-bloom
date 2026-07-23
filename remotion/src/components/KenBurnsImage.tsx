import { useState, type CSSProperties } from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame } from "remotion";
import type { KenBurnsRange } from "../styles/types";
import type { GalleryPhotoInput } from "../types";
import { getFitMode } from "../lib/fit";

interface KenBurnsImageProps {
  photo: GalleryPhotoInput;
  range: KenBurnsRange;
  durationInFrames: number;
}

/**
 * Aplica el paneo/zoom (Ken Burns) de forma declarativa: en cada frame
 * calcula scale/translate por interpolación lineal entre el "from" y el
 * "to" de la variante asignada — nada de estado ni de animación imperativa,
 * consistente con el modelo de Remotion (cada frame se renderiza de forma
 * determinística a partir de su número de frame).
 *
 * Recorte inteligente: getFitMode() decide, según el aspect ratio real de
 * la foto (width/height de "gallery"), si conviene llenar el cuadro
 * completo ("cover", fotos horizontales cercanas a 16:9 — sin esto,
 * quedaban con el mismo tratamiento que una vertical) o conservarla
 * entera con el fondo desenfocado detrás ("contain", fotos verticales).
 *
 * Tolerancia a archivos rotos: una foto/video con la URL caída (borrado
 * de Storage después de aprobado, archivo corrupto) no debe abortar el
 * render completo — un solo asset roto no puede tirar abajo un video de
 * 90 segundos con otras 40 fotos buenas. Si Img/OffthreadVideo disparan
 * onError, se deja de intentar mostrar ese archivo (el fondo del estilo
 * queda visible en su lugar) en vez de dejar que el error se propague.
 */
export function KenBurnsImage({ photo, range, durationInFrames }: KenBurnsImageProps) {
  const frame = useCurrentFrame();
  const fitMode = getFitMode(photo);
  const [failed, setFailed] = useState(false);

  const scale = interpolate(frame, [0, durationInFrames], [range.fromScale, range.toScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(frame, [0, durationInFrames], [range.fromXPercent, range.toXPercent], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [0, durationInFrames], [range.fromYPercent, range.toYPercent], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (failed) {
    return null;
  }

  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: fitMode,
    transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {photo.kind === "video" ? (
        <OffthreadVideo src={photo.url} style={style} muted onError={() => setFailed(true)} />
      ) : (
        <Img src={photo.url} style={style} onError={() => setFailed(true)} />
      )}
    </AbsoluteFill>
  );
}
