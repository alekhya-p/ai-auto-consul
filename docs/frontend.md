# Frontend

The web app is a React 18 single-page application built with Vite and TypeScript. It is mobile-first and ships as a progressive web app (service worker, manifest, standalone display mode).

## Stack

| Concern | Choice |
|---------|--------|
| Framework | React 18 + React Router 7 |
| Build | Vite 5 |
| Auth client | Firebase Auth (email/password + Google) |
| Chat UI | CopilotKit v2 (`@copilotkit/react-core`) |
| Agent transport | AG-UI (`@ag-ui/client` `HttpAgent`) |
| i18n | JSON locale files (`src/i18n/nl.json`, `en.json`) |
| Tests | Vitest + Testing Library; Playwright for e2e |

## Agentic chat (`web/src/features/chat-v2/`)

The chat UI connects to the Python agent through the AG-UI protocol.

### Architecture

`ConsulCopilotChat` wraps the chat in a `CopilotKitProvider`. The actual agent is **not** a CopilotKit Cloud runtime - it is a self-hosted Python service speaking the AG-UI protocol. The provider registers an `HttpAgent` pointed at `/v2/agent` (proxied to port 8081 in dev).

Firebase ID tokens are passed via the provider's `headers` prop so every agent run includes `Authorization: Bearer <token>`. Putting the token on the `HttpAgent` constructor does not work; CopilotKit overwrites agent headers on each run.

### Generative UI - tool renders

`ChatMessages.tsx` registers `useRenderTool` handlers for each ADK tool name. **Tool names must match exactly** - the Python side uses snake_case (`rdw_fetch`, `ai_analysis_fetch`, `web_search`, etc.).

| Tool | Card component | What the user sees |
|------|----------------|-------------------|
| `rdw_fetch` | `VehicleDataCard` | Official registry: make, model, APK, recalls |
| `ai_analysis_fetch` | `AnalysisCard` | Market value, pros/cons, tax notes, upgrade CTA |
| `web_search` | `SourcesCard` | Grounded answer with clickable source links |
| `suggest_compare` | `CompareCard` | Comparison prompt across plates |
| `suggest_followups` | `FollowUpSuggestions` | Tappable follow-up chips |

Raw tool names and JSON never appear in the transcript. A step strip shows progress ("Looking up RDW…", "Running analysis…") while tools execute.

### Provenance badges

`SourceBadge` labels each fact's origin:

- RDW - verified Dutch registry data
- AI - model-generated estimate (never presented as fact)
- Web - live search with citations

### Session history

`ChatSidebar` lists threads. Selecting one loads a message snapshot from the agent's history API (`/v2/agent/message_snapshot/{thread_id}`). The AG-UI `thread_id` is bound to the sidebar session id so reload and navigation stay consistent.

### Quota handling

When the user exhausts chat turns, the agent returns HTTP 429. `ConsulCopilotChat` parses the error and shows an in-chat `UpgradePrompt` with a link to pricing - instead of a silent failure.

## Vehicle dossier (`web/src/pages/VoertuigPage.tsx`)

The dossier page composes several data sources:

- RDW vehicle detail (`GET /v1/voertuig/:plate`)
- Running costs (`/kosten`)
- Market listings (`/marktaanbod`)
- AI analysis (`/analyse` or `/v2/analysis` for compare/deep flows)

In mock mode (`npm run dev:mock`), `/v1/*` is served from `web/mocks/` JSON fixtures so the page works without any backend.

## Project layout (high level)

```
web/src/
├── features/
│   ├── chat-v2/       Agentic chat (CopilotKit + cards)
│   ├── dossier/       Dossier export and lite analysis UI
│   ├── compare/       Compare flow and paywall sheet
│   ├── admin/         Usage analytics (admin-only)
│   └── account/       Chat thread list on account page
├── pages/             Route-level screens
├── components/        Shared UI (header, footer, plate lookup, marketing)
└── lib/               API client, auth, Firebase, analytics, i18n
```

## Environment variables

Copy `web/.env.example` to `web/.env.local`. Firebase config keys are required for sign-in flows. For UI-only work, use `npm run dev:mock` - most dossier screens work without auth or a live API.

See [running-locally.md](./running-locally.md) for the full setup.
