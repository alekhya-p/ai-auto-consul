# Local development

## Prerequisites

- Node.js 20+
- Python 3.11+
- Firebase CLI (for Functions emulator)
- GCP: Vertex AI enabled, `gcloud auth application-default login`
- Optional: Stripe CLI for webhook testing

---

## 1. Web only (mock `/v1`)

```bash
cd web
npm install
npm run dev:mock
```

No agent, no Firebase required for dossier pages. Plates: `RN923N`, `J640HX`.

### Screenshots (local)

Regenerate desktop + phone shells with the gitignored studio while `dev:mock` is running:

```bash
node docs/marketing/scenes-studio/capture.mjs          # PNG stills
node docs/marketing/scenes-studio/capture-flow.mjs     # dossier → chat GIF (+ MP4)
```

Output: `docs/screenshots/{home,dossier,dossier-ai,dossier-export,chat,chat-onboarding,compare}-{desktop,phone}.png` and `dossier-chat-flow.gif`.

Chat captures use the **mock AG-UI agent** in `web/mocks/agent/` (same UI as production). Demo stills load `session=marketing-demo`; the flow GIF sends a real question and waits for the RDW tool card.

---

## 2. Web + Python agent

**Agent (port 8081):**

```bash
cd agent-v2
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set GOOGLE_CLOUD_PROJECT, RDW keys optional
PORT=8081 python main.py
```

**Web:**

```bash
cd web
npm install
cp .env.example .env.local   # Firebase keys for auth + Firestore billing
npm run dev
```

Chat: http://localhost:5173/chat

### Agent env (`agent-v2/.env`)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLOUD_PROJECT` | Vertex AI + Firestore (quota/billing) |
| `GOOGLE_CLOUD_LOCATION` | `europe-west4` |
| `RDW_API_KEY_ID` / `RDW_API_KEY_SECRET` | RDW API keys from opendata.rdw.nl |
| `SESSION_BACKEND` | `memory` (default local) or `firestore` |
| `FREE_DAILY_TURN_LIMIT` | Free users without a pass (default 20) |

Without Firestore, chat-turn quota and credit debit need the emulator or a real project.

---

## 3. Functions emulator

```bash
cd functions
npm install
npm run build
firebase emulators:start --only functions,firestore,auth
```

Point `agent-v2` and `web` at the Firestore emulator:

```bash
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

### Welcome pass test

1. Sign up via web with emulator auth
2. Check Firestore: `users/{uid}/passes/welcome-{uid}`

### Stripe webhook test

```bash
stripe listen --forward-to http://127.0.0.1:5001/PROJECT_ID/europe-west4/stripeWebhook
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.uid=TEST_UID \
  --add checkout_session:metadata.pack=SINGLE
```

---

## 4. Full stack checklist

| Service | Port | Notes |
|---------|------|-------|
| Vite | 5173 | `npm run dev:mock` |
| agent-v2 | 8081 | `PORT=8081 python main.py` |
| Functions | 5001 | emulator |
| Firestore | 8080 | emulator |
| Auth | 9099 | emulator |

---

## Credentials summary

| Service | Get credentials |
|---------|-----------------|
| **Vertex AI** | GCP Console → APIs → Vertex AI → ADC login |
| **RDW** | https://opendata.rdw.nl → Sleutel ID + geheim |
| **Firebase** | Console → Project settings → Web app |
| **Stripe** | Dashboard test keys + CLI webhook secret |

See [infrastructure.md](./infrastructure.md) #7 for production setup.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Dossier pages fail | Use `npm run dev:mock` |
| Chat 401 | Sign in; check `CopilotKitProvider` headers |
| Chat 429 | Expected when turns exhausted - check pass in Firestore |
| No tool cards | Tool names must be snake_case in `useRenderTool` |
| Vertex permission denied | Enable API; grant `roles/aiplatform.user` |
| Quota not working locally | Use Firestore emulator or real project |
