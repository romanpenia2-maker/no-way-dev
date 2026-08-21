import { NextResponse } from "next/server";
import { gripEntriesSchema, gripSubmitSchema, type GripEntry } from "@data/schemas/grip.schema";
import { GRIP_BRANCH, GRIP_ENTRIES_PATH } from "@/lib/grip";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/grip/submit — append a leaderboard entry (and its optional photo)
 * to the repo via the GitHub Data API, so the dataset stays data-in-git with
 * full history. Writes land on the rc branch; the /grip page picks them up
 * within its 60s revalidation window.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 20 submissions/hour/IP, per warm instance (same pattern as /api/detect).
const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, maxRequests: 20 });

const REPO = "romanpenia2-maker/no-way-dev";
const API = `https://api.github.com/repos/${REPO}`;

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

/** Strip markup/control chars, collapse whitespace — the name renders as text. */
function sanitizeName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&"'`]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function newEntryId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `g${stamp}${rand}`.slice(0, 24);
}

async function github(
  token: string,
  method: "GET" | "PUT",
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "no-way-dev-grip",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

/** Append the entry to data/grip/entries.json on rc; one retry on a sha race (409). */
async function appendEntry(token: string, entry: GripEntry): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const get = await github(token, "GET", `/contents/${GRIP_ENTRIES_PATH}?ref=${GRIP_BRANCH}`);
    // 404 = the file does not exist yet — this submission creates it.
    if (get.status !== 200 && get.status !== 404) return false;
    const sha = get.status === 200 ? (get.data.sha as string) : undefined;
    let entries: GripEntry[] = [];
    if (get.status === 200) {
      const current = Buffer.from(String(get.data.content ?? ""), "base64").toString("utf8");
      try {
        entries = gripEntriesSchema.parse(JSON.parse(current));
      } catch {
        return false; // dataset is broken — fail loudly rather than clobber it
      }
    }
    entries.push(entry);
    const put = await github(token, "PUT", `/contents/${GRIP_ENTRIES_PATH}`, {
      message: `chore(data): add grip entry ${entry.id} (${entry.name}, ${entry.kg} kg)`,
      content: Buffer.from(JSON.stringify(entries, null, 2) + "\n", "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
      branch: GRIP_BRANCH,
    });
    if (put.status === 200 || put.status === 201) return true;
    if (put.status !== 409) return false;
    // 409 = sha race with a concurrent write — refetch and retry once.
  }
  return false;
}

async function uploadPhoto(token: string, id: string, dataUrl: string): Promise<string | null> {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const path = `data/grip/photos/${id}.jpg`;
  const put = await github(token, "PUT", `/contents/${path}`, {
    message: `chore(data): add grip photo ${id}`,
    content: base64,
    branch: GRIP_BRANCH,
  });
  return put.status === 200 || put.status === 201 ? path : null;
}

export async function POST(request: Request) {
  const rl = limiter.check(clientIp(request));
  if (!rl.allowed) {
    return json(
      { error: "rate_limited", message: "Too many submissions. Try again later." },
      429,
      { "retry-after": String(rl.retryAfterSeconds) },
    );
  }

  // GitHub forbids secret names starting with GITHUB_, hence DATA_REPO_TOKEN.
  const token = process.env.DATA_REPO_TOKEN;
  if (!token) {
    return json(
      { error: "unavailable", message: "Saving results is not configured yet — come back soon." },
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request", message: "Request body must be JSON." }, 400);
  }
  const parsed = gripSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      400,
    );
  }

  const name = sanitizeName(parsed.data.name);
  if (name.length < 2) {
    return json({ error: "bad_request", message: "Name must be at least 2 visible characters." }, 400);
  }

  const entry: GripEntry = {
    id: newEntryId(),
    name,
    kg: Math.round(parsed.data.kg * 10) / 10,
    createdAt: new Date().toISOString(),
    source: parsed.data.photoBase64 ? "photo-ai" : "manual",
  };

  // Photo first: an orphaned photo is harmless, a dangling photoPath is not.
  if (parsed.data.photoBase64) {
    const photoPath = await uploadPhoto(token, entry.id, parsed.data.photoBase64);
    if (!photoPath) {
      return json({ error: "upstream", message: "Could not save the photo. Try again." }, 502);
    }
    entry.photoPath = photoPath;
  }

  const ok = await appendEntry(token, entry);
  if (!ok) {
    return json({ error: "upstream", message: "Could not save the result. Try again." }, 502);
  }

  return json({ ok: true, entry }, 201);
}
