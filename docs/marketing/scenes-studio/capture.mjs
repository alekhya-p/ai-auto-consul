#!/usr/bin/env node
/**
 * Capture marketing stills (desktop + iPhone shells).
 *
 *   cd web && npm run dev:mock
 *   node docs/marketing/scenes-studio/capture.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDIO = __dirname;
const REPO = resolve(STUDIO, "../../..");
const WEB = join(REPO, "web");
const OUT = join(REPO, "docs/screenshots");
const STAGE = join(STUDIO, "stage.html");
const BASE = process.env.SCENE_APP_URL ?? "http://localhost:5173";

const require = createRequire(join(WEB, "package.json"));
const { chromium } = require("playwright");

const APP_INIT = `
  try {
    localStorage.setItem('cookies-consent', 'granted');
  } catch (_) {}
`;

const APP_CSS = [
  ".cookie-banner{display:none!important}",
  "html,body{scrollbar-width:none!important}",
  "html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important}",
  ".mobile-bottom-nav{display:none!important}",
].join("");

const DOSSIER_AUTH = "?mockAuth=on&mockTier=pass";
const COMPARE_PRO = "?plates=J650NX,J640HT&mockAuth=on&mockTier=pro";

const SCENES = [
  {
    id: "home",
    path: "/",
    headline: "Research any Dutch plate.",
    sub: "RDW dossier, AI analysis, and agentic chat in one place.",
    waitFor: ".hero .lookup-form, .plate-lookup-hero",
    waitMs: 2000,
  },
  {
    id: "dossier",
    path: `/voertuig/J650NX${DOSSIER_AUTH}`,
    headline: "Sourced vehicle dossier.",
    sub: "Registry facts, market listings, and AI insights when signed in.",
    waitFor: ".hero-card",
    waitMs: 3500,
    vh: 900,
  },
  {
    id: "dossier-ai",
    path: `/voertuig/J650NX${DOSSIER_AUTH}`,
    headline: "AI lite analysis on the dossier.",
    sub: "Summary, market band, and buyer flags — no chat required.",
    waitFor: ".dossier-lite-summary",
    scrollTo: ".dossier-lite-analysis",
    waitMs: 1200,
    vh: 920,
  },
  {
    id: "dossier-export",
    path: `/voertuig/J650NX${DOSSIER_AUTH}`,
    headline: "Export a full buyer report.",
    sub: "PDF with RDW facts, lite AI, and cached deep analysis preview.",
    waitFor: ".dossier-export-preview-deep p",
    scrollTo: ".dossier-export-panel",
    waitMs: 1500,
    vh: 960,
  },
  {
    id: "chat",
    path: "/v2/chat?mockAuth=on&mockTier=pass&plate=J650NX&session=marketing-demo",
    headline: "Ask in plain language.",
    sub: "Tool cards surface RDW data and analysis inline.",
    waitFor: ".cv2-messages-wrapper .vehicle-data-card",
    waitMs: 2000,
  },
  {
    id: "chat-onboarding",
    path: "/v2/chat?mockAuth=on&session=marketing-onboarding",
    headline: "Your Dutch car-buying expert.",
    sub: "Greeting, capability overview, and follow-up suggestions — no plate needed.",
    waitFor: ".cv2-msg-user",
    waitForCount: 2,
    waitForReady: ".cv2-followup-chip",
    waitForText: /Can you explain RDW data/,
    scrollMessagesBottom: true,
    waitMs: 600,
    vh: 880,
  },
  {
    id: "compare",
    path: `/compare${COMPARE_PRO}`,
    headline: "Compare plates side by side.",
    sub: "Opel Karl vs BMW 318i — RDW, costs, and AI summaries in one table.",
    waitFor: ".compare-table .compare-plate-head",
    waitForCount: 2,
    waitForReady: ".compare-row-wide",
    waitForText: /Opel Karl/,
    waitMs: 1500,
    scrollTo: ".compare-row-ai",
    waitTimeoutMs: 30000,
    vh: 1020,
    vw: 1360,
  },
];

function stageUrl({ shell, appPath, headline, sub, vw, vh }) {
  const q = new URLSearchParams({
    scene: "1",
    shell,
    url: BASE + appPath,
    brand: "Auto-Consul",
    logo: "AC",
    accent: "#0b1220",
    accent2: "#14b8a6",
    side: "left",
    bar: "light",
    title: "autoconsul.nl",
    headline,
    sub,
  });
  if (vw) q.set("vw", String(vw));
  if (vh) q.set("vh", String(vh));
  return `file://${STAGE}?${q.toString()}`;
}

function appFrame(page) {
  return page.frames().find((f) => f.parentFrame() === page.mainFrame()) ?? null;
}

async function prepareContext(browser, viewport) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport });
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
  return ctx;
}

async function waitForApp(page, selector, timeoutMs = 15000, minCount = 1) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = appFrame(page);
    if (frame) {
      try {
        await frame.waitForSelector(selector, { timeout: 800, state: "visible" });
        const count = await frame.locator(selector).count();
        if (count >= minCount) {
          await frame.addStyleTag({ content: APP_CSS }).catch(() => {});
          return frame;
        }
      } catch {
        /* iframe still loading */
      }
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`Timed out waiting for ${minCount}× ${selector} in app iframe`);
}

async function scrollToSelector(frame, selector) {
  await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
  }, selector);
  await frame.waitForTimeout(350);
}

async function scrollMessagesToBottom(frame) {
  await frame.evaluate(() => {
    const area = document.querySelector(".cv2-messages-area");
    if (area) area.scrollTop = area.scrollHeight;
  });
  await frame.waitForTimeout(400);
}

async function capture(browser, { shell, scene, outFile }) {
  const viewport =
    shell === "phone"
      ? { width: 1180, height: 940 }
      : { width: 1880, height: 1040 };

  const ctx = await prepareContext(browser, viewport);
  const page = await ctx.newPage();
  const url = stageUrl({
    shell: shell === "phone" ? "phone" : "browser",
    appPath: scene.path,
    headline: scene.headline,
    sub: scene.sub,
    vw: shell === "phone" ? undefined : scene.vw ?? 1280,
    vh: shell === "phone" ? undefined : scene.vh ?? 800,
  });

  console.log(`→ ${outFile}`);
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  const frame = await waitForApp(
    page,
    scene.waitFor,
    scene.waitTimeoutMs ?? 20000,
    scene.waitForCount ?? 1,
  );
  if (scene.waitForText) {
    await frame
      .locator(scene.waitForReady ?? scene.waitFor)
      .filter({ hasText: scene.waitForText })
      .first()
      .waitFor({ timeout: scene.waitTimeoutMs ?? 20000, state: "visible" });
  }
  if (scene.scrollTo) {
    await scrollToSelector(frame, scene.scrollTo);
  }
  if (scene.scrollMessagesBottom) {
    await scrollMessagesToBottom(frame);
  }
  await page.waitForTimeout(scene.waitMs);

  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, outFile), type: "png" });
  await ctx.close();
}

async function main() {
  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error(`\nStart the app first: cd web && npm run dev:mock\n`);
    process.exit(1);
  }

  const only = process.env.SCENE?.split(",").map((s) => s.trim()).filter(Boolean);
  const scenes = only?.length ? SCENES.filter((s) => only.includes(s.id)) : SCENES;
  if (scenes.length === 0) {
    console.error(`No scenes matched SCENE=${process.env.SCENE}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  try {
    for (const scene of scenes) {
      await capture(browser, { shell: "desktop", scene, outFile: `${scene.id}-desktop.png` });
      await capture(browser, { shell: "phone", scene, outFile: `${scene.id}-phone.png` });
    }
    console.log(`\nSaved to ${OUT}/`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
