# Scene capture studio (local only — gitignored)

Regenerate README screenshots with desktop + iPhone shells.

```bash
# Terminal 1
cd web && npm run dev:mock

# Terminal 2 (once: npx playwright install chromium)
node docs/marketing/scenes-studio/capture.mjs
node docs/marketing/scenes-studio/capture-flow.mjs   # dossier → chat GIF (ffmpeg)
```

Output: `docs/screenshots/{home,dossier,dossier-ai,dossier-export,chat,chat-onboarding,compare}-{desktop,phone}.png` and `dossier-chat-flow.gif`.

Single scene: `SCENE=compare node docs/marketing/scenes-studio/capture.mjs`
