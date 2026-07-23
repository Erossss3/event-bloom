import { Composition } from "remotion";
import { VideoSummary } from "./compositions/VideoSummary";
import type { VideoSummaryInputProps } from "./types";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

/**
 * defaultProps es un campo obligatorio de <Composition> (lo exige la API de
 * Remotion para poder abrir el Studio sin pasarle props por fuera) — no es
 * un dato de prueba: en producción, el worker SIEMPRE invoca el render con
 * props reales armadas por renderer/fetchEventData.ts, que sobreescriben
 * este objeto por completo. Se deja "photos: []" porque la validación
 * estricta (mínimo 1 foto, URLs válidas, etc. — ver lib/assertProps.ts) vive
 * en renderer/renderVideoSummary.ts, que es el punto real donde importa
 * antes de gastar cómputo de render: acá solo tiene que poder abrir el
 * Studio sin crashear.
 */
const defaultProps: VideoSummaryInputProps = {
  event: { id: "", slug: "", title: "", eventDate: null, coverUrl: null },
  style: "cinematic",
  durationSeconds: 60,
  photos: [],
  messages: [],
};

export function Root() {
  return (
    <>
      <Composition
        id="VideoSummary"
        component={VideoSummary}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        durationInFrames={FPS * defaultProps.durationSeconds}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: Math.round(props.durationSeconds * FPS),
          props,
        })}
      />
    </>
  );
}
