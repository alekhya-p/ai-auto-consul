/// <reference types="vitest" />
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { handleMockAgentRoutes } = require("./mocks/agent/mock-agent.mjs");

// ─── Mock-API dev plugin ─────────────────────────────────────────────
//
// When VITE_USE_MOCKS=true, intercept every /v1/* request inside the
// Vite dev server and serve from local JSON fixtures under ./mocks/.
// Lets you iterate on the React app without running the private /v1 API.
//
// See web/mocks/README.md for the route table.
function mockApiPlugin(): PluginOption {
  if (process.env.VITE_USE_MOCKS !== "true") return false;

  const root = resolve(__dirname, "mocks");

  function readJson(path: string): unknown | null {
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return null;
    }
  }

  function reply(res: import("http").ServerResponse, body: unknown, status = 200) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  }

  return {
    name: "auto-consul-mock-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";

        // Mock agent-v2 (AG-UI SSE + history) - same UI path as production.
        if (url.startsWith("/v2/")) {
          const handled = await handleMockAgentRoutes(req, res, url, root);
          if (handled) return;
        }

        if (!url.startsWith("/v1/")) return next();

        // Optional artificial latency to feel the skeleton states in dev.
        // `VITE_MOCK_LATENCY_MS` overrides; default 50ms keeps things snappy.
        const latencyMs = Number(process.env.VITE_MOCK_LATENCY_MS ?? 50);
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        // GET /v1/voertuig/{plate}/analyse - AI tier (auth-required in prod).
        // Mock mode treats the caller as signed-in unless ?signedOut=1 is
        // present in the URL - handy for previewing the locked-teaser fallback.
        const mAi = url.match(/^\/v1\/voertuig\/([A-Z0-9]+)\/analyse(?:\?|$)/i);
        if (mAi && req.method === "GET") {
          const plate = mAi[1].toUpperCase();
          if (/[?&]signedOut=1/.test(url)) {
            await sleep(latencyMs);
            res.statusCode = 401;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "auth_required" }));
            return;
          }
          const specific = resolve(root, "analyse", `${plate}.json`);
          const fallback = resolve(root, "analyse", "_default.json");
          const body = existsSync(specific)
            ? readJson(specific)
            : readJson(fallback);
          // Deliberate 4s latency so the skeleton + step rotator are visible.
          const aiLatencyMs = Number(process.env.VITE_MOCK_AI_LATENCY_MS ?? 4000);
          await sleep(aiLatencyMs);
          return reply(res, body);
        }

        // GET /v1/voertuig/{plate}/kosten?province=NH
        const mKosten = url.match(/^\/v1\/voertuig\/([A-Z0-9]+)\/kosten(?:\?|$)/i);
        if (mKosten && req.method === "GET") {
          const plate = mKosten[1].toUpperCase();
          const specific = resolve(root, "kosten", `${plate}.json`);
          const fallback = resolve(root, "kosten", "_default.json");
          const body = existsSync(specific)
            ? readJson(specific)
            : readJson(fallback);
          if (!body) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "plate_not_found" }));
            return;
          }
          // Echo the province query param so the UI can show what was used.
          const provinceMatch = url.match(/[?&]province=([A-Z]{2})/i);
          if (provinceMatch && typeof body === "object" && body !== null) {
            (body as Record<string, unknown>).province = provinceMatch[1].toUpperCase();
          }
          await sleep(latencyMs);
          return reply(res, body);
        }

        // GET /v1/voertuig/{plate}/marktaanbod
        const mAan = url.match(/^\/v1\/voertuig\/([A-Z0-9]+)\/marktaanbod(?:\?|$)/i);
        if (mAan && req.method === "GET") {
          const file = resolve(root, "marktaanbod", "_default.json");
          const body = readJson(file) ?? { listings: [], fetchedAt: null };
          await sleep(latencyMs);
          return reply(res, body);
        }

        // GET /v1/voertuig/{plate}
        const mVoertuig = url.match(/^\/v1\/voertuig\/([A-Z0-9]+)(?:\?|$)/i);
        if (mVoertuig && req.method === "GET") {
          const plate = mVoertuig[1].toUpperCase();
          const specific = resolve(root, "voertuig", `${plate}.json`);
          const fallback = resolve(root, "voertuig", "_notfound.json");
          const body = existsSync(specific)
            ? readJson(specific)
            : readJson(fallback) ?? { kenteken: plate, found: false, apkHistorie: [] };
          await sleep(latencyMs);
          return reply(res, body);
        }

        // POST /v1/lookup/rdw - legacy free endpoint, thin shim.
        if (url.startsWith("/v1/lookup/rdw") && req.method === "POST") {
          // Read the request body to get the plate.
          let raw = "";
          req.on("data", (c) => (raw += c));
          req.on("end", () => {
            let plate = "RN923N";
            try {
              plate = (JSON.parse(raw) as { plate?: string }).plate?.toUpperCase() ?? plate;
            } catch {
              /* fall through */
            }
            const detail = readJson(resolve(root, "voertuig", `${plate}.json`));
            if (!detail) {
              return reply(res, {
                kenteken: plate,
                found: false,
                make: null,
                model: null,
                firstRegistration: null,
                firstNlRegistration: null,
                imported: false,
                apkValidUntil: null,
                apkValid: false,
                openRecall: false,
                liabilityInsured: false,
                exported: false,
                taxi: false,
                energyLabel: null,
              });
            }
            // Project the rich detail down onto the legacy summary shape.
            const d = detail as Record<string, unknown>;
            const algemeen = d.algemeen as Record<string, unknown> | null;
            const status = d.status as Record<string, unknown> | null;
            const motor = d.motorMilieu as Record<string, unknown> | null;
            return reply(res, {
              kenteken: d.kenteken,
              found: d.found,
              make: algemeen?.merk ?? null,
              model: algemeen?.model ?? null,
              firstRegistration: algemeen?.datumEersteToelating ?? null,
              firstNlRegistration: algemeen?.datumEersteNlRegistratie ?? null,
              imported: algemeen?.importauto ?? false,
              apkValidUntil: status?.apkGeldigTot ?? null,
              apkValid: status?.apkGeldig ?? false,
              openRecall: status?.openstaandeTerugroepactie ?? false,
              liabilityInsured: status?.wamVerzekerd ?? false,
              exported: status?.exported ?? false,
              taxi: status?.taxi ?? false,
              energyLabel: motor?.zuinigheidslabel ?? null,
            });
          });
          return;
        }

        // Anything else under /v1 in mock mode - short-circuit a 404.
        return reply(res, { error: "not_mocked", path: url }, 404);
      });

      // Eye-catching log line so it's obvious you're in mock mode.
      console.log(
        "\n  \x1b[33m▶ Mock API enabled\x1b[0m - serving /v1/* + /v2/agent from \x1b[36mweb/mocks/\x1b[0m\n" +
        "    Try: \x1b[32m/voertuig/RN923N\x1b[0m (Opel) or \x1b[32m/voertuig/J640HX\x1b[0m (BMW)\n" +
        "    Chat: \x1b[32m/v2/chat?mockAuth=on&plate=RN923N\x1b[0m (mock agent, no Python)\n"
      );
    },
  };
}

// Dev server proxies /v1/* to the agent on :8080 so the browser doesn't
// need CORS in development. Prod is served from Firebase Hosting with
// rewrites in firebase.json (added in a later pass).
//
// PWA: Workbox service worker at build time. /v1/* excluded from cache (auth + credits).
export default defineConfig({
  plugins: [
    mockApiPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "robots.txt", "icons/icon.svg", "icons/icon-maskable.svg"],
      manifest: {
        name: "Auto-Consul",
        short_name: "Auto-Consul",
        description: "Dutch vehicle-buying assistant - RDW + Autotelex dossiers.",
        lang: "nl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0b1220",
        theme_color: "#0b1220",
        // SVG icons keep the repo binary-free; both Chromium and Safari
        // accept SVG entries since 2023. The `sizes: "any"` hint lets the
        // OS rasterize at the size it needs (Android home-screen, iOS,
        // splash screens).
        icons: [
          { src: "/icons/icon.svg",          sizes: "any",  type: "image/svg+xml", purpose: "any" },
          { src: "/icons/icon-maskable.svg", sizes: "any",  type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // CopilotKit + the syntax-highlighter language chunks push the main
        // bundle past the 2 MiB default; raise the precache ceiling so the
        // app still works fully offline.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/index.html",
        // Never let the SW intercept the agent API - it's auth-gated,
        // credit-metered, and the SSE stream must not be cached.
        navigateFallbackDenylist: [/^\/v1\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/v1/"),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        // Keep the SW off in `vite dev` to avoid stale caches during HMR.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:8080",
        changeOrigin: false,
      },
      // Python agent-v2 when not in mock mode (PORT=8081).
      "/v2/agent": {
        target: "http://127.0.0.1:8081",
        changeOrigin: false,
        bypass(req) {
          if (process.env.VITE_USE_MOCKS === "true") return req.url ?? false;
        },
      },
      "/v2/analysis": {
        target: "http://127.0.0.1:8081",
        changeOrigin: false,
        bypass(req) {
          if (process.env.VITE_USE_MOCKS === "true") return req.url ?? false;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
