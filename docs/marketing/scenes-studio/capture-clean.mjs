#!/usr/bin/env node
/**
 * Capture clean marketing stills (only phone and browser shells, transparent background).
 *
 *   cd web && npm run dev:mock
 *   node docs/marketing/scenes-studio/capture-clean.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDIO = __dirname;
const REPO = resolve(STUDIO, "../../..");
const WEB = join(REPO, "web");
const OUT = join(REPO, "docs/marketing-assets/shells");
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
const COMPARE_PRO = "?plates=A898CD,J640HT&mockAuth=on&mockTier=pro";

const SCENES = [
  {
    id: "home",
    path: "/",
    waitFor: ".hero .lookup-form, .plate-lookup-hero",
    waitMs: 2000,
  },
  {
    id: "dossier",
    path: `/voertuig/A898CD${DOSSIER_AUTH}`,
    waitFor: ".hero-card",
    waitMs: 3500,
    vh: 900,
  },
  {
    id: "dossier-ai",
    path: `/voertuig/A898CD${DOSSIER_AUTH}`,
    waitFor: ".dossier-lite-summary",
    scrollTo: ".dossier-lite-analysis",
    waitMs: 1200,
    vh: 920,
  },
  {
    id: "dossier-export",
    path: `/voertuig/A898CD${DOSSIER_AUTH}`,
    waitFor: ".dossier-export-preview-deep p",
    scrollTo: ".dossier-export-panel",
    waitMs: 1500,
    vh: 960,
  },
  {
    id: "chat",
    path: "/v2/chat?mockAuth=on&mockTier=pass&plate=A898CD&session=marketing-demo",
    waitFor: ".cv2-messages-wrapper .vehicle-data-card",
    waitMs: 2000,
  },
  {
    id: "chat-onboarding",
    path: "/v2/chat?mockAuth=on&session=marketing-onboarding",
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
    waitFor: ".compare-table .compare-plate-head",
    waitForCount: 2,
    waitForReady: ".compare-row-wide",
    waitForText: /BMW/i,
    waitMs: 1500,
    scrollTo: ".compare-row-ai",
    waitTimeoutMs: 30000,
    vh: 1020,
    vw: 1360,
  },
];

function stageUrl({ shell, appPath, vw, vh }) {
  const q = new URLSearchParams({
    shell,
    url: BASE + appPath,
    clean: "1",
    bar: "light",
    title: "autoconsul.nl",
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
  // Padding of 60px on all sides, total 120px extra width/height.
  const vw = shell === "phone" ? undefined : scene.vw ?? 1280;
  const vh = shell === "phone" ? undefined : scene.vh ?? 800;

  const viewport =
    shell === "phone"
      ? { width: 512, height: 938 } // Phone container (392x818) + 120px padding (60px each side)
      : { width: vw + 120, height: vh + 47 + 120 }; // Browser container (vw x vh+47) + 120px padding

  const ctx = await prepareContext(browser, viewport);
  const page = await ctx.newPage();
  const url = stageUrl({
    shell: shell === "phone" ? "phone" : "browser",
    appPath: scene.path,
    vw,
    vh,
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
  await page.screenshot({ path: join(OUT, outFile), type: "png", omitBackground: true });
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
    console.log(`\nAll clean screenshots saved to ${OUT}/`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
