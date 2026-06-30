# Firebase Functions (Gen 2)

Event-driven glue: **Stripe webhook**, **welcome pass on signup**, and dev-only API mocks.

## Functions

| Export | Purpose |
|--------|---------|
| `stripeWebhook` | Verify Stripe signature → write pass → set `tier: pass` claim |
| `grantWelcomePassOnCreate` | Free pass on signup (1 credit, 3 chat turns, 7 days) |
| `rdwMock` | Dev RDW proxy |
| `autotelexMock` | Dev Autotelex proxy |

See [docs/functions.md](../docs/functions.md) for flow diagrams.

## Local development

```bash
cd functions
npm install
npm run build
firebase emulators:start --only functions,firestore,auth
```

Mock URLs (replace project id):

```
http://127.0.0.1:5001/PROJECT_ID/europe-west4/rdwMock
http://127.0.0.1:5001/PROJECT_ID/europe-west4/autotelexMock
```

## Stripe webhook smoke test

```bash
stripe listen --forward-to \
  http://127.0.0.1:5001/PROJECT_ID/europe-west4/stripeWebhook

stripe trigger checkout.session.completed \
  --add checkout_session:metadata.uid=test_uid \
  --add checkout_session:metadata.pack=SINGLE
```

## Firestore rules tests

```bash
npm run test:rules
```

## Layout

```
functions/
├── src/
│   ├── index.ts
│   ├── welcome.ts
│   ├── stripe/webhook.ts
│   ├── lib/admin.ts
│   └── mocks/
├── firestore.rules
└── package.json
```

Do **not** deploy `rdwMock` / `autotelexMock` to production.
