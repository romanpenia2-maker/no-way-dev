/**
 * L0 provenance — server-side image metadata heuristics.
 *
 * Pure-TS byte parsing (no dependencies): PNG chunk walk and JPEG marker walk.
 * Looks for:
 *  - C2PA manifest presence (PNG `caBX` chunk, JPEG APP11 JUMBF `c2pa` box)
 *  - AI generator fingerprints (A1111 `parameters`, ComfyUI `workflow`/`prompt`,
 *    known software strings in text metadata)
 *  - Camera EXIF (Make/Model tags) — a weak "shot by a camera" signal
 *
 * Absence of metadata means NOTHING (it is trivially stripped); only positive
 * findings are used, and only as documented heuristics.
 */

export interface ProvenanceSignal {
  name: string;
  direction: "ai" | "human";
  weight: "strong" | "weak";
  detail: string;
}

export interface ProvenanceResult {
  state: "ok";
  format: "png" | "jpeg" | "gif" | "webp" | "unknown";
  c2paManifestPresent: boolean;
  generatorHints: string[];
  cameraExifPresent: boolean;
  signals: ProvenanceSignal[];
}

const AI_STRING_HINTS: { needle: string; label: string }[] = [
  { needle: "stable diffusion", label: "Stable Diffusion metadata string" },
  { needle: "comfyui", label: "ComfyUI metadata string" },
  { needle: "automatic1111", label: "Automatic1111 metadata string" },
  { needle: "midjourney", label: "Midjourney metadata string" },
  { needle: "dall-e", label: "DALL-E metadata string" },
  { needle: "dalle", label: "DALL-E metadata string" },
  { needle: "firefly", label: "Adobe Firefly metadata string" },
  { needle: "novelai", label: "NovelAI metadata string" },
  { needle: "invokeai", label: "InvokeAI metadata string" },
  { needle: "dreamstudio", label: "DreamStudio metadata string" },
];

const CAMERA_MAKE_RE = /canon|nikon|sony|fujifilm|olympus|panasonic|leica|pentax|apple|samsung|google|huawei|xiaomi|oneplus|hasselblad|kodak|gopro|dji/i;

function ascii(buf: Buffer, start: number, end: number): string {
  return buf.toString("latin1", start, Math.min(end, buf.length));
}

function findAiStringHints(haystack: string, into: string[]): void {
  const lower = haystack.toLowerCase();
  for (const hint of AI_STRING_HINTS) {
    if (lower.includes(hint.needle) && !into.includes(hint.label)) into.push(hint.label);
  }
}

// --- PNG ---------------------------------------------------------------------

function parsePng(buf: Buffer, result: ProvenanceResult): void {
  // signature(8) then chunks: length(4) type(4) data(length) crc(4)
  let offset = 8;
  const textChunks: string[] = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = ascii(buf, offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + Math.min(length, buf.length - dataStart);
    if (dataEnd <= dataStart) break;

    if (type === "caBX") {
      result.c2paManifestPresent = true;
      result.signals.push({
        name: "c2pa_chunk",
        direction: "ai",
        weight: "strong",
        detail: "PNG contains a C2PA manifest chunk (caBX) — signed provenance is present.",
      });
    }
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const keyword = ascii(buf, dataStart, Math.min(dataStart + 80, dataEnd)).split("\0")[0] ?? "";
      const body = type === "zTXt" ? "" : ascii(buf, dataStart, Math.min(dataEnd, dataStart + 4096));
      textChunks.push(keyword);
      findAiStringHints(`${keyword} ${body}`, result.generatorHints);

      const key = keyword.toLowerCase();
      if (key === "parameters") {
        result.signals.push({
          name: "png_parameters_chunk",
          direction: "ai",
          weight: "strong",
          detail: "PNG text chunk 'parameters' — written by Automatic1111 / Stable Diffusion WebUI.",
        });
      }
      if (key === "workflow" || key === "prompt") {
        result.signals.push({
          name: "png_comfyui_chunk",
          direction: "ai",
          weight: "strong",
          detail: `PNG text chunk '${keyword}' — written by ComfyUI.`,
        });
      }
    }
    if (type === "IEND") break;
    if (dataStart + length + 4 > buf.length) break; // corrupt length guard
    offset = dataStart + length + 4; // skip data + CRC
  }
  for (const hint of result.generatorHints) {
    result.signals.push({ name: "png_text_hint", direction: "ai", weight: "strong", detail: hint });
  }
}

// --- JPEG --------------------------------------------------------------------

/** Parse TIFF IFD0 of an EXIF segment for Make/Model/Software tags. */
function parseExif(buf: Buffer, start: number, end: number, result: ProvenanceResult): void {
  // start points at "Exif\0\0"
  const tiff = start + 6;
  if (tiff + 8 > end) return;
  const littleEndian = ascii(buf, tiff, tiff + 2) === "II";
  const u16 = (o: number) => (littleEndian ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (littleEndian ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  try {
    const ifd0 = tiff + u32(tiff + 4);
    if (ifd0 + 2 > end) return;
    const entries = u16(ifd0);
    for (let i = 0; i < entries; i += 1) {
      const entry = ifd0 + 2 + i * 12;
      if (entry + 12 > end) break;
      const tag = u16(entry);
      const count = u32(entry + 4);
      // ASCII values fit in the 4-byte field when count <= 4, else offset from tiff start
      const valueOffset = count <= 4 ? entry + 8 : tiff + u32(entry + 8);
      if (valueOffset >= end) continue;
      const value = ascii(buf, valueOffset, Math.min(valueOffset + count, end)).replace(/\0+$/, "");
      if (tag === 0x010f || tag === 0x0110) {
        if (CAMERA_MAKE_RE.test(value)) {
          result.cameraExifPresent = true;
          result.signals.push({
            name: "exif_camera",
            direction: "human",
            weight: "weak",
            detail: `EXIF ${tag === 0x010f ? "Make" : "Model"}: "${value}" — consistent with a real camera/phone.`,
          });
        }
      }
      if (tag === 0x0131 && value.length > 0) {
        findAiStringHints(value, result.generatorHints);
      }
    }
  } catch {
    // Malformed EXIF — ignore; provenance heuristics must never crash the request.
  }
}

function parseJpeg(buf: Buffer, result: ProvenanceResult): void {
  let offset = 2; // skip SOI
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI — metadata is over
    const length = buf.readUInt16BE(offset + 2);
    const segStart = offset + 4;
    const segEnd = Math.min(segStart + length - 2, buf.length);

    if (marker === 0xe1) {
      // APP1: EXIF or XMP
      if (ascii(buf, segStart, segStart + 6) === "Exif\0\0") {
        parseExif(buf, segStart, segEnd, result);
      } else {
        findAiStringHints(ascii(buf, segStart, Math.min(segEnd, segStart + 8192)), result.generatorHints);
      }
    }
    if (marker === 0xeb) {
      // APP11: JUMBF (C2PA) lives here
      const seg = ascii(buf, segStart, Math.min(segEnd, segStart + 4096));
      if (seg.includes("c2pa") || seg.includes("jumbf")) {
        result.c2paManifestPresent = true;
        result.signals.push({
          name: "jpeg_c2pa_app11",
          direction: "ai",
          weight: "strong",
          detail: "JPEG APP11 segment contains a C2PA/JUMBF manifest — signed provenance is present.",
        });
      }
    }
    if (marker === 0xfe) {
      // COM segment
      findAiStringHints(ascii(buf, segStart, Math.min(segEnd, segStart + 2048)), result.generatorHints);
    }
    offset = segStart + length - 2;
  }
  for (const hint of result.generatorHints) {
    result.signals.push({ name: "jpeg_metadata_hint", direction: "ai", weight: "strong", detail: hint });
  }
}

// --- entry point --------------------------------------------------------------

export function analyzeImageProvenance(buf: Buffer): ProvenanceResult {
  const result: ProvenanceResult = {
    state: "ok",
    format: "unknown",
    c2paManifestPresent: false,
    generatorHints: [],
    cameraExifPresent: false,
    signals: [],
  };
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) {
    result.format = "png";
    parsePng(buf, result);
  } else if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    result.format = "jpeg";
    parseJpeg(buf, result);
  } else if (buf.length >= 6 && ascii(buf, 0, 3) === "GIF") {
    result.format = "gif";
  } else if (buf.length >= 12 && ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") {
    result.format = "webp";
    // WebP XMP/EXIF chunks: cheap string scan for hints
    findAiStringHints(ascii(buf, 0, Math.min(buf.length, 65536)), result.generatorHints);
  }
  if (result.format === "unknown") {
    result.signals.push({
      name: "unknown_format",
      direction: "human",
      weight: "weak",
      detail: "Unrecognized image format — metadata heuristics not applicable.",
    });
  }
  return result;
}
