# CLAUDE.md — Side Quest Frontend

Index and operating rules for any Claude Code session in this repo. Understand the existing patterns
before changing them, and **never duplicate business rules the backend owns** — this client renders and
calls; the league's rules live in the API.

## What this is

A Next.js 15 (App Router) / React 19 / TypeScript client for the Side Quest esports league. Two shells
from one codebase — the public **LeagueShell** (route group `(site)`, on `/`) and the **AdminShell**
(`/admin`) — plus an `(auth)` group. It talks to the real backend at `/v1`; server state is TanStack
Query, the auction bid room streams over WebSockets.

## Documentation map

| Read this… | …when you need |
|------------|----------------|
| [README.md](./README.md) | Overview + quick start |
| [docs/architecture.md](./docs/architecture.md) | Shells, server/client split, data flow, auth, realtime |
| [docs/structure.md](./docs/structure.md) | Where code lives (`src/` tree) |
| [docs/tech-stack.md](./docs/tech-stack.md) | Libraries + versions + rationale |
| [docs/routes.md](./docs/routes.md) | Every route → shell → screen component |
| [docs/data-and-state.md](./docs/data-and-state.md) | TanStack Query, axios client, zustand auth, the auction socket |
| [docs/design-system.md](./docs/design-system.md) | Tokens + theming + component idioms |
| [docs/setup.md](./docs/setup.md) | Install, env, build, Docker |
| [docs/testing.md](./docs/testing.md) | The typecheck + build + Playwright gate |
| [docs/troubleshooting.md](./docs/troubleshooting.md) | Common failures → fixes |
| [docs/contributing.md](./docs/contributing.md) | Conventions + "add a screen" + API-change checklist |
| [docs/status.md](./docs/status.md) | What's built, limitations, roadmap |

## Conventions (enforce these)

- **A route is a thin server `page.tsx`** that renders a client screen from
  `components/{sidequest,admin}/screens`. Keep pages thin; put logic in the screen.
- **Styling = inline style objects using `SQ.*` / `FONT.*` tokens** (`components/*/tokens.ts`). No
  CSS-in-JS library, no UI kit. Support light **and** dark (the theme is `data-theme`-driven).
- **Server state via TanStack Query only** — hooks live in `lib/query/hooks.ts` (keys via the `qk`
  factory). Don't fetch in components directly.
- **All API calls go through `lib/api/endpoints.ts`**, typed in `lib/api/types.ts` (mirrors backend
  DTOs). Display-shaping goes in `lib/adapters`, not screens.
- **Business rules belong to the backend.** Don't re-implement league logic client-side; call the API and
  render what it returns.
- Reuse the shared components (`Modal`, `ConfirmModal`, `Avatar`, `StateNote`, `NotificationBell`, …).
  Keep components small; avoid deep nesting.

## API-change checklist

When the backend changes, update in order and verify every consumer:
`types.ts` → `endpoints.ts` → `hooks.ts` → the consuming screen(s) → typecheck + browser-verify.

## Gotchas to remember

- **`NEXT_PUBLIC_API_URL` is baked at BUILD time** into the client bundle — a runtime change won't take;
  rebuild. It must be the browser-reachable backend URL.
- **WebSocket URLs keep the `/v1` context path** (`ws://host/v1/ws/live/...`) — the `wsUrl()` helper
  must not strip it. The auction socket is bidders-only; spectators poll.
- **CORS:** the backend must allowlist the exact frontend origin (`localhost:3000` ≠ a LAN IP).
- **Standalone build** needs `public/` + `.next/static` copied into `.next/standalone` (the `postbuild`
  hook does this); bind `HOSTNAME=0.0.0.0` for LAN/prod.

## Workflow

- **Verify before "done":** `npm run typecheck` && `npm run build`, then drive the affected pages in a
  real browser (Playwright) — loading/empty/error states, dark/light, console/network, refresh
  persistence, permissions. See [docs/testing.md](./docs/testing.md).
- Sibling repo: `../SideQuests arena backend`. The user commits and pushes all code themselves;
  **do not run git commits.**
