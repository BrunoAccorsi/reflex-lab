# Reflex Lab

Reflex Lab is a stateless Next.js workbench for five Jev-powered automation experiments. It uses one typed scenario registry and one evaluation pipeline for choice, score, boolean, confidence gating, and simulated actions.

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

The confidence threshold is intentionally held in client state. Moving it after an evaluation recalculates the automation gate without making another provider request.

## Deployment preparation

`Dockerfile` and `compose.yaml` are included for the later Coolify deployment step. No external routing, credentials, or Coolify settings are changed by this repository.
