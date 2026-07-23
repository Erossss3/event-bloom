import { Config } from "@remotion/cli/config";

// Formato de frames intermedios durante el render — jpeg es más rápido que png
// y no hace falta transparencia en ningún punto de la composición.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// El worker (todavía no conectado) decide su propia concurrencia según el
// recurso de cómputo real que se le asigne; acá se deja en 1 para que el
// comportamiento por default de `remotion studio` en desarrollo sea predecible.
Config.setConcurrency(1);

Config.setCodec("h264");
