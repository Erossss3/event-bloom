#!/usr/bin/env node
import "dotenv/config";
import { runWorker } from "./runWorker";

/**
 * Punto de entrada para CUALQUIER infraestructura de proceso largo:
 * Docker (`CMD ["node", "dist/worker/cli.js"]`), ECS, Railway, Render,
 * Fly.io, o simplemente `node`. No sabe nada de en qué se está
 * ejecutando — solo arranca el worker y respeta señales de apagado
 * estándar de Unix, que es lo que TODAS esas plataformas mandan antes de
 * matar el proceso (deploy nuevo, scale-down, restart).
 *
 * Configuración por variables de entorno (además de SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY, que ya requiere getSupabaseAdminClient):
 *   VIDEO_WORKER_CONCURRENCY      default 1
 *   VIDEO_WORKER_POLL_INTERVAL_MS default 5000
 *   VIDEO_WORKER_STALE_TIMEOUT_S  default 90
 */
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const handle = runWorker({
  concurrency: readIntEnv("VIDEO_WORKER_CONCURRENCY", 1),
  pollIntervalMs: readIntEnv("VIDEO_WORKER_POLL_INTERVAL_MS", 5_000),
  staleTimeoutSeconds: readIntEnv("VIDEO_WORKER_STALE_TIMEOUT_S", 90),
});

console.log("[video-worker] iniciado");

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[video-worker] recibido ${signal}, esperando a que terminen los jobs en curso...`);
  await handle.stop();
  console.log("[video-worker] apagado limpio completo");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
