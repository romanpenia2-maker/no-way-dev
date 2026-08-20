import fs from "node:fs";
import path from "node:path";
import {
  attributionConfigSchema,
  detectorCopySchema,
  detectorThresholdsSchema,
  type AttributionConfig,
  type DetectorCopy,
  type DetectorThresholds,
} from "@data/schemas/detector.schema";

const detectorDir = path.join(process.cwd(), "data", "detector");

let thresholdsCache: DetectorThresholds | null = null;
let attributionCache: AttributionConfig | null = null;
let copyCache: DetectorCopy | null = null;

export function getDetectorThresholds(): DetectorThresholds {
  if (!thresholdsCache) {
    thresholdsCache = detectorThresholdsSchema.parse(
      JSON.parse(fs.readFileSync(path.join(detectorDir, "thresholds.json"), "utf8")),
    );
  }
  return thresholdsCache;
}

export function getAttributionConfig(): AttributionConfig {
  if (!attributionCache) {
    attributionCache = attributionConfigSchema.parse(
      JSON.parse(fs.readFileSync(path.join(detectorDir, "attribution.json"), "utf8")),
    );
  }
  return attributionCache;
}

export function getDetectorCopy(): DetectorCopy {
  if (!copyCache) {
    copyCache = detectorCopySchema.parse(
      JSON.parse(fs.readFileSync(path.join(detectorDir, "copy.json"), "utf8")),
    );
  }
  return copyCache;
}
