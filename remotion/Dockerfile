# Imagen del worker de Video Summary. El MISMO artefacto (esta imagen) es lo
# que se despliega en Docker directo, ECS, Railway, Render o Fly.io — las 5
# plataformas listadas corren contenedores Docker; ninguna necesita una
# imagen distinta. Lo único que cambia entre ellas es CÓMO se le pasan las
# variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# VIDEO_WORKER_*) y cuántas réplicas corren — eso es configuración de la
# plataforma, no de esta imagen.
#
# NOTA: Remotion necesita Chrome headless con sus dependencias de sistema.
# La lista de paquetes apt de abajo es la combinación documentada
# habitualmente por Remotion para Debian/Ubuntu — verificar contra la
# documentación oficial de la versión de @remotion/renderer que quede
# resuelta (no pude instalar ni construir esta imagen en este entorno para
# confirmarlo).
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
# --omit=dev es correcto acá: tsx (lo que efectivamente ejecuta el worker en
# runtime, ver CMD) ya está en "dependencies", no en "devDependencies" —
# typescript/@types/* (los únicos paquetes en devDependencies) solo hacen
# falta para "npm run typecheck", nunca en runtime.
#
# "npm ci" exige un package-lock.json ya generado y falla inmediatamente si
# no existe — esta carpeta no tiene ninguno todavía (a diferencia de la app
# principal, que sí lo tiene committeado). Se usa "npm install" hasta que se
# genere y se commitee un package-lock.json real (ejecutando "npm install"
# una vez con acceso a red) — en ese momento conviene volver a "npm ci" para
# builds reproducibles.
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

# SIGTERM (el que mandan ECS/Fly/Railway/Render antes de reciclar el
# container) llega directo al proceso de Node gracias a exec-form CMD, sin
# un shell intermedio absorbiéndolo — necesario para que worker/cli.ts
# pueda hacer el apagado prolijo (esperar los jobs en curso).
CMD ["node", "--import", "tsx/esm", "src/worker/cli.ts"]
