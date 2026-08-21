#!/usr/bin/env node
/**
 * regen-detector-map.mjs — CI regeneration of the /ai-detector visual state map.
 *
 * Pipeline:
 *   1. prod build (skip with REGEN_SKIP_BUILD=1 on repeats)
 *   2. `next start` on a free port
 *   3. chromium (playwright) opens /dev/detector-map#s-* one state at a time
 *      (the deep link expands the leaf itself) and screenshots the state preview
 *      area at deviceScaleFactor=2 → docs/ux-maps/schemes/state_s-*.png
 *   4. the same chromium renders scripts/dev/scheme-template.html filled with the
 *      fresh screenshots (base64) → docs/ux-maps/schemes/scheme.png (2328px wide)
 *
 * Drift guard: the set of state anchors found on the page must match the
 * canonical 24-state grid below exactly, otherwise the script fails — update
 * EXPECTED_STATES (and the template captions) together with the state tree in
 * src/components/dev/detector-map.tsx.
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "docs", "ux-maps", "schemes");
const TEMPLATE_PATH = path.join(ROOT, "scripts", "dev", "scheme-template.html");
const MAP_PATH = "/dev/detector-map";
const SCHEME_WIDTH = 2328;
const SHOT_TIMEOUT_MS = 30_000;

/** Canonical 24-terminal-state grid, in 4×6 render order (see docs/ux-maps/detector.md §1.1). */
const EXPECTED_STATES = [
  "S-EMPTY-FIRST",
  "S-EMPTY-RETURN",
  "S-GATE-SHORT-TEXT",
  "S-GATE-LONG-TEXT",
  "S-GATE-SHORT-CODE",
  "S-GATE-LONG-CODE",
  "S-IMG-TOO-BIG",
  "S-IMG-BAD-FORMAT",
  "S-IMG-C2PA-LOADING",
  "S-IMG-C2PA-AI",
  "S-IMG-C2PA-NOAI",
  "S-IMG-C2PA-INVALID",
  "S-IMG-NO-SIGNALS",
  "S-RES-CONF-AI",
  "S-RES-LIKELY-AI",
  "S-RES-ABSTAIN",
  "S-RES-LIKELY-HUMAN",
  "S-RES-CONF-HUMAN",
  "S-RES-BORDERLINE-EXT",
  "S-NO-ML",
  "S-EXT-ONLY",
  "S-RATE-LIMIT",
  "S-NETWORK-ERR",
  "S-RES-STALE-GUARD",
];

const kebab = (id) => id.toLowerCase();
const log = (msg) => console.log(`[regen] ${msg}`);
const fail = (msg) => {
  console.error(`[regen] ERROR: ${msg}`);
  process.exit(1);
};

function runBuild() {
  log("prod build (REGEN_SKIP_BUILD=1 to skip)…");
  const res = spawnSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
  if (res.status !== 0) fail(`next build exited with ${res.status}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on("error", retry);
    };
    const retry = () => {
      if (Date.now() > deadline) reject(new Error(`timed out waiting for ${url}`));
      else setTimeout(attempt, 750);
    };
    attempt();
  });
}

async function main() {
  if (process.env.REGEN_SKIP_BUILD === "1") log("REGEN_SKIP_BUILD=1 — reusing existing .next build");
  else runBuild();

  const port = process.env.REGEN_PORT ? Number(process.env.REGEN_PORT) : await freePort();
  const base = `http://127.0.0.1:${port}`;
  log(`starting next start on ${base}…`);
  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    // detached: next start spawns a next-server grandchild; kill the whole
    // process group so the script (and CI job) actually exits.
    detached: true,
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, NODE_ENV: "production" },
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  const stopServer = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already dead */
    }
  };
  process.on("exit", stopServer);

  try {
    await waitForHttp(`${base}${MAP_PATH}`);
    log("server is up");

    const browser = await chromium.launch({
      // Deterministic line wraps across machines — see task spec.
      args: ["--font-render-hinting=none"],
    });
    try {
      // --- pass 1: state previews at dsf=2 ------------------------------------
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await page.goto(`${base}${MAP_PATH}`, { waitUntil: "networkidle" });
      await page.waitForSelector('details[id^="s-"]');
      await page.evaluate(() => document.fonts.ready);

      const found = await page.$$eval('details[id^="s-"]', (els) => els.map((el) => el.id));
      const expectedAnchors = EXPECTED_STATES.map(kebab);
      const missing = expectedAnchors.filter((a) => !found.includes(a));
      const extra = found.filter((a) => !expectedAnchors.includes(a));
      if (missing.length > 0 || extra.length > 0) {
        fail(
          `state drift detected on ${MAP_PATH}: page has ${found.length} states, ` +
            `canonical grid has ${expectedAnchors.length}. ` +
            `missing on page: [${missing.join(", ") || "none"}]; ` +
            `unexpected on page: [${extra.join(", ") || "none"}]. ` +
            `Update EXPECTED_STATES in scripts/dev/regen-detector-map.mjs and ` +
            `scripts/dev/scheme-template.html together with the state tree.`,
        );
      }
      log(`drift guard ok: ${found.length}/24 states on the page`);

      const shots = new Map(); // state id -> absolute png path
      for (const id of EXPECTED_STATES) {
        const anchor = kebab(id);
        await page.evaluate((a) => {
          window.location.hash = a;
        }, anchor);
        const frame = page.locator(`#${anchor} [class*="max-w-[420px]"]`).first();
        await frame.waitFor({ state: "visible", timeout: SHOT_TIMEOUT_MS });
        await page.waitForFunction(
          (a) => {
            const d = document.getElementById(a);
            const f = d && d.querySelector('[class*="max-w-[420px]"]');
            return Boolean(d && d.open && f && f.offsetHeight > 0);
          },
          anchor,
          { timeout: SHOT_TIMEOUT_MS },
        );
        await page.evaluate(() => document.fonts.ready);
        // Let ResizeObserver-driven height and fixture timers settle.
        await page.waitForTimeout(200);
        const out = path.join(OUT_DIR, `state_${anchor}.png`);
        await frame.screenshot({ path: out, timeout: SHOT_TIMEOUT_MS });
        shots.set(id, out);
        log(`shot ${id} → ${path.relative(ROOT, out)}`);
      }
      await ctx.close();

      // --- pass 2: composite scheme at 2328px ---------------------------------
      const images = {};
      for (const [id, file] of shots) {
        images[id] = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
      }
      const template = readFileSync(TEMPLATE_PATH, "utf8");
      const markers = template.split("/*__STATE_IMAGES__*/").length - 1;
      if (markers !== 1) {
        fail(
          `template ${TEMPLATE_PATH} must contain exactly one /*__STATE_IMAGES__*/ ` +
            `placeholder, found ${markers}`,
        );
      }
      const html = template.replace(
        "/*__STATE_IMAGES__*/",
        `window.__STATE_IMAGES__ = ${JSON.stringify(images)};`,
      );

      const ctx2 = await browser.newContext({
        viewport: { width: SCHEME_WIDTH, height: 1200 },
        deviceScaleFactor: 1,
      });
      const page2 = await ctx2.newPage();
      await page2.setContent(html, { waitUntil: "load", timeout: 120_000 });
      await page2.waitForFunction(() => window.__schemeReady === true, null, {
        timeout: 120_000,
      });
      const schemeOut = path.join(OUT_DIR, "scheme.png");
      await page2.screenshot({ path: schemeOut, fullPage: true, timeout: 120_000 });
      log(`scheme → ${path.relative(ROOT, schemeOut)} (${SCHEME_WIDTH}px wide)`);
      await ctx2.close();
    } finally {
      await browser.close();
    }
  } finally {
    stopServer();
  }

  log(`done: 24 state PNGs + scheme.png in ${path.relative(ROOT, OUT_DIR)}`);
  // Explicit exit: the detached server pipe must not keep the event loop alive.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
