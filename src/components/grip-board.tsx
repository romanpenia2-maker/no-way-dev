"use client";

import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GRIP_KG_MAX,
  GRIP_KG_MIN,
  GRIP_NAME_MAX,
  GRIP_NAME_MIN,
  type GripEntry,
} from "@data/schemas/grip.schema";
import { formatGripDate, formatKg, gripPhotoUrl } from "@/lib/grip";
import { cn } from "@/lib/utils";

/** Max photo edge (px) and size budget before upload — enforced client-side. */
const PHOTO_MAX_EDGE = 1280;
const PHOTO_MAX_BYTES = 400 * 1024;

type AnalyzeState = "idle" | "loading" | "read" | "no-meter" | "unavailable" | "error";

/** Resize to ≤1280px JPEG and step quality down until the file fits 400KB. */
async function preparePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  for (let q = 0.7; q >= 0.4; q -= 0.1) {
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (Math.ceil((b64.length * 3) / 4) <= PHOTO_MAX_BYTES) return dataUrl;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

function byKgDesc(a: GripEntry, b: GripEntry): number {
  return b.kg - a.kg || a.createdAt.localeCompare(b.createdAt);
}

function Leaderboard({ entries }: { entries: GripEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="border border-line p-8 text-center">
        <p className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
          No results yet
        </p>
        <p className="mt-3 text-sm text-ink2">The first one will be you — grab a dynamometer and add your squeeze below.</p>
      </div>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead className="w-20">Photo</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Grip</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e, i) => (
            <TableRow key={e.id} className="row-fade">
              <TableCell>
                {i < 3 ? (
                  <span className="inline-flex h-7 w-7 items-center justify-center bg-ink font-mono text-sm font-bold text-paper nums">
                    {i + 1}
                  </span>
                ) : (
                  <span className="font-mono text-sm text-ink2 nums">{i + 1}</span>
                )}
              </TableCell>
              <TableCell>
                {e.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote raw.githubusercontent URL, plain img is fine
                  <img
                    src={gripPhotoUrl(e.photoPath)}
                    alt={`Dynamometer photo by ${e.name}`}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-14 w-14 border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center border border-dashed border-line font-mono text-[10px] text-ink2">
                    no photo
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className={cn("font-semibold", i < 3 && "font-bold")}>{e.name}</span>
                {e.source === "photo-ai" ? (
                  <Badge variant="secondary" className="ml-2 align-middle" title="Kilograms were read off the photo by AI">
                    AI-read
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <span className={cn("font-mono font-bold nums", i < 3 ? "text-xl" : "text-base")}>
                  {formatKg(e.kg)}
                </span>
              </TableCell>
              <TableCell className="hidden text-right font-mono text-xs text-ink2 nums sm:table-cell">
                {formatGripDate(e.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function GripBoard({ initialEntries }: { initialEntries: GripEntry[] }) {
  const [entries, setEntries] = useState<GripEntry[]>(() => [...initialEntries].sort(byKgDesc));

  const [name, setName] = useState("");
  const [kg, setKg] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [aiRead, setAiRead] = useState(false);
  const [analyze, setAnalyze] = useState<AnalyzeState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const analyzePhoto = useCallback(async (dataUrl: string) => {
    setAnalyze("loading");
    try {
      const res = await fetch("/api/grip/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = (await res.json()) as {
        state?: string;
        kg?: number | null;
        hasDynamometer?: boolean;
      };
      if (data.state === "unavailable") {
        setAnalyze("unavailable");
      } else if (!res.ok || data.state === "error") {
        setAnalyze("error");
      } else if (data.hasDynamometer && typeof data.kg === "number") {
        setKg(String(data.kg));
        setAiRead(true);
        setAnalyze("read");
      } else {
        setAnalyze("no-meter");
      }
    } catch {
      setAnalyze("error");
    }
  }, []);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setNotice({ kind: "err", text: "That file is not an image." });
        return;
      }
      setNotice(null);
      setAiRead(false);
      try {
        const dataUrl = await preparePhoto(file);
        setPhoto(dataUrl);
        void analyzePhoto(dataUrl);
      } catch {
        setNotice({ kind: "err", text: "Could not read that image — try another one." });
      }
    },
    [analyzePhoto],
  );

  const clearPhoto = useCallback(() => {
    setPhoto(null);
    setAiRead(false);
    setAnalyze("idle");
    if (fileInput.current) fileInput.current.value = "";
  }, []);

  const submit = useCallback(async () => {
    const trimmedName = name.trim();
    const kgNum = Number(kg);
    if (trimmedName.length < GRIP_NAME_MIN || trimmedName.length > GRIP_NAME_MAX) {
      setNotice({ kind: "err", text: `Name must be ${GRIP_NAME_MIN}–${GRIP_NAME_MAX} characters.` });
      return;
    }
    if (!Number.isFinite(kgNum) || kgNum < GRIP_KG_MIN || kgNum > GRIP_KG_MAX) {
      setNotice({ kind: "err", text: `Grip must be a number between ${GRIP_KG_MIN} and ${GRIP_KG_MAX} kg.` });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/grip/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          kg: kgNum,
          photoBase64: photo ?? undefined,
        }),
      });
      const data = (await res.json()) as { entry?: GripEntry; message?: string };
      if (!res.ok || !data.entry) {
        setNotice({
          kind: "err",
          text:
            res.status === 429
              ? "Too many submissions — try again in an hour."
              : (data.message ?? "Could not save the result. Try again."),
        });
        return;
      }
      // Optimistic update: the row shows now; everyone else sees it within a minute.
      setEntries((prev) => [...prev, data.entry as GripEntry].sort(byKgDesc));
      setNotice({ kind: "ok", text: "Saved! Your result appears in the table for everyone within a minute." });
      setName("");
      setKg("");
      clearPhoto();
    } catch {
      setNotice({ kind: "err", text: "Network error — result not saved. Try again." });
    } finally {
      setSubmitting(false);
    }
  }, [name, kg, photo, clearPhoto]);

  return (
    <div className="space-y-10">
      <Leaderboard entries={entries} />

      {/* Add result */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase leading-[0.94] tracking-[-0.02em]">
            Add your result
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">
            {GRIP_KG_MIN}–{GRIP_KG_MAX} kg
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Name</span>
            <Input
              value={name}
              maxLength={GRIP_NAME_MAX}
              placeholder="e.g. Ada L."
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Grip, kg</span>
            <span className="flex items-center gap-2">
              <Input
                type="number"
                min={GRIP_KG_MIN}
                max={GRIP_KG_MAX}
                step={0.5}
                value={kg}
                placeholder="42.5"
                onChange={(e) => {
                  setKg(e.target.value);
                  setAiRead(false);
                }}
              />
              {aiRead ? (
                <Badge variant="solid" title="Read off the photo by AI — edit if it got it wrong">
                  read from photo (AI)
                </Badge>
              ) : null}
            </span>
          </label>
        </div>

        {/* Photo: dropzone / picker with preview */}
        <div className="mt-4">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">
            Photo with the dynamometer (optional)
          </span>
          {photo ? (
            <div className="flex items-start gap-4 border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img src={photo} alt="Your dynamometer photo" className="h-20 w-20 border border-line object-cover" />
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                {analyze === "loading" ? (
                  <p className="text-ink2">Reading the display…</p>
                ) : analyze === "read" ? (
                  <p>
                    Read <span className="font-bold">the number</span> off the display and filled the kg field —
                    correct it if needed.
                  </p>
                ) : analyze === "no-meter" ? (
                  <p className="text-ink2">No dynamometer display detected — fill the kg field by hand.</p>
                ) : analyze === "unavailable" ? (
                  <p className="text-ink2">AI photo reading is not available right now — fill the kg field by hand.</p>
                ) : analyze === "error" ? (
                  <p className="text-ink2">Could not analyze the photo — fill the kg field by hand.</p>
                ) : null}
                <Button variant="outline" size="sm" onClick={clearPhoto}>
                  Remove photo
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void onFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex min-h-24 w-full items-center justify-center border border-dashed px-4 text-center font-mono text-xs uppercase tracking-[0.08em]",
                dragOver ? "border-ink bg-ink text-paper" : "border-line text-ink2 hover:border-ink hover:text-ink",
              )}
            >
              Drop a photo here or click to pick one — if the display is visible, we read the kg for you
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] leading-5 text-ink2">
            Photo is resized in your browser (≤1280px) before upload. Name and result are public.
          </p>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Saving…" : "Save my result"}
          </Button>
        </div>

        {notice ? (
          <p
            role={notice.kind === "err" ? "alert" : "status"}
            className={cn(
              "mt-3 border p-3 text-sm",
              notice.kind === "ok" ? "border-ink font-semibold" : "border-line text-ink2",
            )}
          >
            {notice.text}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
