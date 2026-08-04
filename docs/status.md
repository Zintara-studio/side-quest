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
| Total `.ts`/`.tsx` files | **120** | `find src -name '*.ts' -o -name '*.tsx'` |
| Lines of code | **~27,720** | `wc -l` over the above |
| `src/app` (routes) | 50 files | `src/app/**` |
| `src/components` | 55 files | `src/components/**` |
| `src/lib` | 17 files | `src/lib/**` |
| Public screens | **17** | `components/sidequest/screens/` |
| Admin screens | **14** | `components/admin/screens/` |
| Query/mutation hooks | **111** `use*` exports (58 `useMutation`) | `lib/query/hooks.ts` |
| API domain groups | **14** | `lib/api/endpoints.ts` |
| Automated test files | **0** | — see [Limitations](#known-limitations) |

Stack: **Next.js 15** (App Router) · **React 19** · **TypeScript 5.6** · **TanStack Query v5** · **axios** · **zustand** · `react-markdown` + `remark-gfm` · `lucide-react` · Tailwind + typed design tokens. `package.json` name is `esports-arena`. Deliberately absent: framer-motion, recharts, radix, react-hook-form, zod, jose.

---

## What's built

### Public league — `(site)` shell (`LeagueShell`) — DONE

- [x] **Home** (`/`) — standings, upcoming matches, league pulse. Adapts backend DTOs via `lib/adapters/league.ts`.
- [x] **Games** (`/games`) — game catalog with **public per-game scoring** rules on display, plus a **"▲ Vote for your games"** panel (`VotePanel`): any signed-in user upvotes titles and each game's popularity becomes the share of voters who back it (vote-driven, no longer admin-set).
- [x] **Franchises** (`/franchises`) + **detail** (`/franchise/[id]`, URL shows the tag, e.g. `/franchise/RXG`) — roster, branding, match history. **Banners render 4:1** (matches the crop) so nothing is cut.
- [x] **Players** (`/players`) + **profile** (`/player/[id]`, URL shows the gamerTag) — **per-field privacy** (respects what each player exposed) + the **account email surfaced to privileged viewers**, plus a self-service **profile editor** (`profile-editor.tsx`). Editing is **owner-only** (admins/franchise leads can view every field but not edit it). Avatar/logo/banner uploads go through the **interactive image cropper** (`image-cropper.tsx`).
- [x] **Matches** — archive (`/match`, infinite scroll) + **detail** (`/match/[id]`, URL shows the slug) + **live room** (lineups, leaderboard, room messages) + **dispute-result** flow (`disputesApi.create` / `mine`).
- [x] **Announcements** (`/announcements`) + **read page** (`/announcements/[id]`, URL shows the shortCode) — markdown feed rendered through `react-markdown` + `remark-gfm` (no `rehype-raw`, so raw HTML is escaped).

  > The `[id]` dynamic segments now receive **either a slug or a UUID** — the backend resolves both, so old UUID links still work. Route folder names are unchanged; only the value in the URL is prettier.
- [x] **Auction** (`/auction`) — **spectate** (polling) and, for participating owners/managers, the **bid room** (`auction-bid.tsx`) streaming over WebSockets. When no auction is scheduled, the page shows the **standing pool** of registered players (`NoAuctionPool` via `useAuctionPool` / `GET /auctions/pool`) instead of a dead end.
- [x] **Rules** (`/rules`), **Notifications** (`/notifications`) with a header bell (`notification-bell.tsx`). The nav-bar identity now shows the signed-in user's **real avatar**.
- [x] **Register / withdraw** (`/register`) — apply to a season, squad invites, self-service withdrawal.
- [x] **My Team** (`/my/franchise`) + **lineups** (`lineup-editor.tsx`) + **branding editor** (logo + banner, cropper-fed) + **my auction** (`/my/franchise/auction`) + **my registrations** (`/my/registrations`).
- [x] **Onboarding** (`/onboarding`, standalone) — a first-time Google account picks its **username** (with live availability) + optional profile before entering the app; an `OnboardingGuard` (mounted in `providers.tsx`) holds such accounts here until done.

### Admin control room — `/admin/*` shell (`AdminShell`) — DONE

- [x] **Overview** (`/admin`) — KPIs, tasks, and **Recent Activity** via `lib/adapters/admin.ts`. Each audit row now reads as a **definitive statement** (an `ACTION_LABELS` map turns the action code into "Game settings updated" etc., with the raw detail + actor on a muted line) inside a scrollable panel.
- [x] **Matches** — CRUD, **result entry** (`/admin/matches/result`), per-match room (`/admin/match/[id]`), lineups, **void / delete** (incl. completed matches).
- [x] **Auction operator console** (`/admin/auction`) — the full lifecycle: `lock-pool`, `open-hall`, `start`, `pause`/`resume`, `nominate`, `assign`, `reauction`, `unsold`, `funds`, `finalize`, `complete`, `cancel` (all in `auctionsApi`). The create form shows the **registered pool** before an auction exists.
- [x] **Franchises** (list + `/admin/franchise/[id]`) — branding, owner/manager assignment, discard/restore, create-from-proposal. **Super-admin-only.**
- [x] **Players** (list + `/admin/player/[id]`) — status, roster tags, usernames. List avatars resolve to real images.
- [x] **Games** (`/admin/games`) — add games + edit scoring config. **Popularity is no longer editable here** (it's community-vote-driven).
- [x] **Admins** (`/admin/team`, super-admin-only) — appoint/revoke, each with a confirmation modal; the appoint picker lists the full player set.
- [x] **Announcements + edit**, **Disputes** (`/admin/disputes`, resolve flow), **Registrations**, **Settings**, **History** (seasons: start/finish, all-time standings), **Notifications**, **Profile** (with a **league-admin avatar** uploader for accounts that have no player).
- [x] **Responsive** — below `860px` the sidebar collapses to a **hamburger drawer** (`use-media-query.ts`, the app's first breakpoint hook); tables scroll and grids reflow.

### Auth — `(auth)` shell — DONE

- [x] **Login**, **Signup** (with a **live username-availability** check + immutable-handle notice; no-spaces / case-insensitive rules mirrored from the backend in `lib/username.ts`), **Verify-email** (OTP), **Forgot-password**, plus **Google sign-in** — a **custom theme-token button** with the real GIS button rendered transparent on top (`SocialRow` in `auth-ui.tsx`), gated on `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. A first-time Google account is routed to **`/onboarding`**.

---

## Integration highlights

**Real backend, no mock.** Every screen is a thin server `page.tsx` rendering a client screen from `components/{sidequest,admin}/screens`, fed by TanStack Query hooks → the axios client → the backend `/v1`. There is no mock data layer left.

**Refresh-token rotation** (`lib/api/client.ts`). The access token lives in memory only; the refresh token is persisted to `localStorage` (zustand `persist`). A request interceptor mints the access token *before* firing on a cold reload (rather than eating a 401), and a response interceptor rotates + retries once on a 401. A single in-flight refresh is shared across concurrent callers to avoid stampedes.

**WebSocket auction updates** (`lib/query/use-auction-socket.ts`). Bidders and admins subscribe to `/ws/live/auctions/{id}?token=…`; each `auction.update` frame is written straight into the same `["auctions", id]` query cache that polling fills, so the board re-renders with **no extra request**. Spectators stay on the poll (never call the hook with `enabled`). The socket heartbeats every 25s and reconnects with capped exponential backoff (max 15s), re-reading the freshest token each attempt since tokens rotate.

**Query key discipline** (`lib/query/hooks.ts`). A `qk` query-key factory plus tiered stale times — `STALE_STATIC` (10 min, catalogs), `STALE_SEMI` (3 min, directories/standings), `STALE_LIST` (1 min, filtered lists + admin badges) — over a client default of `staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`.

**Warm-paper theme** (`components/sidequest/tokens.ts`, "Broadcast HUD"). Typed design tokens (`SQ.*` colors, `FONT.*`) exposed as CSS custom properties; light (warm paper) / dark (warm espresso) flips via `data-theme` on the root. Hand-rolled — **not a UI kit**. Admin re-exports the shared tokens. Fonts come through `next/font` (Archivo / Archivo Black / Spline Sans Mono → `--font-sq-*`).

**Pretty URLs** (`lib/routes.ts`). Public links use human slugs — `/player/<gamerTag>`, `/franchise/<tag>`, `/match/<game-date-hex>`, `/announcements/<shortCode>` — via `playerHref` / `franchiseHref` / `matchHref` / `announcementHref` (all `encodeURIComponent`). The backend resolves either the slug **or** the raw UUID, so old stored links (e.g. a notification's `/match/{uuid}`) still work. Owner-detection keys off the *loaded* entity's id, never the route param (a slug never equals a UUID).

**Client-side image cropping** (`components/sidequest/image-cropper.tsx` + `lib/image.ts`). Avatar/logo/banner uploads open an aspect-locked cropper (pan + zoom, WYSIWYG). Apply renders the chosen region to a canvas at the kind's target size (`CROP_DIMS` — avatar/logo 1:1, banner 4:1 → 1600×400) and steps quality down to fit the `/media` byte cap, then uploads the already-cropped image. Because the stored image already matches the display box, no display ever re-crops — banners show in full at a consistent 4:1.

**Standalone build + Docker.** `next.config.mjs` sets `output: "standalone"`; a `postbuild` hook copies `public` and `.next/static` into `.next/standalone`. `Dockerfile` is a `node:20-alpine` multi-stage build that takes `NEXT_PUBLIC_API_URL` as a **build arg** (see below).

---

## Known limitations

Honest gaps, roughly in priority order.

1. **No automated unit/component/E2E suite.** The quality gate is `npm run typecheck` (`tsc --noEmit`) + `npm run build` (real compile + route gate) + **Playwright** browser E2E driven *ad hoc* during development. There are no committed test files. A 33-scenario adversarial + happy-path pass was run and written up in the root `QA_REPORT.md` (authz guards, slug 404s, private-data leakage, XSS on bios + announcement markdown — all clean), but it was a one-off, not a committed suite. This remains the single biggest debt before a real deploy. See [./testing.md](./testing.md).

2. **`NEXT_PUBLIC_API_URL` is build-time only.** It is inlined into the client bundle at `next build`, so it must be the **browser-reachable** API origin and keep the `/v1` context path (WebSocket URLs derive from it — `http→ws`, `https→wss`, *including* `/v1`). A production build **fails fast** if it's missing, invalid, or non-HTTPS on a non-localhost host (guard in `client.ts`). Consequence: one image cannot be re-pointed at a different backend at runtime; you rebuild per environment (the Docker build arg exists for exactly this).

3. **Some reads still poll where a socket exists.** Auction *spectators* and a few live surfaces poll on `STALE_LIST` cadence. The `auction.update` WS channel already exists and could carry more of these; broadening it would cut request volume during a live auction.

4. **Accessibility / mobile passes are ongoing.** The theme and layouts are responsive and dual-mode (light/dark), and the admin shell now collapses to a hamburger drawer under 860px — but two heavy admin screens (**`auction.tsx`** fixed 2-col grid, **`result.tsx`** fixed-width table rows) can still overflow on a phone and aren't wrapped in scroll containers yet. A systematic a11y audit (focus order, ARIA on the custom `searchable-select` / modals, keyboard paths through the bid room + image cropper) is also still pending.

5. **Google onboarding can't be browser-tested end-to-end here.** The `/onboarding` flow (first-time Google account claims a username) needs a real Google `id_token` + session, which the local/Playwright env can't mint. The backend `POST /players/onboard` + the `OnboardingGuard` route gate are verified; the form itself is only manually exercisable with a real Google client. Likewise the custom Google button is hidden in dev (blank `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) — it's only visible after a deploy with the real client id.

6. **CORS + origin coupling.** The backend CORS allowlist must include the frontend origin, and media/`/media/{id}` references resolve against the API origin via `mediaSrc` — so a split-origin deploy needs both sides configured in lockstep.

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
