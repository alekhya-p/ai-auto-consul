# Overview

Auto-Consul helps Dutch car buyers research a vehicle. Users enter a license plate or chat with the agent and receive a dossier: RDW registry data, AI analysis, and web citations where needed.

## Components in this repository

| Component | Folder | Role |
|-----------|--------|------|
| Web app | `web/` | React PWA - dossier, chat, compare, account |
| Chat agent | `agent-v2/` | Python ADK agent over AG-UI - tools, billing, sessions |
| Functions | `functions/` | Stripe webhook, welcome pass, dev API mocks |
| Docs | `docs/` | Architecture and operations |

## Not in this repository

The REST API (`/v1/*`) and Terraform modules are maintained in a private monorepo. See [what-is-not-included.md](./what-is-not-included.md).

## Architecture

```mermaid
flowchart TB
    subgraph Browser
        Web[web/ React]
    end

    subgraph Firebase
        Auth[Firebase Auth]
        FS[(Firestore)]
        Fns[functions/]
        Host[Firebase Hosting]
    end

    subgraph CloudRun["Cloud Run"]
        Py[agent-v2/]
        API["REST API - private"]
    end

    subgraph External
        Vertex[Vertex AI]
        RDW[RDW Open Data]
        Stripe[Stripe]
    end

    Web --> Auth
    Web --> Host
    Host -->|/v2/*| Py
    Host -->|/v1/*| API
    Py --> Vertex
    Py --> RDW
    Py --> FS
    Fns --> Stripe
    Fns --> FS
```

## Billing flow

Credits and chat turns consume from the pass with the soonest `expiresAt`.

```mermaid
sequenceDiagram
    participant User
    participant Fn as functions/
    participant Agent as agent-v2/
    participant FS as Firestore

    User->>Fn: Sign up
    Fn->>FS: welcome pass (3 chat turns, 1 credit)
    User->>Agent: Chat message
    Agent->>Agent: Auth + chat turn on soonest-expiring pass
    Agent->>Agent: before_model / after_model telemetry
    User->>Fn: Stripe checkout completed
    Fn->>FS: paid pass (only Functions writes passes)
    User->>Agent: Deep analysis
    Agent->>FS: debit 1 credit on soonest-expiring pass
```

## Further reading

- [agent.md](./agent.md) - Python agent
- [frontend.md](./frontend.md) - Chat UI
- [functions.md](./functions.md) - Pass creation
- [infrastructure.md](./infrastructure.md) - GCP setup
