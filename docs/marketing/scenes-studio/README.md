# Scene capture studio (local only — gitignored)

Regenerate README screenshots with desktop + iPhone shells, clean reusable device frames, and stunning OG cards.

### Prerequisites

```bash
# Terminal 1: Start the mock app dev server
cd web && npm run dev:mock

# Terminal 2: One-time installation of playwright browser if not already done
npx playwright install chromium
```

### Commands

1. **Product Scenes (With brand grid, copy & backgrounds)**
   ```bash
   node docs/marketing/scenes-studio/capture.mjs
   ```
   *Output*: Saves to `docs/screenshots/{scene}-{desktop,phone}.png`

2. **Clean Device Shells (Transparent background, full unclipped shadow, no scene copy)**
   ```bash
   node docs/marketing/scenes-studio/capture-clean.mjs
   ```
   *Output*: Saves to `docs/marketing-assets/shells/{scene}-{desktop,phone}.png`. These are ideal for drag-and-dropping into Figma, presentations, or custom marketing landing pages.

3. **High-Retina OG Cards (1200x630, 2x scale for high-DPI social sharing)**
   ```bash
   node docs/marketing/scenes-studio/capture-og.mjs
   ```
   *Output*: Saves to `docs/marketing-assets/og/og-{main,chat,compare,ai}.png`. Stun your audience on Twitter/X, LinkedIn, Slack, and other platforms.

4. **Dynamic GIF Walkthroughs**
   ```bash
   node docs/marketing/scenes-studio/capture-flow.mjs
   ```
   *Output*: Captures `dossier-chat-flow.gif` via `ffmpeg`.

---

*Tip: To capture a single scene (e.g. compare), pass the SCENE env variable:*
```bash
SCENE=compare node docs/marketing/scenes-studio/capture-clean.mjs
```
