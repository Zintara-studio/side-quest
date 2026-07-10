# Project status — where it's at

Feature inventory, honest limitations, and roadmap for the Side Quest frontend — feature-complete for a season, pending a real deploy and a test-suite investment.

**See also:** [./architecture.md](./architecture.md) · [./structure.md](./structure.md) · [./tech-stack.md](./tech-stack.md) · [./routes.md](./routes.md) · [./data-and-state.md](./data-and-state.md) · [./design-system.md](./design-system.md) · [./setup.md](./setup.md) · [./testing.md](./testing.md) · [./troubleshooting.md](./troubleshooting.md) · [../CLAUDE.md](../CLAUDE.md)

---

## TL;DR

The frontend is a **real, integrated client** — the old mock/prototype is fully gone. Every screen reads and writes the live Spring Boot API at `/v1`. Both audiences ship: the **public league** (site) and the **admin control room**. The auction bid room streams over WebSockets; everything else is TanStack Query over an axios client with refresh-token rotation.

What's *not* done is the productionization layer: no automated test suite yet, no live deploy, and a few polling paths that could ride the WebSocket channel instead.

## By the numbers

| Metric | Value | Source |
|---|---|---|
| Total `.ts`/`.tsx` files | **109** | `find src -name '*.ts' -o -name '*.tsx'` |
| Lines of code | **~24,790** | `wc -l` over the above |
| `src/app` (routes) | 46 files | `src/app/**` |
| `src/components` | 50 files | `src/components/**` |
| `src/lib` | 14 files | `src/lib/**` |
| Public screens | **15** | `components/sidequest/screens/` |
| Admin screens | **13** | `components/admin/screens/` |
| Query/mutation hooks | **100** `use*` exports (51 `useMutation`, 3 `useInfiniteQuery`) | `lib/query/hooks.ts` |
| API domain groups | **14** | `lib/api/endpoints.ts` |
| Automated test files | **0** | — see [Limitations](#known-limitations) |

Stack: **Next.js 15** (App Router) · **React 19** · **TypeScript 5.6** · **TanStack Query v5** · **axios** · **zustand** · `react-markdown` + `remark-gfm` · `lucide-react` · Tailwind + typed design tokens. `package.json` name is `esports-arena`. Deliberately absent: framer-motion, recharts, radix, react-hook-form, zod, jose.

---

## What's built

### Public league — `(site)` shell (`LeagueShell`) — DONE

- [x] **Home** (`/`) — standings, upcoming matches, league pulse. Adapts backend DTOs via `lib/adapters/league.ts`.
- [x] **Games** (`/games`) — game catalog with **public per-game scoring** rules on display.
- [x] **Franchises** (`/franchises`) + **detail** (`/franchise/[id]`) — roster, branding, match history.
- [x] **Players** (`/players`) + **profile** (`/player/[id]`) — **per-field privacy** (respects what each player exposed), plus a self-service **profile editor** (`profile-editor.tsx`) with client-side image compression on upload.
- [x] **Matches** — archive (`/match`, infinite scroll) + **detail** (`/match/[id]`) + **live room** (lineups, leaderboard, room messages) + **dispute-result** flow (`disputesApi.create` / `mine`).
- [x] **Announcements** (`/announcements`) — markdown feed rendered through `react-markdown` + `remark-gfm`.
- [x] **Auction** (`/auction`) — **spectate** (polling) and, for participating owners/managers, the **bid room** (`auction-bid.tsx`) streaming over WebSockets.
- [x] **Rules** (`/rules`), **Notifications** (`/notifications`) with a header bell (`notification-bell.tsx`).
- [x] **Register / withdraw** (`/register`) — apply to a season, squad invites, self-service withdrawal.
- [x] **My Team** (`/my/franchise`) + **lineups** (`lineup-editor.tsx`) + **my auction** (`/my/franchise/auction`) + **my registrations** (`/my/registrations`).

### Admin control room — `/admin/*` shell (`AdminShell`) — DONE

- [x] **Overview** (`/admin`) — KPIs, tasks, activity via `lib/adapters/admin.ts`.
- [x] **Matches** — CRUD, **result entry** (`/admin/matches/result`), per-match room (`/admin/match/[id]`), lineups, **void / delete** (incl. completed matches).
- [x] **Auction operator console** (`/admin/auction`) — the full lifecycle: `lock-pool`, `open-hall`, `start`, `pause`/`resume`, `nominate`, `assign`, `reauction`, `unsold`, `funds`, `finalize`, `complete`, `cancel` (all in `auctionsApi`).
- [x] **Franchises** (list + `/admin/franchise/[id]`) — branding, owner/manager assignment, discard/restore, create-from-proposal.
- [x] **Players** (list + `/admin/player/[id]`) — status, roster tags, usernames.
- [x] **Games + scoring** (`/admin/games`) — edit scoring config.
- [x] **Announcements + edit**, **Disputes** (`/admin/disputes`, resolve flow), **Registrations**, **Settings**, **History** (seasons: start/finish, all-time standings), **Notifications**, **Profile**.

### Auth — `(auth)` shell — DONE

- [x] **Login**, **Signup**, **Verify-email** (OTP), **Forgot-password**, plus **Google sign-in** (`authApi.google`, gated on `NEXT_PUBLIC_GOOGLE_CLIENT_ID`).

---

## Integration highlights

**Real backend, no mock.** Every screen is a thin server `page.tsx` rendering a client screen from `components/{sidequest,admin}/screens`, fed by TanStack Query hooks → the axios client → the backend `/v1`. There is no mock data layer left.

**Refresh-token rotation** (`lib/api/client.ts`). The access token lives in memory only; the refresh token is persisted to `localStorage` (zustand `persist`). A request interceptor mints the access token *before* firing on a cold reload (rather than eating a 401), and a response interceptor rotates + retries once on a 401. A single in-flight refresh is shared across concurrent callers to avoid stampedes.

**WebSocket auction updates** (`lib/query/use-auction-socket.ts`). Bidders and admins subscribe to `/ws/live/auctions/{id}?token=…`; each `auction.update` frame is written straight into the same `["auctions", id]` query cache that polling fills, so the board re-renders with **no extra request**. Spectators stay on the poll (never call the hook with `enabled`). The socket heartbeats every 25s and reconnects with capped exponential backoff (max 15s), re-reading the freshest token each attempt since tokens rotate.

**Query key discipline** (`lib/query/hooks.ts`). A `qk` query-key factory plus tiered stale times — `STALE_STATIC` (10 min, catalogs), `STALE_SEMI` (3 min, directories/standings), `STALE_LIST` (1 min, filtered lists + admin badges) — over a client default of `staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`.

**Warm-paper theme** (`components/sidequest/tokens.ts`, "Broadcast HUD"). Typed design tokens (`SQ.*` colors, `FONT.*`) exposed as CSS custom properties; light (warm paper) / dark (warm espresso) flips via `data-theme` on the root. Hand-rolled — **not a UI kit**. Admin re-exports the shared tokens. Fonts come through `next/font` (Archivo / Archivo Black / Spline Sans Mono → `--font-sq-*`).

**Standalone build + Docker.** `next.config.mjs` sets `output: "standalone"`; a `postbuild` hook copies `public` and `.next/static` into `.next/standalone`. `Dockerfile` is a `node:20-alpine` multi-stage build that takes `NEXT_PUBLIC_API_URL` as a **build arg** (see below).

---

## Known limitations

Honest gaps, roughly in priority order.

1. **No automated unit/component/E2E suite.** The quality gate is `npm run typecheck` (`tsc --noEmit`) + `npm run build` (real compile + route gate) + **Playwright** browser E2E driven *ad hoc* during development. There are no committed test files. This is the single biggest debt before a real deploy — a table-driven hook/adapter suite and a scripted Playwright happy-path pass are the obvious next investment. See [./testing.md](./testing.md).

2. **`NEXT_PUBLIC_API_URL` is build-time only.** It is inlined into the client bundle at `next build`, so it must be the **browser-reachable** API origin and keep the `/v1` context path (WebSocket URLs derive from it — `http→ws`, `https→wss`, *including* `/v1`). A production build **fails fast** if it's missing, invalid, or non-HTTPS on a non-localhost host (guard in `client.ts`). Consequence: one image cannot be re-pointed at a different backend at runtime; you rebuild per environment (the Docker build arg exists for exactly this).

3. **Some reads still poll where a socket exists.** Auction *spectators* and a few live surfaces poll on `STALE_LIST` cadence. The `auction.update` WS channel already exists and could carry more of these; broadening it would cut request volume during a live auction.

4. **Accessibility / mobile passes are ongoing.** The theme and layouts are responsive and dual-mode (light/dark), but a systematic a11y audit (focus order, ARIA on the custom `searchable-select` / modals, keyboard paths through the bid room) and a full small-screen overflow sweep are not yet complete.

5. **CORS + origin coupling.** The backend CORS allowlist must include the frontend origin, and media/`/media/{id}` references resolve against the API origin via `mediaSrc` — so a split-origin deploy needs both sides configured in lockstep.

---

## Roadmap

- [ ] **Test suite**: adapter/hook unit tests + a scripted Playwright E2E covering login → register → auction → result entry.
- [ ] **Real deploy**: containerized frontend behind the existing backend, HTTPS enforced, `NEXT_PUBLIC_API_URL` pinned per environment.
- [ ] **Move remaining polls onto the WS channel** where a live surface justifies it.
- [ ] **a11y + mobile hardening** pass across modals, the searchable select, and the bid room.

---

## Verify locally

```bash
npm run typecheck                 # tsc --noEmit
npm run build                     # compile + route gate; runs the postbuild copy
npm run start:standalone          # node .next/standalone/server.js  (HOSTNAME=0.0.0.0 for LAN/prod)

# Docker: API origin is a BUILD ARG (inlined into the bundle)
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080/v1 -t sidequest-frontend .
```

Expects the backend at `http://localhost:8080/v1` and the frontend on `:3000`. This doc is **living** — keep the counts in sync when the surface changes.
