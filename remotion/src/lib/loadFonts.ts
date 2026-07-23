import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

let loaded = false;

/**
 * Carga las 3 fuentes reales de marca (mismas que usa la app principal en
 * src/styles.css: Fraunces/Cormorant Garamond para display, Inter para
 * sans). @remotion/google-fonts descarga y cachea los woff2 en build time,
 * no depende de que la máquina de render tenga conexión a Google Fonts en
 * el momento de renderizar.
 */
export function loadBrandFonts() {
  if (loaded) return;
  loadFraunces();
  loadCormorant();
  loadInter();
  loaded = true;
}
