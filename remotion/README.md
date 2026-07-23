# livemoments-video-summary

Proyecto Remotion **independiente** que genera los Video Summary de LiveMoments.
No forma parte del bundle de la app principal (TanStack Start/Vite en la raíz
del repo) ni se importa desde `src/` — es un proceso Node separado, con su
propio `package.json`.

## Estado actual

El proyecto está **completo como arquitectura y sin conectar a ningún
disparador real todavía**:

- Las composiciones, estilos, componentes y el loader/renderer/uploader están
  escritos y son código real (no hay ejemplos ni placeholders de prueba).
- `renderer/index.ts` (`processVideoJob`) sí es invocado — por
  `worker/pollAndProcessOnce.ts`, que a su vez usa `worker/runWorker.ts` (loop
  de carriles) o se puede invocar una unidad de trabajo a la vez. Lo que
  todavía no existe es qué INFRAESTRUCTURA externa dispara ese worker en
  producción (Docker/ECS/Railway/Render/Fly.io corriendo `runWorker()`, o más
  adelante una Lambda) — esa es la próxima fase.
- No se instalaron dependencias ni se ejecutó ningún render desde acá.

## Cómo se conecta con el resto de LiveMoments

```
                     ┌─────────────────────────────┐
  organizador ──────▶│ request_video_summary()     │  (Postgres RPC, SECURITY DEFINER)
  (frontend)         │ INSERT INTO videos (queued)  │
                     └──────────────┬──────────────┘
                                    │ status='queued'
                                    ▼
                     ┌─────────────────────────────┐
  worker (runWorker/ │ claim_next_video_job()       │  (FOR UPDATE SKIP LOCKED — reclamo
  pollAndProcessOnce)│  status='queued'→'processing'│   atómico, ver src/worker/)
                     └──────────────┬──────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │ processVideoJob(job)         │  ← este proyecto
                     │  1. valida que sigue          │
                     │     'processing' antes de     │
                     │     gastar CPU                │
                     │  2. fetchEventData()  ────────┼──▶ Supabase (service_role, solo lectura)
                     │  3. renderVideoSummary() ─────┼──▶ @remotion/renderer (bundle + render,
                     │     con mark_video_heartbeat/  │    heartbeat + cancelación en cada
                     │     mark_video_progress        │    tick de progreso)
                     │  4. uploadRenderedVideo() ─────┼──▶ Storage bucket "exports"
                     │  5. mark_video_completed()     │
                     │     (o mark_video_failed())    │
                     └─────────────────────────────┘
                                    │ status='completed'
                                    ▼
                     organizador ve el resultado (Realtime en "videos")
                     y lo descarga; público lo ve vía la vista "videos_public"
```

Lo que todavía no está conectado es exclusivamente el DISPARADOR de `runWorker()`/`pollAndProcessOnce()` en una infraestructura real (Docker/ECS/Railway/Render/Fly.io o, más adelante, Lambda) — el worker en sí ya existe y es funcional.

## Estructura

```
src/
  index.ts / Root.tsx     Entrada de Remotion — una única composición
                          paramétrica "VideoSummary" (el estilo es un prop,
                          no una composición distinta por estilo).
  types.ts                Contrato de datos: VideoSummaryInputProps. Si esto
                          cambia, cambian en conjunto fetchEventData.ts (lo
                          arma) y renderVideoSummary.ts (lo valida).
  branding/               Colores/fuentes/logo reales de LiveMoments.
  styles/                 Un archivo por estilo (cinematic/luxury/emotive/party).
  lib/                    Lógica pura: reparto de frames (timeline.ts),
                          validación (assertProps.ts), fuentes (loadFonts.ts).
  components/             Ken Burns, blur de fondo, transición, tarjeta de mensaje.
  sections/               Intro, Timeline (recorrido de fotos/mensajes), Credits.
  compositions/           Ensambla las secciones según el estilo elegido.
  renderer/               El puente hacia Supabase. Es la ÚNICA carpeta que
                          sabe tanto de Remotion como de Supabase — todo lo
                          demás en src/ no importa nada de acá.
```

## Variables de entorno

Ver `.env.example`. Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` —
nunca la anon/publishable key (ver justificación en `renderer/supabaseAdmin.ts`).

## Próxima fase (fuera de este proyecto)

Decidir e implementar QUÉ llama a `processVideoJob()`: un worker de cola
propio, una Lambda de AWS con Remotion Lambda, o un cron que hace polling de
`idx_videos_queued`. Ninguna de esas tres decisiones de infraestructura está
tomada todavía — a propósito.

## El worker (`src/worker/`)

Ya implementado, desacoplado de cualquier infraestructura concreta:

- **`claimNextJob.ts`** — reclama exactamente un job, de forma atómica
  (`claim_next_video_job()`, `FOR UPDATE SKIP LOCKED` del lado de Postgres).
- **`pollAndProcessOnce.ts`** — la unidad de trabajo real: libera jobs
  `processing` abandonados (`reap_stale_video_jobs()`), reclama un job,
  y si hay uno, lo procesa. Es la función que cualquier infraestructura
  termina llamando, directa o indirectamente.
- **`runWorker.ts`** — un loop de `N` carriles independientes que llaman
  `pollAndProcessOnce()` en bucle, con apagado prolijo (`stop()`).
- **`cli.ts`** — entrypoint ejecutable (`npm run worker`) que arranca
  `runWorker()` y engancha `SIGTERM`/`SIGINT`.

### Cómo conectar cada infraestructura

| Infraestructura | Qué usar | Notas |
|---|---|---|
| Proceso Node / Docker / ECS / Railway / Render / Fly.io | `npm run worker` (o el `Dockerfile` de esta carpeta) | Todas corren la misma imagen de contenedor; solo cambia cómo le pasan env vars y cuántas réplicas corren — cada réplica es independiente, no necesitan coordinarse entre sí. |
| Edge Function disparadora (cron periódico) | `import { pollAndProcessOnce } from "./worker"` y llamarla una vez por invocación | No usar `runWorker()` acá — una Edge Function no es un proceso de larga duración, no tiene sentido que arranque un loop interno. |
| AWS Lambda (disparada por EventBridge Scheduler, por ejemplo) | mismo `pollAndProcessOnce()`, dentro del handler | El handler llama `pollAndProcessOnce()` una o varias veces según el tiempo de ejecución disponible, y retorna. El bundle de Remotion (`@remotion/bundler`) y el Chrome headless deben empaquetarse en la Lambda o resolverse vía una capa — eso es exactamente lo que la fase de "Remotion Lambda" (todavía no implementada) resolvería reemplazando `renderVideoSummary.ts` por una invocación a Remotion Lambda en vez de un render local. |

Ninguna de las filas de esa tabla está conectada todavía — la tabla describe
la interfaz ya lista (`pollAndProcessOnce`/`runWorker`), no una decisión
tomada.
