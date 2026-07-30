import { Composition } from "remotion";
import { VideoSummary } from "./compositions/VideoSummary";
import { videoSummaryInputPropsSchema } from "./lib/assertProps";
import type { VideoSummaryInputProps } from "./types";

const FPS = 30;
// Bajado de 1920x1080 a 1280x720 para entrar en un plan de Railway con
// techo de 1GB de RAM: la cuenta de píxeles por frame queda en ~44% de la
// original, que es la reducción de memoria de mayor impacto disponible sin
// tocar la arquitectura del render. Si en algún momento se sube el plan de
// Railway (2GB+), este es el primer valor a revertir a 1920x1080.
const WIDTH = 1280;
const HEIGHT = 720;

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
      <Composition<typeof videoSummaryInputPropsSchema, VideoSummaryInputProps>
        id="VideoSummary"
        component={VideoSummary}
        schema={videoSummaryInputPropsSchema}
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
