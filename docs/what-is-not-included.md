# What is not in this repository

The open-source repo is scoped to **frontend**, **Python agent**, and **Firebase Functions**. A separate private monorepo holds the rest.

## Included here ✓

| Piece | Folder |
|-------|--------|
| React web app | `web/` |
| Python ADK + AG-UI agent | `agent-v2/` |
| Stripe webhook + welcome pass + dev mocks | `functions/` |

## Not included - private monorepo only

### REST API (`/v1/*`)

The production dossier, checkout, upload, and lookup endpoints run as a separate Cloud Run service in the private repo:

| Responsibility | Examples |
|--------------|----------|
| REST API | `GET /v1/voertuig/:plate`, `/kosten`, `/marktaanbod` |
| Checkout creation | `POST /v1/passes/checkout` → Stripe Checkout Session |
| Uploads | Signed Cloud Storage URLs |
| OpenAPI | `/v3/api-docs` → TypeScript types in `web/` |

The web dossier pages call `/v1/*`. Use `npm run dev:mock` in `web/` to develop the UI without that service.

### Terraform (`infra/terraform/`)

GCP infrastructure as code:

- GCP project + Firebase enablement
- Firestore, Hosting, Identity Platform
- Cloud Run services (REST API + Python agent)
- Secret Manager (RDW, Autotelex, Stripe, API keys)
- IAM bindings, reCAPTCHA Enterprise (App Check)
- Artifact Registry

Documented with diagrams in [infrastructure.md](./infrastructure.md) - no `.tf` files in this repo.

### Why keep these private

- Terraform state and production secrets
- Autotelex paid API integration
- Full PCI-adjacent Stripe checkout surface on the REST API
- Avoid maintaining duplicate infra in public git

## How open-source pieces connect in production

```
Firebase Hosting
  ├── /v1/*  →  REST API Cloud Run   (private)
  ├── /v2/*  →  Python agent-v2      (this repo)
  └── /**    →  web/ static build    (this repo)

Firestore  ←  agent-v2 reads passes / writes sessions
           ←  functions writes passes (Stripe + welcome)
           ←  REST API reads/writes dossiers, cache

Stripe webhook  →  functions/stripeWebhook only
Checkout URL    →  REST API creates session, user pays, webhook credits pass
```

## Recreating the full stack

You would need your own GCP + Firebase project, equivalent Terraform (or manual setup), a `/v1` API or local mocks, and Stripe test configuration.

This repository runs the web app, Python agent, and Functions. The `/v1` API is replaced by `web/mocks/` for local UI development.
