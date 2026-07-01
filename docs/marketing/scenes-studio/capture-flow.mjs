#!/usr/bin/env node
/**
 * Record dossier → chat flow as GIF (iPhone shell).
 *
 *   cd web && npm run dev:mock
 *   node docs/marketing/scenes-studio/capture-flow.mjs
 *
 * Output: docs/screenshots/dossier-chat-flow.gif (+ .mp4)
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDIO = __dirname;
const REPO = resolve(STUDIO, "../../..");
const WEB = join(REPO, "web");
const OUT = join(REPO, "docs/screenshots");
const STAGE = join(STUDIO, "stage.html");
const RENDER = join(STUDIO, "render.sh");
const BASE = process.env.SCENE_APP_URL ?? "http://localhost:5173";

const require = createRequire(join(WEB, "package.json"));
const { chromium } = require("playwright");

const APP_INIT = `
  try { localStorage.setItem('cookies-consent', 'granted'); } catch (_) {}
`;

const APP_CSS = [
  ".cookie-banner{display:none!important}",
  ".mobile-bottom-nav{display:none!important}",
  "html,body{scrollbar-width:none!important}",
].join("");

const DOSSIER_AUTH = "?mockAuth=on&mockTier=pass";

function stageUrl(appPath, headline, sub) {
  const q = new URLSearchParams({
    scene: "1",
    shell: "phone",
    url: BASE + appPath,
    brand: "Auto-Consul",
    logo: "AC",
    accent: "#0b1220",
    accent2: "#14b8a6",
    side: "left",
    headline,
    sub,
  });
  return `file://${STAGE}?${q.toString()}`;
}

function appFrame(page) {
  return page.frames().find((f) => f.parentFrame() === page.mainFrame()) ?? null;
}

async function setNarrative(page, headline, sub) {
  await page.evaluate(
    ([h, s]) => {
      const hl = document.querySelector(".scene__headline");
      const sb = document.querySelector(".scene__sub");
      if (hl) hl.textContent = h;
      if (sb) sb.textContent = s;
    },
    [headline, sub],
  );
}

async function capturePoster(browser) {
  const ctx = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1180, height: 940 },
  });
  await ctx.addInitScript({ content: APP_INIT });
  await ctx.route("**/*", async (route) => {
    const r = route.request();
    if (!r.url().startsWith("http")) return route.continue();
    try {
      const resp = await route.fetch();
      const h = { ...resp.headers() };
      delete h["x-frame-options"];
      delete h["content-security-policy"];
      delete h["content-security-policy-report-only"];
      return route.fulfill({ response: resp, headers: h });
    } catch {
      return route.continue();
    }
  });

  const page = await ctx.newPage();
  await page.goto(
    stageUrl(
      `/voertuig/A898CD${DOSSIER_AUTH}`,
      "Enter a plate. Get the dossier.",
      "RDW facts, AI analysis, and export — then chat.",
    ),
    { waitUntil: "load" },
  );

  let frame = appFrame(page);
  for (let i = 0; i < 40 && !frame; i++) {
    await page.waitForTimeout(200);
    frame = appFrame(page);
  }
  if (!frame) throw new Error("App iframe missing");

  await frame.waitForSelector(".hero-card", { timeout: 20000 });
  await frame.addStyleTag({ content: APP_CSS }).catch(() => {});
  await frame.waitForSelector(".dossier-lite-summary", { timeout: 15000 });
  await frame.evaluate(() => {
    document.querySelector(".dossier-lite-analysis")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(800);

  const posterPath = join(OUT, "poster-dossier-chat-flow.png");
  await page.screenshot({ path: posterPath, type: "png" });
  console.log(`→ ${posterPath}`);
  await ctx.close();
}

async function main() {
  const posterOnly = process.argv.includes("--poster-only");

  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error("\nStart the app first: cd web && npm run dev:mock\n");
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });

  if (posterOnly) {
    const browser = await chromium.launch();
    try {
      await capturePoster(browser);
    } finally {
      await browser.close();
    }
    return;
  }

  const videoDir = mkdtempSync(join(tmpdir(), "ac-scenes-"));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1180, height: 940 },
    recordVideo: { dir: videoDir, size: { width: 1180, height: 940 } },
  });

  await ctx.addInitScript({ content: APP_INIT });
  await ctx.route("**/*", async (route) => {
    const r = route.request();
    if (!r.url().startsWith("http")) return route.continue();
    try {
      const resp = await route.fetch();
      const h = { ...resp.headers() };
      delete h["x-frame-options"];
      delete h["content-security-policy"];
      delete h["content-security-policy-report-only"];
      return route.fulfill({ response: resp, headers: h });
    } catch {
      return route.continue();
    }
  });

  const page = await ctx.newPage();

  console.log("→ Recording dossier → chat flow…");

  // Beat 1 — signed-in dossier with AI section visible
  await page.goto(
    stageUrl(
      `/voertuig/A898CD${DOSSIER_AUTH}`,
      "Enter a plate. Get the dossier.",
      "RDW facts, AI analysis, and export — then chat.",
    ),
    { waitUntil: "load" },
  );

  let frame = appFrame(page);
  for (let i = 0; i < 40 && !frame; i++) {
    await page.waitForTimeout(200);
    frame = appFrame(page);
  }
  if (!frame) throw new Error("App iframe missing");

  await frame.waitForSelector(".hero-card", { timeout: 20000 });
  await frame.addStyleTag({ content: APP_CSS }).catch(() => {});
  await frame.waitForSelector(".dossier-lite-summary", { timeout: 15000 });
  await frame.evaluate(() => {
    document.querySelector(".dossier-lite-analysis")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(2200);

  const posterPath = join(OUT, "poster-dossier-chat-flow.png");
  await page.screenshot({ path: posterPath, type: "png" });
  console.log(`→ ${posterPath}`);

  // Beat 2 — scroll export panel briefly
  await setNarrative(
    page,
    "Export a buyer report.",
    "PDF with RDW, lite AI, and deep analysis preview.",
  );
  await frame.evaluate(() => {
    document.querySelector(".dossier-export-panel")?.scrollIntoView({ block: "center" });
  });
  await frame.waitForSelector(".dossier-export-preview-deep p", { timeout: 12000 });
  await page.waitForTimeout(1800);

  // Beat 3 — open chat (preview = empty + suggestions)
  await setNarrative(
    page,
    "Ask about this car.",
    "Open chat with the plate already pinned.",
  );

  const chatUrl =
    `${BASE}/v2/chat?mockAuth=on&mockTier=pass&plate=A898CD`;
  await frame.goto(chatUrl, { waitUntil: "load", timeout: 30000 });
  await frame.waitForSelector(".cv2-empty", { timeout: 20000 });
  await page.waitForTimeout(1200);

  // Beat 4 — type a question
  await setNarrative(
    page,
    "Ask in plain language.",
    "RDW checks, APK, recalls — one conversation.",
  );

  const question = "Is de APK nog geldig voor RN-923-N?";
  const input = frame.locator(".cv2-textarea");
  await input.click();
  await input.pressSequentially(question, { delay: 55 });
  await input.press("Enter");
  await frame.waitForSelector(".vehicle-data-card:not(.vehicle-data-card-error)", {
    timeout: 25000,
  });
  await page.waitForTimeout(2500);

  const video = page.video();
  await page.close();
  await ctx.close();
  await browser.close();

  const webm = await video.path();
  console.log(`→ Transcoding ${webm}`);

  execFileSync("bash", [RENDER, webm, OUT, "dossier-chat-flow", "8", "0.8", "1.35", "0"], {
    stdio: "inherit",
  });

  rmSync(videoDir, { recursive: true, force: true });
  console.log(`\nSaved ${OUT}/dossier-chat-flow.gif`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
