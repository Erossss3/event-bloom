import { pollAndProcessOnce, type PollOnceOptions } from "./pollAndProcessOnce";

export interface RunWorkerOptions extends PollOnceOptions {
  /** Cuántos "carriles" independientes de reclamo corren en paralelo
   * DENTRO de este mismo proceso. Escalar horizontalmente (correr más
   * instancias de este worker en procesos/containers distintos) es la
   * forma recomendada de sumar capacidad — esto es la concurrencia local
   * de un único proceso, y por default es 1 porque un render de Remotion
   * ya usa Chrome headless de forma intensiva en CPU/memoria. Default: 1. */
  concurrency?: number;
  /** Cada cuánto un carril reintenta reclamar cuando no encontró ningún
   * job en cola. Default: 5000ms. */
  pollIntervalMs?: number;
  /** Si pollAndProcessOnce() lanza (error de infraestructura, no de un
   * job puntual — esos ya se resuelven como mark_video_failed dentro de
   * processVideoJob), cuánto espera ese carril antes de reintentar, para
   * no entrar en un loop caliente contra una base caída. Default: 10000ms. */
  errorBackoffMs?: number;
  onLog?: (message: string) => void;
}

export interface WorkerHandle {
  /** Señala a todos los carriles que dejen de reclamar jobs nuevos y
   * espera a que los jobs ya en curso terminen antes de resolver — usar
   * en el handler de SIGTERM/SIGINT del proceso que lo hospeda (ver
   * worker/cli.ts). Un container orquestado (ECS/Fly/Railway) manda
   * SIGTERM antes de matar el proceso; esto evita interrumpir un render a
   * mitad de camino en un deploy o un scale-down. */
  stop: () => Promise<void>;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Arranca `concurrency` carriles de reclamo independientes, cada uno con su
 * propio loop secuencial (reclamar -> procesar -> repetir). Ningún carril
 * necesita saber de los otros: la seguridad frente a condiciones de carrera
 * vive enteramente en claim_next_video_job() (FOR UPDATE SKIP LOCKED) del
 * lado de Postgres, no en coordinación en memoria acá.
 *
 * Pensado para correr indefinidamente dentro de UN proceso de larga
 * duración (Docker/ECS/Railway/Render/Fly.io). NO es lo que se usaría desde
 * una Lambda o una Edge Function disparadora — para eso, invocar
 * pollAndProcessOnce() directamente una vez por invocación (ver
 * worker/index.ts).
 *
 * Múltiples INSTANCIAS de runWorker() (en procesos/containers distintos)
 * pueden correr al mismo tiempo sin ninguna coordinación entre sí, por el
 * mismo motivo.
 */
export function runWorker(options: RunWorkerOptions = {}): WorkerHandle {
  const {
    concurrency = 1,
    pollIntervalMs = 5_000,
    errorBackoffMs = 10_000,
    onLog = console.log,
    ...pollOptions
  } = options;

  let shuttingDown = false;
  const lanes = new Set<Promise<void>>();

  async function runLane(laneId: number): Promise<void> {
    while (!shuttingDown) {
      let attempt: Awaited<ReturnType<typeof pollAndProcessOnce>>;
      try {
        attempt = await pollAndProcessOnce(pollOptions);
      } catch (err) {
        onLog(`[video-worker#${laneId}] error de infraestructura, reintentando en ${errorBackoffMs}ms: ${String(err)}`);
        await sleep(errorBackoffMs);
        continue;
      }

      if (!attempt.claimed) {
        await sleep(pollIntervalMs);
        continue;
      }

      onLog(
        attempt.result.ok
          ? `[video-worker#${laneId}] job ${attempt.videoId} completado (${attempt.result.storagePath})`
          : `[video-worker#${laneId}] job ${attempt.videoId} no completado: ${attempt.result.errorMessage}`,
      );
      // Sin sleep acá a propósito: si había un job para procesar, es
      // razonable intentar reclamar el siguiente de inmediato en vez de
      // esperar un ciclo de poll completo.
    }
  }

  for (let i = 0; i < concurrency; i++) {
    const lane = runLane(i).finally(() => lanes.delete(lane));
    lanes.add(lane);
  }

  return {
    async stop() {
      shuttingDown = true;
      await Promise.allSettled([...lanes]);
    },
  };
}
