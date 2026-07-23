import type { VideoStyleId } from "../types";
import type { StyleConfig } from "./types";
import { cinematic } from "./cinematic";
import { luxury } from "./luxury";
import { emotive } from "./emotive";
import { party } from "./party";

export const STYLES: Record<VideoStyleId, StyleConfig> = {
  cinematic,
  luxury,
  emotive,
  party,
};

export function getStyleConfig(id: VideoStyleId): StyleConfig {
  return STYLES[id];
}

export type { StyleConfig, KenBurnsRange, TransitionKind } from "./types";
