# Devocional Picgama Agents Guide

## Project Shape

- Monorepo with Turborepo and Yarn Workspaces.
- `apps/api`: Node.js + TypeScript API.
- `apps/ui`: React + Vite + Mantine admin panel.
- `packages/shared`: shared TypeScript types.

## Local Development

- Install: `yarn install`
- Run all apps: `yarn dev`
- Run API only: `yarn dev:api`
- Run UI only: `yarn dev:ui`

## Production

- Main runtime: Docker Compose.
- Start stack: `docker compose up -d --build`
- CasaOS: see `CASAOS.md`
- API health endpoint: `/health`

## API Notes

- ORM: Prisma with SQLite.
- Prisma schema: `apps/api/prisma/schema.prisma`
- Use `yarn workspace @devocional/api prisma:generate` after schema changes.

## UI Notes

- Dark-first admin interface.
- API calls go through `/api` path in browser.
- In production, Nginx proxies `/api/*` to the API container.

## Claude Code commands (`.claude/commands/`)

- `/write-devotional`: devotional podcast scripts. **Mandatory Notion** publish/sync to database Devocional at the end of the flow — Fase 8 in the command.
- `/update-skills`: update skills and related docs from feedback; does **not** change `docs/devocionais/`. Keeps `.claude/commands/` and `.cursor/skills/` in sync.

## Cursor skills (`.cursor/skills/`)

- `write-devotional`: same as the Claude command above; see `.cursor/skills/write-devotional/`.
- `update-skills`: same as the Claude command above.