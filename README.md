# Jev Lab

Jev Lab is a local-first Next.js workbench for building transparent decision systems with Jev. Six guided capability labs demonstrate Choice, Score, Noul, repeated record evaluation, ranking, and deterministic policy composition. The `/studio` workspace adds visual and JSON authoring for custom browser-local presets.

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

This project expects pnpm to use the global user store, not a repository-local `.pnpm-store`. On macOS, configure it once with `pnpm config set store-dir "$HOME/Library/pnpm/store" --global`, then verify with `pnpm store path`.

Open [http://localhost:3000](http://localhost:3000). To work without an OpenRouter key, set `MOCK_JEV=true` in `.env.local`. With a key, the server calls OpenRouter’s dedicated Decisions endpoint and defaults to `typesafe/jev-1.13`.

Useful checks:

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Run the optional credential-gated live Decisions API check with `pnpm test:live`. It is excluded from the default suite.

Policy weights and thresholds are intentionally held in client state. Editing them after an evaluation recomputes the outcome and trace without making another provider request. Custom definitions are stored in versioned `localStorage`; only the previous compatible result is kept in `sessionStorage`. Live input state is not persisted.

## Workspaces

- `/` contains the six guided capability labs and the Outcome, Answers, Composition, Compare, and API result views.
- `/studio` provides synchronized visual and JSON definition editing, schema errors, templates, and preset save, duplicate, reset, import, and export controls.

## Deployment preparation

`Dockerfile` and `compose.yaml` are included for the later Coolify deployment step. No external routing, credentials, or Coolify settings are changed by this repository.
