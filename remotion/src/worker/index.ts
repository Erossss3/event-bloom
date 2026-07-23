/**
 * Superficie pública del worker. El CLI (worker/cli.ts) es una forma de
 * usar esto; NO es la única. Un handler de AWS Lambda o una Edge Function
 * disparadora por cron deberían importar directamente
 * `pollAndProcessOnce()` (una unidad de trabajo por invocación) en vez de
 * `runWorker()` (que asume un proceso de larga duración con su propio
 * loop) — ver remotion/README.md, sección "Cómo conectar cada
 * infraestructura".
 */
export { pollAndProcessOnce, type PollOnceOptions, type PollOnceResult } from "./pollAndProcessOnce";
export { runWorker, type RunWorkerOptions, type WorkerHandle } from "./runWorker";
export { claimNextVideoJob } from "./claimNextJob";
