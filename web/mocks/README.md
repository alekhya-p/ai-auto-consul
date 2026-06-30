# Mock API fixtures

Used when `VITE_USE_MOCKS=true` (or `npm run dev:mock`). The Vite dev server intercepts `/v1/*` and `/v2/agent*` and serves from this folder instead of live backends.

## Usage

```bash
cd web
npm run dev:mock
```

Open http://localhost:5173/

## Routes

| Request | Fixture / handler |
|---------|-------------------|
| `GET /v1/voertuig/RN923N` | `voertuig/RN923N.json` (Opel Karl) |
| `GET /v1/voertuig/J640HX` | `voertuig/J640HX.json` (BMW 318i) |
| `GET /v1/voertuig/<other>` | `voertuig/_notfound.json` |
| `GET /v1/voertuig/<plate>/kosten` | `kosten/<plate>.json` or `kosten/_default.json` |
| `GET /v1/voertuig/<plate>/analyse` | `analyse/<plate>.json` or `analyse/_default.json` |
| `GET /v1/voertuig/<plate>/marktaanbod` | `marktaanbod/_default.json` |
| `POST /v1/lookup/rdw` | Shim that projects voertuig fixtures to legacy shape |
| `POST /v2/agent` | `agent/mock-agent.mjs` - AG-UI SSE with `rdw_fetch` tool cards |
| `GET /v2/agent/message_snapshot/marketing-demo` | `agent/demo-thread.json` (plate chat + RDW tool card) |
| `GET /v2/agent/message_snapshot/marketing-onboarding` | `agent/demo-onboarding-thread.json` (welcome + capabilities) |
| `GET /v2/analysis` | `analyse/*.json` |

## Chat in mock mode

No Python agent required. The UI uses the **same CopilotKit path** as production; only the server is stubbed.

```bash
# Interactive - type a question, get RDW tool card + answer
http://localhost:5173/v2/chat?mockAuth=on&plate=RN923N

# Pre-filled marketing thread (RDW tool card)
http://localhost:5173/v2/chat?mockAuth=on&plate=RN923N&session=marketing-demo

# Onboarding / capabilities thread (no plate)
http://localhost:5173/v2/chat?mockAuth=on&session=marketing-onboarding
```

Realistic Dutch buyer questions (APK, recalls, WAM, price) pick different scripted replies in `agent/mock-agent.mjs`.

## Adding a fixture

Add `voertuig/<PLATE>.json` using the shape in `web/src/lib/types.ts`. Plates are matched case-insensitively.

## Not mocked

- Firebase Auth - use `?mockAuth=on` for signed-in UI without Firebase, or configure `.env.local`
- Stripe / passes - needs Functions emulator

## Screenshots

Use `docs/marketing/scenes-studio/capture.mjs` and `capture-flow.mjs` (local, gitignored) while `dev:mock` runs.
