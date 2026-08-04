# Project structure & layout

Where every piece of the Side Quest frontend lives, and the conventions that keep it consistent. This is a living reference — a new developer should be able to onboard from it.

**See also:** [./architecture.md](./architecture.md) · [./routes.md](./routes.md) · [./data-and-state.md](./data-and-state.md) · [./design-system.md](./design-system.md) · [./tech-stack.md](./tech-stack.md) · [../CLAUDE.md](../CLAUDE.md) · [../README.md](../README.md)

---

## At a glance

| | |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5 |
| package.json name | `esports-arena` (private, v0.1.0) |
| Source files | 120 `.ts`/`.tsx` under `src/`, ~27,700 LOC |
| Split | `src/app` (48 files) · `src/components` (55) · `src/lib` (17) |
| Runtime deps | `@tanstack/react-query`, `axios`, `zustand`, `react-markdown` + `remark-gfm`, `lucide-react`, `clsx`, `tailwind-merge` |
| Dev deps | `tailwindcss`, `postcss`, `autoprefixer`, `eslint` + `eslint-config-next`, `typescript` |
| Build output | `output: "standalone"` (`.next/standalone/server.js`), `reactStrictMode` |

There is **no** `framer-motion`, `recharts`, `radix`, `react-hook-form`, `zod`, or `jose` — the old mock prototype was fully replaced. The current app talks to the real Spring Boot backend at `/v1`. Styling is hand-rolled inline style objects over typed tokens (no UI kit); forms and validation are plain React.

### Scripts (`package.json`)

```jsonc
"dev":               "next dev",
"build":             "next build",
"postbuild":         "cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static",
"start":             "next start",
"start:standalone":  "node .next/standalone/server.js",
"lint":              "next lint",
"typecheck":         "tsc --noEmit"
```

`postbuild` is load-bearing for the standalone artifact: Next's `standalone` output does **not** copy `public/` or `.next/static/` into `.next/standalone`, so this hook does it (mirrored in the `Dockerfile`).

---

## Top-level tree

```
SideQuests arena frontend/
├── src/
│   ├── app/          # App Router: route groups + thin page.tsx wrappers + layouts
│   ├── components/   # sidequest/ (public league) + admin/ (control room)
│   └── lib/          # api, query, auth, adapters + assorted helpers
├── public/
├── docs/             # you are here
├── Dockerfile        # Next standalone; NEXT_PUBLIC_API_URL as a build-arg
├── next.config.mjs   # output "standalone", reactStrictMode, devIndicators off
├── tailwind.config.ts / postcss.config.mjs
├── tsconfig.json     # "@/*" → src/*
├── .env.example / .env.local
├── CLAUDE.md / README.md
```

`next.config.mjs` also sets `experimental.optimizePackageImports: ["lucide-react"]` (tree-shake icon imports) and `devIndicators: false`.

---

## `src/app` — routing (48 files)

The App Router. **Every route is a thin server `page.tsx`** that renders one client screen component; all the real logic lives in the screen. There are three route groups plus the admin subtree, each with its own layout that mounts a shell.

```
app/
├── layout.tsx              # root: html/body, next/font vars, pre-paint theme script, <Providers>
├── providers.tsx           # QueryClientProvider (staleTime 30s) + AuthProvider + OnboardingGuard
├── globals.css             # :root / [data-theme="dark"] token blocks, base styles, .sq-field, .admin-scope
├── not-found.tsx           # themed 404 ("OFF THE MAP")
├── onboarding/page.tsx     # /onboarding → OnboardingScreen (standalone, no shell; SSO first-run)
│
├── (auth)/                 # AuthLayout — centered card, no shell
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── verify-email/page.tsx
│   └── forgot-password/page.tsx
│
├── (site)/                 # LeagueLayout → <LeagueShell> (the public league)
│   ├── layout.tsx
│   ├── page.tsx            # /            → HomeScreen
│   ├── games/page.tsx
│   ├── franchises/page.tsx
│   ├── franchise/page.tsx  · franchise/[id]/page.tsx
│   ├── players/page.tsx
│   ├── player/page.tsx     · player/[id]/page.tsx
│   ├── match/page.tsx      · match/[id]/page.tsx
│   ├── announcements/page.tsx · announcements/[id]/page.tsx   # feed + read page
│   ├── auction/page.tsx
│   ├── rules/page.tsx
│   ├── notifications/page.tsx
│   ├── register/page.tsx
│   └── my/
│       ├── franchise/page.tsx
│       ├── franchise/auction/page.tsx
│       └── registrations/page.tsx
│
└── admin/                  # AdminLayout → <AdminShell> (the control room)
    ├── layout.tsx
    ├── page.tsx            # /admin       → OverviewScreen
    ├── matches/page.tsx    · matches/result/page.tsx · match/[id]/page.tsx
    ├── auction/page.tsx
    ├── franchises/page.tsx · franchise/[id]/page.tsx
    ├── players/page.tsx    · player/[id]/page.tsx
    ├── games/page.tsx
    ├── announcements/page.tsx
    ├── disputes/page.tsx
    ├── registrations/page.tsx
    ├── settings/page.tsx
    ├── history/page.tsx
    ├── notifications/page.tsx
    └── profile/page.tsx
```

Route groups `(auth)` and `(site)` don't add URL segments — they only scope a layout. `/admin/*` is a real path prefix.

### The thin-page convention

A page file does exactly two things: set `metadata` and render its screen. Dynamic segments are `await`ed (Next 15 makes `params` a `Promise`) and passed as a prop:

```tsx
// app/(site)/player/[id]/page.tsx
export const metadata: Metadata = { title: "Player" };
export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerScreen id={id} />;
}
```

The non-`[id]` variants (`franchise/`, `player/`, `match/`) render the **same** screen without an id, letting it fall back to a `?id=`/`?code=` query param — so both `/player/[id]` and `/player?id=…` resolve.

### Root layout responsibilities

`app/layout.tsx` wires the three `next/font/google` families to CSS variables — **Archivo** (`--font-sq-sans`), **Archivo Black** (`--font-sq-display`), **Spline Sans Mono** (`--font-sq-mono`) — and injects an inline script that stamps `document.documentElement.dataset.theme` from `localStorage`/`prefers-color-scheme` **before paint** (no theme flash). `providers.tsx` mounts the singleton `QueryClient` (default `staleTime: 30_000`, `retry: 1`, no refetch-on-focus) and the `AuthProvider`.

---

## `src/components` — UI (55 files)

Two feature areas, each with its own shell, a `screens/` folder (one component per route), local shared bits, and a `tokens.ts`. **Admin re-exports the sidequest tokens** — there is one design system.

### `components/sidequest/` — the public league

```
sidequest/
├── league-shell.tsx        # top-nav shell: nav links, auth menu, theme toggle, notification bell
├── league-title.tsx        # eyebrow + oversized display title used across screens
├── season-code.tsx         # live current-season code (e.g. "S05") from the API
├── tokens.ts               # SQ.* colors + FONT.* + status/tag helpers → CSS custom properties
│
├── modal.tsx               # focus-trapped, esc-to-close base dialog (supports stacking)
├── confirm-modal.tsx       # themed confirm/cancel over Modal (replaces window.confirm)
├── avatar.tsx              # image (via mediaSrc) or gradient fallback — now used by BOTH nav shells
├── image-cropper.tsx       # interactive pan/zoom aspect-locked cropper (WYSIWYG) used by every upload
├── onboarding-guard.tsx    # app-wide gate: forces onboardingRequired accounts to /onboarding
├── state-note.tsx          # inline loading / empty / error placeholder (tone: muted | error)
├── notification-bell.tsx   # header bell w/ unread badge (authed only)
├── searchable-select.tsx   # typeahead single-select
├── lineup-editor.tsx       # match-lineup picker dialog
├── markdown.tsx            # react-markdown + remark-gfm, themed renderers (no rehype-raw → XSS-safe)
│
├── auth/                   # login-form, signup-form, verify-email-form, forgot-form, auth-ui (custom Google button)
└── screens/                # 17 route screens (below)
```

**`sidequest/screens/` (17):**
`home` · `games` · `franchises` · `franchise` · `players` · `player` · `match` · `announcements` · `announcement-detail` · `auction-bid` · `rules` · `notifications` · `onboarding` · `register` · `my-franchise` · `my-registrations` · `profile-editor`

`auction-bid.tsx` is the live bid room (WebSocket for participants, polling for spectators) **and** the
no-auction standing-pool view (`NoAuctionPool`); `onboarding.tsx` is the SSO first-run account setup;
`announcement-detail.tsx` is the single-announcement read page; `profile-editor.tsx` backs the account/profile
flows. `games.tsx` also hosts the "Vote for your games" `VotePanel`.

### `components/admin/` — the control room

```
admin/
├── admin-shell.tsx         # sidebar shell: admin nav, guarded to ADMIN, .admin-scope scrollbars
├── screen-header.tsx       # eyebrow + title + actions header for admin screens
├── table-scroll.tsx        # horizontally-scrollable bordered table frame w/ min-width track
├── toggle.tsx              # 38×22 on/off switch (button or static indicator)
├── tokens.ts               # `export * from "@/components/sidequest/tokens"` (re-export)
└── screens/                # 14 route screens (below)
```

**`admin/screens/` (14):**
`overview` · `matches` · `result` · `disputes` · `franchises` · `games` · `history` · `players` · `profile` · `registrations` · `settings` · `announcements` · `auction` · `team` (super-admin-only "Admins" — appoint/revoke)

(`matches/result/page.tsx` → `result.tsx`; `admin/page.tsx` → `overview.tsx`.)

### Where shared UI lives

Reusable primitives live at the top of `components/sidequest/` (not in `screens/`) and are imported by both league and admin surfaces: `Modal`, `ConfirmModal`, `Avatar`, `StateNote`, `NotificationBell`, `SearchableSelect`, `LineupEditor`, `Markdown`, `LeagueTitle`, `SeasonCode`. Admin adds three of its own layout helpers (`ScreenHeader`, `TableScroll`, `Toggle`). Everything styles itself with inline `style={{ ... }}` objects referencing `SQ.*`/`FONT.*` — there is no CSS-in-JS library and no component kit.

---

## `src/lib` — data, state & helpers (17 files)

```
lib/
├── api/
│   ├── client.ts           # axios instance + interceptors + wsUrl/mediaSrc + build-time URL guard
│   ├── endpoints.ts        # per-domain API functions (450 LOC)
│   └── types.ts            # shared TS types mirroring backend DTOs (1022 LOC)
├── query/
│   ├── hooks.ts            # ~all TanStack Query hooks + `qk` key factory + per-domain staleTimes (1097 LOC)
│   └── use-auction-socket.ts   # WS hook: writes auction.update frames into ['auctions', id] cache
├── auth/
│   ├── store.ts            # zustand session store (tokens/user/gamerTag/avatarUrl/onboardingRequired)
│   └── context.tsx         # React AuthProvider / useAuth over the store (+ refreshUser)
├── adapters/
│   ├── league.ts           # backend DTO → public display shapes (150 LOC)
│   └── admin.ts            # backend DTO → admin display shapes incl. ACTION_LABELS (207 LOC)
├── theme.tsx               # useTheme() light/dark controller (data-theme)
├── image.ts                # client-side image compress + interactive-crop primitives (avatar/logo/banner)
├── routes.ts               # pretty-URL helpers (player/franchise/match/announcement/register hrefs)
├── username.ts             # client mirror of the backend UsernameRules (instant signup/onboarding feedback)
├── use-media-query.ts      # SSR-safe matchMedia hook (drives the responsive admin drawer)
├── ranks.ts                # per-game competitive rank presets (valorant, bgmi, cs2, …)
├── nav.ts                  # safeNextPath() — same-origin ?next= redirect guard
└── utils.ts                # cn() = twMerge(clsx(...))
```

### `api/client.ts`

A single `axios` instance (`api`) plus a bare `refreshClient` (no interceptors, avoids refresh recursion):

- **Request interceptor** attaches `Authorization: Bearer <access token>` from the zustand store; on a fresh load with only a refresh token it mints the access token first (single shared in-flight refresh) instead of eating a 401.
- **Response interceptor** does refresh-token rotation: on a `401`, rotate once via `POST /auth/refresh`, retry the original request; on failure it clears the session.
- **`wsUrl(path)`** maps `http→ws`/`https→wss` and **keeps the `/v1` context path** (WS endpoints live under it, e.g. `/v1/ws/live/auctions/{id}`).
- **`mediaSrc(url)`** resolves stored `/media/{id}` refs to the API origin; passes through absolute/`data:` URLs.
- **`apiErrorMessage(err)`** normalizes the backend's `{message|error|detail}` envelope into a string.
- A **build-time guard** throws during `next build` if `NEXT_PUBLIC_API_URL` is missing/invalid, or non-HTTPS in production (localhost excepted) — failing the build instead of shipping a bundle that calls `localhost` from every visitor.

### `api/endpoints.ts` — domain API modules

One object per backend domain: `authApi`, `gamesApi`, `playersApi`, `mediaApi`, `franchisesApi`, `matchesApi`, `standingsApi`, `announcementsApi`, `registrationsApi`, `adminApi`, `disputesApi`, `seasonsApi`, `notificationsApi`, `auctionsApi`. Screens never call `axios` directly — they go through these, typed against `api/types.ts`.

### `query/hooks.ts` — server state

All server reads/writes are `useQuery`/`useInfiniteQuery`/`useMutation` hooks here. Keys come from a single **`qk` factory** (`qk.games()`, `qk.player(id)`, `qk.matches(params)`, …) so invalidation is centralized. Freshness is tuned per domain over the 30s global default: `STALE_STATIC` (10 min — games, seasons), `STALE_SEMI` (3 min — directories, standings), `STALE_LIST` (1 min — filtered lists, admin badges). Every mutation invalidates the relevant keys, so longer windows never surface stale data after a write. **`use-auction-socket.ts`** is a bidders-only WebSocket hook that writes each `auction.update` frame straight into the `['auctions', id]` cache (with capped-backoff reconnect + heartbeat); spectators poll the same key.

### `auth/` — session

`store.ts` is a `zustand` store with `persist`: the **access token stays in memory** (re-minted from the refresh token on reload), only the **refresh token** is persisted to `localStorage` (`partialize`), for XSS hardening. Beyond tokens/`user` it also holds `playerId`, `gamerTag`, `avatarUrl` (player→user fallback), and `onboardingRequired`, all re-derived from `/auth/me`. It exposes non-React `authTokens` accessors so the axios interceptor can read/rotate tokens outside React. `context.tsx` layers a React `AuthProvider`/`useAuth` on top (`user`, `playerId`, `gamerTag`, `avatarUrl`, `onboardingRequired`, `isAuthenticated`, `isAdmin`, `isSuperAdmin`, `hydrated`, `login`/`signup`/`verify`/`googleLogin`/`refreshUser`/`logout`), silently restoring a session via `GET /auth/me` on mount.

### `adapters/`

Pure mapping functions from backend DTOs to the display shapes screens render, keeping formatting/derivation out of components — `league.ts` for the public surface, `admin.ts` for the control room.

---

## Theming (see [./design-system.md](./design-system.md))

`components/sidequest/tokens.ts` defines the typed `SQ.*` color tokens and `FONT.*` families as references to CSS custom properties; the concrete values (warm-paper **light** + warm-espresso **dark**) live in `globals.css` under `:root` and `:root[data-theme="dark"]`. `globals.css` also holds base styles, the `.sq-field` input style, and `.admin-scope` scrollbar theming. Theme is `data-theme`-driven: set pre-paint by the root-layout script and flipped at runtime by `lib/theme.tsx`. `admin/tokens.ts` re-exports the same module — one system, two surfaces.

---

## Build & deploy notes

- **`NEXT_PUBLIC_API_URL` is baked at BUILD time** into the client bundle (default `http://localhost:8080/v1`). It must be the **browser-reachable** backend URL; changing it at runtime has no effect — rebuild. The `Dockerfile` takes it as an `ARG`. Optional `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (also build-time) toggles the Google sign-in button.
- **WebSocket URLs keep the `/v1` context path.** Backend at `:8080/v1`, frontend at `:3000`; the backend CORS allowlist must include the exact frontend origin.
- **Standalone deploy** needs `public/` + `.next/static` inside `.next/standalone` (the `postbuild` hook / Dockerfile handle it); run `node server.js` with `HOSTNAME=0.0.0.0` for LAN/prod.

## Limitations

- **No automated unit/component test suite.** The quality gate is `tsc --noEmit` (`npm run typecheck`) + `next build` + ad-hoc **Playwright** browser E2E during development. Treat typecheck + a real browser pass as the definition of "verified" — see [./testing.md](./testing.md).
- `hooks.ts` (~1100 LOC) and `types.ts` (~1020 LOC) are large single files by design (one place each for server state and DTO types); grep by `qk.*`/domain name rather than scrolling.
