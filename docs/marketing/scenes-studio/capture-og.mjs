#!/usr/bin/env node
/**
 * Capture high-retina Open Graph (OG) cards for social share.
 *
 *   node docs/marketing/scenes-studio/capture-og.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDIO = __dirname;
const REPO = resolve(STUDIO, "../../..");
const WEB = join(REPO, "web");
const OUT = join(REPO, "docs/marketing-assets/og");
const OG_HTML = join(STUDIO, "og.html");

const require = createRequire(join(WEB, "package.json"));
const { chromium } = require("playwright");

const CARDS = ["main", "chat", "compare", "ai"];

async function captureCard(browser, type) {
  const outFile = `og-${type}.png`;
  const viewport = { width: 1200, height: 630 };

  const ctx = await browser.newContext({
    deviceScaleFactor: 2, // 2x scale for crisp high-DPI retina display
    viewport,
  });

  const page = await ctx.newPage();
  const url = `file://${OG_HTML}?type=${type}`;

  console.log(`→ ${outFile}`);
  await page.goto(url, { waitUntil: "load" });
  
  // Give extra 1s for any local image loading and rendering transitions
  await page.waitForTimeout(1000);

  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, outFile), type: "png" });
  await ctx.close();
}

async function main() {
  console.log("Generating premium OG cards...");
  const browser = await chromium.launch();
  try {
    for (const card of CARDS) {
      await captureCard(browser, card);
    }
    console.log(`\nAll premium OG cards successfully saved to ${OUT}/`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
