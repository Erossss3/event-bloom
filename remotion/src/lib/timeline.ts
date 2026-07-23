import type { GalleryPhotoInput, MessageInput, VideoSummaryInputProps } from "../types";
import type { KenBurnsRange, StyleConfig } from "../styles/types";

export type TimelineEntry =
  | { type: "intro"; startFrame: number; durationInFrames: number }
  | {
      type: "photo";
      startFrame: number;
      durationInFrames: number;
      photo: GalleryPhotoInput;
      kenBurns: KenBurnsRange;
    }
  | {
      type: "message";
      startFrame: number;
      durationInFrames: number;
      message: MessageInput;
    }
  | { type: "credits"; startFrame: number; durationInFrames: number };

export interface Timeline {
  entries: TimelineEntry[];
  totalDurationInFrames: number;
}

const toFrames = (secondsValue: number, fps: number) => Math.round(secondsValue * fps);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Selecciona qué fotos/mensajes entran cuando hay más disponibles que los
 * que el video puede mostrar sin quedar "demasiado rápido": prioriza que
 * la selección quede distribuida a lo largo de todo el evento en vez de
 * agarrar solo las primeras N (evita que un resumen de 30s muestre solo
 * el principio de la fiesta). Ya vienen ordenados cronológicamente desde
 * el loader.
 */
function pickEvenlyDistributed<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (items.length <= count) return items;
  const step = items.length / count;
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(items[Math.floor(i * step)]);
  }
  return picked;
}

/**
 * Reparte el tiempo disponible entre intro, fotos, mensajes y créditos.
 *
 * La duración de cada foto/mensaje NO es un valor fijo: arranca del valor
 * "ideal" del estilo (StyleConfig.photoDurationSeconds, el ritmo que le da
 * identidad) y se estira o se comprime para que la suma total coincida
 * con la duración elegida (30/60/90s) — nunca por fuera de
 * [minPhotoDurationSeconds, maxPhotoDurationSeconds], para que nunca se
 * sienta "demasiado rápido" (piso) ni "congelado" (techo).
 *
 * Dos fases:
 *  1) Decide CUÁNTAS fotos/mensajes entran — si ni siquiera al piso de
 *     duración entra todo el contenido real disponible, se muestrea un
 *     subconjunto representativo (pickEvenlyDistributed) en vez de
 *     mostrar todo pero demasiado rápido.
 *  2) Con esa cantidad ya fija, calcula la duración de cada uno
 *     estirando/comprimiendo el valor ideal hacia el tiempo disponible,
 *     y absorbe cualquier resto (por el clamping a min/max) extendiendo
 *     o acortando la última foto — así el total real siempre coincide
 *     con la duración pedida, no queda ni corto ni se pasa.
 */
export function buildTimeline(props: VideoSummaryInputProps, style: StyleConfig, fps: number): Timeline {
  const introFrames = toFrames(style.introDurationSeconds, fps);
  const creditsFrames = toFrames(style.creditsDurationSeconds, fps);
  const totalFrames = toFrames(props.durationSeconds, fps);

  const minPhotoFrames = toFrames(style.minPhotoDurationSeconds, fps);
  const maxPhotoFrames = toFrames(style.maxPhotoDurationSeconds, fps);
  const idealPhotoFrames = toFrames(style.photoDurationSeconds, fps);
  const minMessageFrames = Math.round(minPhotoFrames * 0.8);
  const maxMessageFrames = Math.round(maxPhotoFrames * 0.8);
  const idealMessageFrames = Math.round(idealPhotoFrames * 0.8);

  const contentWindowFrames = Math.max(totalFrames - introFrames - creditsFrames, minPhotoFrames);

  const effectiveMaxMessages = Math.max(0, Math.min(style.maxMessages, props.maxMessages ?? style.maxMessages));
  const featuredMessages = props.messages.filter((m) => m.featured);
  const messagePool = featuredMessages.length > 0 ? featuredMessages : props.messages;

  // --- Fase 1: cuántas fotos/mensajes entran, incluso al piso de duración ---
  const messageRatio = style.messageEveryNPhotos > 0 ? 1 / style.messageEveryNPhotos : 0;
  const minUnitFrames = minPhotoFrames + messageRatio * minMessageFrames;
  const maxUnitsAtFloor = Math.max(1, Math.floor(contentWindowFrames / minUnitFrames));

  const desiredPhotoCount = props.photos.length;
  const desiredMessageCount =
    style.messageEveryNPhotos > 0
      ? Math.min(effectiveMaxMessages, messagePool.length, Math.floor(desiredPhotoCount / style.messageEveryNPhotos))
      : 0;
  const desiredUnitCount = desiredPhotoCount + desiredMessageCount * messageRatio;

  let finalPhotoCount = desiredPhotoCount;
  let finalMessageCount = desiredMessageCount;
  if (desiredUnitCount > maxUnitsAtFloor) {
    const ratio = maxUnitsAtFloor / desiredUnitCount;
    finalPhotoCount = Math.max(1, Math.round(desiredPhotoCount * ratio));
    finalMessageCount = Math.max(0, Math.round(desiredMessageCount * ratio));
  }

  const selectedPhotos = pickEvenlyDistributed(props.photos, finalPhotoCount);
  const selectedMessages = pickEvenlyDistributed(messagePool, finalMessageCount);

  // --- Fase 2: duración de cada uno, estirando/comprimiendo hacia el ideal ---
  const idealTotalFrames =
    selectedPhotos.length * idealPhotoFrames + selectedMessages.length * idealMessageFrames;
  const scale = idealTotalFrames > 0 ? contentWindowFrames / idealTotalFrames : 1;

  const photoDurationFrames = clamp(Math.round(idealPhotoFrames * scale), minPhotoFrames, maxPhotoFrames);
  const messageDurationFrames = clamp(Math.round(idealMessageFrames * scale), minMessageFrames, maxMessageFrames);

  // --- Armar las entradas, intercalando mensajes cada messageEveryNPhotos ---
  const entries: TimelineEntry[] = [{ type: "intro", startFrame: 0, durationInFrames: introFrames }];
  let cursor = introFrames;
  let messageIndex = 0;
  let lastContentEntry: TimelineEntry | undefined;

  selectedPhotos.forEach((photo, i) => {
    const kenBurns = style.kenBurns[i % style.kenBurns.length];
    const photoEntry: TimelineEntry = { type: "photo", startFrame: cursor, durationInFrames: photoDurationFrames, photo, kenBurns };
    entries.push(photoEntry);
    lastContentEntry = photoEntry;
    cursor += photoDurationFrames;

    const isMessageTurn = style.messageEveryNPhotos > 0 && (i + 1) % style.messageEveryNPhotos === 0;
    if (isMessageTurn && messageIndex < selectedMessages.length) {
      const messageEntry: TimelineEntry = {
        type: "message",
        startFrame: cursor,
        durationInFrames: messageDurationFrames,
        message: selectedMessages[messageIndex],
      };
      entries.push(messageEntry);
      lastContentEntry = messageEntry;
      cursor += messageDurationFrames;
      messageIndex++;
    }
  });

  // Absorbe el resto (positivo o negativo) del redondeo/clamping de la fase
  // 2 en la última entrada de contenido real, así el timeline llena
  // contentWindowFrames lo más exacto posible — nunca termina antes de
  // tiempo (video más corto que lo pedido). Pero SIN pasarse del techo del
  // estilo: con muy pocas fotos (ej. 1 sola foto para un video de 90s),
  // estirar sin límite dejaría esa foto congelada varios minutos,
  // exactamente lo que "nunca demasiado tiempo" prohíbe. Lo que no entra
  // dentro del techo se derrama a los créditos (una pantalla final más
  // larga es un cierre natural; una foto congelada no lo es).
  const remainder = introFrames + contentWindowFrames - cursor;
  let creditsExtraFrames = 0;
  if (lastContentEntry && remainder !== 0) {
    const isMessage = lastContentEntry.type === "message";
    const minBound = isMessage ? minMessageFrames : minPhotoFrames;
    const maxBound = isMessage ? maxMessageFrames : maxPhotoFrames;

    const uncappedDuration = lastContentEntry.durationInFrames + remainder;
    const cappedDuration = clamp(uncappedDuration, minBound, maxBound);
    creditsExtraFrames = uncappedDuration - cappedDuration; // >0 si el remainder positivo no entraba en el techo

    lastContentEntry.durationInFrames = cappedDuration;
    cursor = lastContentEntry.startFrame + lastContentEntry.durationInFrames;
  }

  entries.push({ type: "credits", startFrame: cursor, durationInFrames: creditsFrames + Math.max(0, creditsExtraFrames) });
  cursor += creditsFrames + Math.max(0, creditsExtraFrames);

  return { entries, totalDurationInFrames: cursor };
}
