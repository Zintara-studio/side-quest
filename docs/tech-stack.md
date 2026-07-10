# Tech stack

The libraries the Side Quest frontend runs on, their exact versions, and *why* each one is here — grounded in `package.json`, `next.config.mjs`, and the code under `src/`.

**See also:** [./architecture.md](./architecture.md) · [./data-and-state.md](./data-and-state.md) · [./design-system.md](./design-system.md) · [./setup.md](./setup.md) · [../CLAUDE.md](../CLAUDE.md)

---

## At a glance

`package.json` name: **`esports-arena`** (v0.1.0, private). A Next.js App Router client — 109 `.ts`/`.tsx` files, ~24,790 LOC across `src/{app,components,lib}` — that renders the public league and the admin control room and talks to the Spring Boot backend at `/v1`.

| Concern | Choice | Version | Why |
|---|---|---|---|
| Framework | **Next.js** (App Router) | `^15.1.0` | Route groups + thin server `page.tsx` → client screens; `output: "standalone"` for a small deploy artifact. |
| UI runtime | **React** | `^19.0.0` | Paired with Next 15; Strict Mode on. |
| Language | **TypeScript** | `^5.6.3` | `strict: true`; the primary quality gate is `tsc --noEmit`. |
| Server state | **TanStack Query** | `^5.59.20` | All fetching/caching/mutations; `useQuery`/`useInfiniteQuery`/`useMutation` with a `qk` key factory + per-domain stale times. |
| HTTP | **axios** | `^1.7.7` | One instance; request/response interceptors do Bearer injection + refresh-token rotation. |
| Client state | **zustand** | `^5.0.1` | Just the auth session (access token in memory, refresh token persisted). |
| Styling | **Tailwind CSS** + hand-rolled tokens | `tailwindcss ^3.4.14` | Tailwind for base reset/utilities; actual look = inline style objects reading typed `SQ.*`/`FONT.*` CSS-variable tokens. |
| Fonts | **next/font** (Google) | (Next) | Archivo / Archivo Black / Spline Sans Mono, self-hosted + preloaded, exposed as `--font-sq-*`. |
| Markdown | **react-markdown** + **remark-gfm** | `^10.1.0` / `^4.0.1` | Renders backend announcement bodies with theme-matched element renderers. |
| Icons | **lucide-react** | `^0.460.0` | Icon set; tree-shaken via `optimizePackageImports`. |
| Class utils | **clsx** + **tailwind-merge** | `^2.1.1` / `^2.5.4` | The `cn()` helper in `lib/utils.ts`. |
| Lint | **eslint** + **eslint-config-next** | `^9.14.0` / `^15.1.0` | `next lint`. |
| CSS pipeline | **postcss** + **autoprefixer** | `^8.4.49` / `^10.4.20` | Tailwind's build step. |

There is **no runtime `dependencies` entry you don't see above** — the stack is deliberately small.

---

## Framework: Next.js 15 (App Router) + React 19

- **Route groups, not folders-as-nav.** `src/app` splits into `(auth)` (login/signup/verify-email/forgot-password), `(site)` (the public LeagueShell), and `/admin/*` (the AdminShell). Each route is a thin `page.tsx` that renders a screen component from `components/{sidequest,admin}/screens` (15 public + 13 admin screens).
- **`next.config.mjs`** sets:
  - `reactStrictMode: true`
  - `output: "standalone"` — a self-contained `.next/standalone/server.js` for AWS/EC2 without shipping `node_modules`.
  - `devIndicators: false` — hides the dev overlay badge.
  - `experimental.optimizePackageImports: ["lucide-react"]` — only the icons used get bundled.
- **`tsconfig.json`**: `strict`, `target: ES2022`, `moduleResolution: "bundler"`, `noEmit`, path alias `@/* → ./src/*`.
- **Fonts** are loaded in `src/app/layout.tsx` via `next/font/google` — `Archivo` → `--font-sq-sans`, `Archivo_Black` → `--font-sq-display`, `Spline_Sans_Mono` → `--font-sq-mono` — so `FONT.*` tokens resolve to self-hosted, preloaded font files (no external font CDN, no layout shift). The root layout also runs a tiny inline script that stamps `data-theme` before paint to avoid a theme flash.

---

## Server state: TanStack Query v5

All remote data flows through hooks in `lib/query/hooks.ts` (~985 LOC) — screens never call `axios` directly.

- **Query-key factory `qk`** namespaces keys per domain (`qk.games`, `qk.player(id)`, `qk.matches(params)`, `qk.franchiseRoster(id)`, …) so mutations invalidate precisely.
- **Per-domain freshness** on top of the global 30s default (set in `app/providers.tsx`):

  | Constant | Window | Applies to |
  |---|---|---|
  | `STALE_STATIC` | 10 min | catalog: games, seasons |
  | `STALE_SEMI` | 3 min | directories & standings |
  | `STALE_LIST` | 1 min | filtered lists & admin badges |

  Longer windows never surface stale data after a write because every mutation invalidates the relevant keys.
- **Infinite lists** use `useInfiniteQuery` with `keepPreviousData` for paginated matches and announcements (key suffix `"infinite"`).
- **Global defaults** (`providers.tsx`): `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`. The `QueryClient` is created once inside a `useState` initializer so it survives re-renders.
- **The auction bid room writes into the same cache.** `lib/query/use-auction-socket.ts` opens a WebSocket for bidders/admins and pushes each `auction.update` frame straight into `qc.setQueryData(["auctions", id], …)` — the board that polling fills re-renders with no extra request. Spectators never enable the socket and stay on the poll.

---

## HTTP: axios + interceptors

`lib/api/client.ts` owns a single `api` instance (plus a bare `refreshClient` used only for `/auth/refresh`, to avoid interceptor recursion). Domain functions live in `lib/api/endpoints.ts` (~411 LOC, grouped `authApi`, `gamesApi`, `playersApi`, `franchisesApi`, `matchesApi`, `auctionsApi`, `disputesApi`, `notificationsApi`, …); shared TS types mirroring backend DTOs live in `lib/api/types.ts` (~930 LOC).

- **Request interceptor** attaches `Authorization: Bearer <access>`. On a fresh page load the access token is memory-only, so if a refresh token exists it *pre-mints* the access token (sharing one in-flight refresh) instead of firing an unauthenticated request and eating a 401.
- **Response interceptor** rotates the refresh token on a `401` and retries the original request **once** (`_retried` guard, single shared `refreshing` promise so concurrent 401s don't stampede).
- **Helpers** exported from the same module:
  - `wsUrl(path)` — maps `http→ws`/`https→wss` and **keeps the `/v1` context path** (WS endpoints are registered under it).
  - `mediaSrc(url)` — resolves stored `/media/{id}` refs to the API origin; passes through absolute/`data:` URLs.
  - `apiErrorMessage(err)` — normalizes the backend `ApiError` shape (`message`/`error`/`detail`) into a human string.
- **Build-time env guard.** `NEXT_PUBLIC_API_URL` is inlined at build, so `client.ts` validates it during `next build`: required in production, must parse as a URL, and must be `https` unless it's `localhost`/`127.0.0.1`. Default `http://localhost:8080/v1`.

---

## Client state: zustand

`lib/auth/store.ts` is the only zustand store — it holds the auth session, nothing else. Server data belongs to TanStack Query, not here.

- **`persist` middleware** to `localStorage` under key `sq-auth`. The **access token is kept in memory only** (re-minted from the refresh token on reload, per the XSS guidance); the **refresh token is persisted** so a returning visitor stays signed in.
- Exposes `authTokens` (`getAccess`/`getRefresh`/`setSession`/`clear`) — the plain object the axios interceptors read without subscribing to React. `lib/auth/context.tsx` wraps the store for component-side `useAuth()`.

---

## Styling: Tailwind + hand-rolled typed tokens

There is **no UI kit and no CSS-in-JS library.** Components style themselves with inline `style` objects that read typed tokens.

- **Tokens** live in `components/sidequest/tokens.ts` — `SQ.*` colors and `FONT.*` families exported as `var(--sq-*)` references; `components/admin/tokens.ts` simply re-exports them (one canonical palette for both shells). Helpers like `matchStatusLabel()` and `rankAccent()` live alongside so status/rank coloring is shared.
- **The actual values** are in `src/app/globals.css`: a `:root` block for **Warm Paper** (light) and a `:root[data-theme="dark"]` block for **Warm Espresso** (dark), plus base styles, the `.sq-field` input style, and `.admin-scope` scrollbar styling. Theme switches by flipping `document.documentElement.dataset.theme` (see `lib/theme.tsx`).
- **Tailwind** (`tailwind.config.ts`: `content: ["./src/**/*.{ts,tsx,mdx}"]`, empty `theme.extend`, no plugins) provides the base reset and a handful of utility classes (`min-h-screen antialiased`) — it is *not* how the app gets its look. PostCSS runs `tailwindcss` + `autoprefixer`.
- **`cn()`** (`lib/utils.ts`) = `twMerge(clsx(...))` for the few places class strings are composed.

---

## Markdown, icons, and image handling

- **Announcements** render through `components/sidequest/markdown.tsx` — `react-markdown` + `remark-gfm` (GFM tables/strikethrough/task lists) with per-element renderers wired to `SQ.*`/`FONT.*` so the output matches the theme (external links get `target=_blank rel=noopener`).
- **Icons** come from `lucide-react`, tree-shaken via `optimizePackageImports`.
- **Image uploads are compressed in the browser with zero dependencies.** `lib/image.ts` uses the Canvas API to resize + re-encode (WebP when the browser can, else JPEG) under per-kind caps (avatar ~30 KB / logo ~60 KB / banner ~240 KB) so the base64 envelope clears the backend `@Size` limit — no image library is bundled.

---

## Build & deploy

Scripts (`package.json`):

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Local dev server on :3000 |
| `build` | `next build` | Produces `.next/standalone` |
| `postbuild` | `cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static` | Standalone output ships `server.js` but **not** `public/`/`static/` — this copies them in. |
| `start` | `next start` | Normal Next server |
| `start:standalone` | `node .next/standalone/server.js` | Run the standalone artifact |
| `lint` | `next lint` | ESLint |
| `typecheck` | `tsc --noEmit` | Type gate |

**Docker** (`Dockerfile`, multi-stage `node:20-alpine`):

- Build stage runs `npm ci` then `npm run build` with `NEXT_PUBLIC_API_URL` as a **build arg** (default `http://localhost:8080/v1`) — because `NEXT_PUBLIC_*` is inlined into the client bundle, a runtime env var would be too late.
- Runtime stage copies `.next/standalone`, `.next/static`, and `public/`, sets `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, drops to `USER node`, and runs `node server.js`.

Frontend serves on **:3000**, backend on **:8080/v1**; the backend CORS allowlist must include the exact frontend origin (`localhost:3000` ≠ a LAN IP).

---

## Deliberately NOT used

The current app fully replaced an earlier mock prototype; several libraries that prototype pulled in were dropped:

| Not here | Instead |
|---|---|
| `framer-motion` | CSS transitions/tokens |
| `recharts` (or any charting lib) | Hand-built visuals — CSS bars / inline SVG driven by `SQ.*` tokens |
| `radix-ui` / any headless UI kit | Shared hand-rolled components (`Modal`, `ConfirmModal`, `SearchableSelect`, `Toggle`, …) |
| `react-hook-form` + `zod` | Hand-rolled forms with plain React state (`components/sidequest/auth/*`, screen-local state); validation is the backend's job |
| `jose` / client-side JWT libs | Tokens are opaque to the client; axios attaches them, the backend verifies |

Keeping these out is intentional: business rules and validation belong to the backend, and the design is bespoke rather than a UI-kit default.

---

## Testing / quality gate

There is **no automated unit or component test suite.** The quality gate is:

1. `npm run typecheck` (`tsc --noEmit`) — the strict TS pass that catches most regressions.
2. `npm run build` — a full production build (also runs the env-URL guard and ESLint config).
3. **Playwright browser E2E**, driven ad hoc during development — loading/empty/error states, dark/light, console/network, refresh persistence, and permissions on affected pages.

**Limitation:** because there are no committed tests, `typecheck` + `build` guard *types and compilation* but not behavior — behavioral coverage depends on running the browser flow each change. See [./testing.md](./testing.md).
