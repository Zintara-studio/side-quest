# Routes & pages

Every URL the Side Quest frontend serves, the layout shell it renders under, its dynamic segments, and the screen component behind it — grounded in `src/app` and `src/components`.

**See also:** [./architecture.md](./architecture.md) · [./data-and-state.md](./data-and-state.md) · [./design-system.md](./design-system.md) · [../CLAUDE.md](../CLAUDE.md) · [../README.md](../README.md)

---

## Overview

- **Framework:** Next.js 15 App Router, React 19, TypeScript (package name `esports-arena`).
- **Route surface:** ~41 `page.tsx` route segments + a global `not-found.tsx` = **~42 routes**, organized into three regions by [route group](https://nextjs.org/docs/app/building-your-application/routing/route-groups) plus one standalone page:
  - `(auth)` — sign-in / account flows, no shell chrome (centered card).
  - `(site)` — the public league, wrapped in **`LeagueShell`**.
  - `/admin/*` — the league control room, wrapped in **`AdminShell`**.
  - `/onboarding` — a **standalone** full-page route (no shell) that first-time SSO accounts are forced to by `OnboardingGuard` before they can use the app.
- **Page convention:** every `page.tsx` is a thin server component that sets `metadata.title` and renders exactly one screen component from `src/components/{sidequest,admin}/screens`. All real logic (data, state, UI) lives in the screen, not the route.
- **Root wiring:** `src/app/layout.tsx` loads the three `next/font` families (`Archivo`, `Archivo Black`, `Spline Sans Mono` → `--font-sq-*`), sets the pre-paint theme script (`localStorage['sq-theme']` → `data-theme`), and mounts `Providers` (TanStack Query client + `AuthProvider`).

### Route groups → layouts

| Group | Layout file | Shell | Chrome |
|---|---|---|---|
| `(auth)` | `src/app/(auth)/layout.tsx` | none (inline) | Centered 408px card, Side Quest wordmark + `SeasonCode` badge |
| `(site)` | `src/app/(site)/layout.tsx` | `LeagueShell` | Sticky top nav (Home/Games/Franchises/Players/Matches/Announcements + My Team/My Franchise when signed in), notification bell, theme toggle, pinned footer |
| `/admin` | `src/app/admin/layout.tsx` | `AdminShell` | 244px left sidebar (LEAGUE / ENTITIES / COMMS / SYSTEM groups), sticky top bar, live badges |

`(auth)` sits outside both shells so the login/signup screens render without nav chrome. Route-group folders (`(auth)`, `(site)`) do **not** appear in the URL — `src/app/(site)/games/page.tsx` serves `/games`.

---

## Access guards

Guards are **client-side redirects inside the shells** (there is no `middleware.ts`); the backend is the real authorization boundary.

- **`AdminShell`** — reads `useAuth()`; once `hydrated`, if `!isAdmin` it `router.replace("/login?next=<current path>")`. While hydrating it renders `Checking access…`; for a non-admin it renders `Redirecting to sign in…` and never paints admin content. The `?next=` value is resolved back through `safeNextPath()` (`src/lib/nav.ts`), which rejects off-origin/backslash paths.
- **`LeagueShell`** — the inverse: once `hydrated`, if `isAdmin` it `router.replace("/admin")`, keeping admins in the control room. Public `(site)` pages otherwise render for everyone; per-page screens gate their own authed actions (e.g. `My Team`, `My Franchise` nav links only show for a signed-in non-admin).
- **`OnboardingGuard`** (`src/components/sidequest/onboarding-guard.tsx`, mounted once in `Providers`) — a whole-app gate for **first-time SSO accounts**. Once `hydrated`, if `onboardingRequired` is true and the path isn't `/onboarding`, it `router.replace("/onboarding")`. A fresh Google sign-in parks a placeholder username server-side and sets this flag until the account claims a real username on the onboarding step.
- **`(auth)`** pages are always reachable.

---

## `(auth)` — sign-in & account (4 routes)

Wrapped by `src/app/(auth)/layout.tsx`. Each screen lives in `src/components/sidequest/auth/`.

| Route | Purpose | Screen component |
|---|---|---|
| `/login` | Email + password sign-in; honors `?next=` post-login redirect via `safeNextPath` | `LoginForm` |
| `/signup` | Create account (kicks off email-OTP verification) | `SignupForm` |
| `/verify-email` | Enter the email OTP to verify the account (email-verified → Player becomes `VERIFIED`) | `VerifyEmailForm` |
| `/forgot-password` | Request + complete a password reset | `ForgotForm` |

---

## `(site)` — public league under `LeagueShell` (19 routes)

Wrapped by `src/app/(site)/layout.tsx`. Screens live in `src/components/sidequest/screens/`.

> **Pretty URLs (slugs).** The `[id]` segments below accept a human-readable **slug OR a raw UUID** — the backend resolves either: `/player/<gamerTag>`, `/franchise/<tag>`, `/match/<game-date-shorthex>`, `/announcements/<shortCode>`. The UI only ever emits slugs (built via the helpers in `src/lib/routes.ts`); the UUID path is kept alive because some stored links — e.g. notification deep-links like `/match/<uuid>` — still use ids. Admin deep-link routes (`/admin/match|player|franchise/[id]`) intentionally stay on UUIDs (internal). See the data-layer doc.

| Route | Purpose | Dynamic seg | Screen component |
|---|---|---|---|
| `/` | League home — standings, live matchday, contextual auction link | — | `HomeScreen` |
| `/games` | Supported games catalog | — | `GamesScreen` |
| `/franchises` | Franchise standings table | — | `FranchisesScreen` |
| `/franchise` | Bare route — prompts "Select a franchise from the league table" (no id) | — | `FranchiseScreen` |
| `/franchise/[id]` | One franchise — banner, roster, match history | `[id]` | `FranchiseScreen` |
| `/players` | Player directory | — | `PlayersScreen` |
| `/player` | Signed-in user's **own** profile (falls back to `playerId` when no id) | — | `PlayerScreen` |
| `/player/[id]` | A player's public profile; owner/admin see edit + report/appeal tools | `[id]` | `PlayerScreen` |
| `/match` | Match history list, with a `?game=` filter (reads `useSearchParams` under `Suspense`) | — | `MatchScreen` (→ `MatchHistory`) |
| `/match/[id]` | Match detail — lineups, results, per-game breakdown | `[id]` | `MatchScreen` (→ `MatchDetail`) |
| `/announcements` | League announcements feed | — | `AnnouncementsScreen` |
| `/announcements/[id]` | A single announcement **read page** (markdown body + a Register / View-result action) | `[id]` (shortCode or uuid) | `AnnouncementDetailScreen` |
| `/auction` | Public **spectator** view. When an auction is live it's the board (read-only without a franchise seat); when **none is scheduled** it shows the standing registration **pool** (`NoAuctionPool`) instead of a dead end | — | `AuctionBidScreen` |
| `/rules` | Rules & fair-play (markdown via `react-markdown` + `remark-gfm`) | — | `RulesScreen` |
| `/notifications` | The signed-in user's notification feed | — | `NotificationsScreen` |
| `/register` | Register for a season/match; `?announcement=<id>` fixes the mode & derives the game | — | `RegisterScreen` |
| `/my/franchise` | The user's owned/managed franchise dashboard | — | `MyFranchiseScreen` |
| `/my/franchise/auction` | Participant auction board — same `AuctionBidScreen`, but bid-enabled for the seat | — | `AuctionBidScreen` |
| `/my/registrations` | "My Team" — the user's own registrations/roster | — | `MyRegistrationsScreen` |

Notes:
- `/auction` and `/my/franchise/auction` render the **same** `AuctionBidScreen`; it decides read-only vs. bid-enabled from whether the viewer holds a participating franchise seat. Live bid frames arrive over WebSocket (`useAuctionSocket`, see the data-layer doc); spectators fall back to polling.
- `RegisterScreen` takes an `announcementId` prop from the `?announcement=` search param and derives registration mode (solo `PLAYER` vs. squad) + game from that announcement (or its linked match) instead of a manual picker.
- The **profile editor** is a modal (`ProfileEditor`) mounted inside `PlayerScreen`, not its own route.

---

## `/admin/*` — control room under `AdminShell` (17 routes)

Wrapped by `src/app/admin/layout.tsx`; guarded to admins only (see [Access guards](#access-guards)). Sidebar order comes from `navGroups` in `admin-shell.tsx`. Most screens live in `src/components/admin/screens/`; four routes **reuse the public `sidequest` screens** with a `base="/admin"` prop (see below).

| Route | Sidebar group | Purpose | Dynamic seg | Screen component |
|---|---|---|---|---|
| `/admin` | LEAGUE | Overview dashboard (results-to-enter, open disputes, live auction, franchise proposals) | — | `OverviewScreen` (`admin`) |
| `/admin/matches` | LEAGUE | Fixtures list + management; badge = results awaiting entry | — | `MatchesScreen` (`admin`) |
| `/admin/matches/result` | LEAGUE | Result-entry form (reads search params → wrapped in `Suspense`) | — | `ResultScreen` (`admin`) |
| `/admin/match/[id]` | — (deep link) | Match detail, admin variant of the public match page | `[id]` | `MatchScreen` (`sidequest`, `base="/admin"`) |
| `/admin/auction` | LEAGUE | Run the auction (start/close/pool); sidebar shows a `LIVE` pill while running | — | `AuctionScreen` (`admin`) |
| `/admin/registrations` | LEAGUE | Match/season sign-ups (live from creation — no approval queue) | — | `RegistrationsScreen` (`admin`) |
| `/admin/disputes` | LEAGUE | Reports/appeals queue; badge = open disputes | — | `DisputesScreen` (`admin`) |
| `/admin/franchises` | ENTITIES | Franchise admin; badge = pending `FRANCHISE` proposals | — | `FranchisesScreen` (`admin`) |
| `/admin/franchise/[id]` | — (deep link) | Franchise detail, admin variant | `[id]` | `FranchiseScreen` (`sidequest`, `base="/admin"`) |
| `/admin/players` | ENTITIES | Player admin (status, tags, moderation) | — | `PlayersScreen` (`admin`) |
| `/admin/player/[id]` | — (deep link) | Player detail, admin variant | `[id]` | `PlayerScreen` (`sidequest`, `base="/admin"`) |
| `/admin/games` | ENTITIES | Supported-games CRUD | — | `GamesScreen` (`admin`) |
| `/admin/announcements` | COMMS | Author/manage announcements (lifecycle, auto-void) | — | `AnnouncementsScreen` (`admin`) |
| `/admin/history` | SYSTEM | Season history / audit trail | — | `HistoryScreen` (`admin`) |
| `/admin/settings` | SYSTEM | League/season settings | — | `SettingsScreen` (`admin`) |
| `/admin/notifications` | — (top bar) | Admin notification feed, rendered in the admin shell so admins aren't bounced to `(site)` | — | `NotificationsScreen` (`sidequest`) |
| `/admin/profile` | — (sidebar footer) | Admin's own profile | — | `AdminProfileScreen` (`admin`) |

Not every route is a top-level sidebar link: `matches/result`, `match/[id]`, `franchise/[id]`, and `player/[id]` are reached by drilling in from their list pages; `notifications` hangs off the top-bar bell; `profile` off the sidebar footer identity block.

---

## Shared screens & the `base` prop

Four detail views are written once in `src/components/sidequest/screens/` and mounted from **both** the public site and the admin console. The only difference is a `base` prefix so internal links resolve to the correct region:

| Screen | Public mount (`base=""`) | Admin mount (`base="/admin"`) |
|---|---|---|
| `MatchScreen` | `/match`, `/match/[id]` | `/admin/match/[id]` |
| `FranchiseScreen` | `/franchise`, `/franchise/[id]` | `/admin/franchise/[id]` |
| `PlayerScreen` | `/player`, `/player/[id]` | `/admin/player/[id]` |
| `NotificationsScreen` | `/notifications` | `/admin/notifications` |

Each screen composes links as `` `${base}/franchise/${id}` `` etc., so an admin viewing a match stays inside `/admin/*` while a public viewer stays under `(site)`. This keeps the two consoles visually distinct (different shell) without duplicating the detail-view logic. `PlayerScreen`/`FranchiseScreen`/`MatchScreen` all treat a **missing `id`** as a list/self view (e.g. `/player` shows the signed-in user's own profile; `/match` shows history).

---

## Dynamic segments (Next 15 async params)

Seven routes use a `[id]` segment (`(site)`: franchise, player, match, announcements; `admin`: franchise, player, match). Public `[id]`s accept a **slug or a UUID** (backend resolves either); admin `[id]`s are UUIDs. Under Next 15, `params` and `searchParams` are **Promises** — the route awaits them before passing the value down:

```tsx
// src/app/(site)/franchise/[id]/page.tsx
export default async function FranchiseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FranchiseScreen id={id} />;
}
```

Dynamic routes: `(site)/franchise/[id]`, `(site)/player/[id]`, `(site)/match/[id]`, `(site)/announcements/[id]`, `admin/franchise/[id]`, `admin/player/[id]`, `admin/match/[id]`. Two routes read **search params** and therefore wrap their client screen in `Suspense` (`admin/matches/result`) or read them inside a `Suspense` boundary in the screen (`(site)/match` via `MatchHistory`'s `?game=`); `(site)/register` awaits `searchParams` for `?announcement=<shortCode>`.

---

## Global / special routes

| File | Serves | Notes |
|---|---|---|
| `src/app/onboarding/page.tsx` | `/onboarding` | Standalone (no shell) — a first-time SSO account completes its account here: type an immutable username (with live availability), avatar upload (cropper), plus optional/private real name/phone/region/bio/contact-email. `OnboardingScreen`; reachable only while `onboardingRequired` (the guard bounces it away once cleared). |
| `src/app/not-found.tsx` | 404 fallback | Standalone "OFF THE MAP" page styled from `SQ`/`FONT` tokens; links back to `/` and `/franchises`. Renders outside any shell. |
| `src/app/layout.tsx` | root `<html>` | Fonts, pre-paint theme script, `<Providers>` (Query client + `AuthProvider` + `OnboardingGuard`) — not a navigable route. |

---

## Limitations & notes

- **Guards are client-side only.** Redirects in `LeagueShell`/`AdminShell` run after hydration and are UX, not security — the Spring backend at `:8080/v1` enforces real authorization. Do not treat a route being reachable as an authorization signal.
- **No `middleware.ts`, no server-side auth redirects.** A hard refresh on an admin URL briefly shows `Checking access…` before the client decides.
- **Titles only in `metadata`.** Route files set `title`; no route does server data fetching — all data flows through TanStack Query hooks in the client screens (see [./data-and-state.md](./data-and-state.md)).
- **No automated route/component test suite.** The quality gate is `tsc --noEmit` (`npm run typecheck`) + `next build` + ad-hoc Playwright E2E; there are no unit tests asserting route behavior.
- **`NEXT_PUBLIC_API_URL` is baked at build time** into the client bundle (default `http://localhost:8080/v1`); it must be browser-reachable, and WebSocket URLs keep the `/v1` context path. Changing the backend origin requires a rebuild, not just an env swap.
