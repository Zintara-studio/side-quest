# Developer guide / contributing

How code is organized in the Side Quest frontend and the conventions to follow when you change it — so a new contributor can add a feature without breaking the patterns already in place.

**See also:** [./architecture.md](./architecture.md) · [./structure.md](./structure.md) · [./data-and-state.md](./data-and-state.md) · [./design-system.md](./design-system.md) · [./routes.md](./routes.md) · [./tech-stack.md](./tech-stack.md) · [./setup.md](./setup.md) · [./testing.md](./testing.md) · [./troubleshooting.md](./troubleshooting.md) · [../CLAUDE.md](../CLAUDE.md)

---

## The one rule that overrides everything

**Business rules belong to the backend.** This client renders and calls; it does not own league logic. If you find yourself computing eligibility, points, auction budgets, or state transitions in a component, stop — call the API and render what it returns. The Spring Boot service at `/v1` is the source of truth. (See [../CLAUDE.md](../CLAUDE.md).)

---

## Shape of the codebase

Next.js 15 (App Router) · React 19 · TypeScript. Package name `esports-arena`. 109 `.ts`/`.tsx` files, ~24,790 LOC, under `src/`:

| Path | What lives here | Files |
|------|-----------------|-------|
| `src/app/` | Thin route entry points (`page.tsx`, `layout.tsx`) — one per route | 46 |
| `src/components/` | The actual UI. `sidequest/screens` (15 public screens) + `admin/screens` (13 admin screens) + shared components | 50 |
| `src/lib/` | Non-UI: `api/`, `query/`, `auth/`, `adapters/`, plus `theme.tsx`, `image.ts`, `ranks.ts`, `nav.ts`, `utils.ts` | 14 |

Two shells are rendered from one codebase (see `src/app/(site)/layout.tsx` → `LeagueShell`, `src/app/admin/layout.tsx` → `AdminShell`), plus an `(auth)` route group for login/signup/verify/forgot.

---

## Conventions (enforce these)

### 1. A route is a thin server `page.tsx`

A `page.tsx` should do almost nothing: export `metadata`, unwrap params, and render a client screen component. All logic lives in the screen. Two shapes:

```tsx
// src/app/(site)/players/page.tsx — static route
import type { Metadata } from "next";
import { PlayersScreen } from "@/components/sidequest/screens/players";

export const metadata: Metadata = { title: "Players" };

export default function LeaguePlayersPage() {
  return <PlayersScreen />;
}
```

```tsx
// src/app/(site)/player/[id]/page.tsx — dynamic route (Next 15: params is a Promise)
export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayerScreen id={id} />;
}
```

Screen components are `"use client"` and live in `components/sidequest/screens/` (public) or `components/admin/screens/` (admin). Don't put fetching, business logic, or big JSX in `page.tsx`.

### 2. Styling = inline style objects using `SQ.*` / `FONT.*` tokens

There is **no CSS-in-JS library and no UI kit**. Styling is plain inline `style={{ ... }}` objects that reference typed design tokens from `components/sidequest/tokens.ts` (admin re-exports the same file):

```tsx
import { SQ, FONT } from "../tokens";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;
```

`SQ.*` values are CSS custom properties (`SQ.ink === "var(--sq-ink)"`); the concrete light ("warm paper") and dark ("warm espresso") values live in `globals.css` under `:root` / `[data-theme=dark]`. Because every color is a token, **both themes come for free** — never hardcode a hex in a component. Fonts come from `next/font` (Archivo / Archivo Black / Spline Sans Mono → `--font-sq-sans` / `--font-sq-display` / `--font-sq-mono`), surfaced as `FONT.sans` / `FONT.display` / `FONT.mono`.

Status/label helpers (`matchStatusLabel`, `rankAccent`, …) also live in `tokens.ts` and are shared across both shells so a raw enum like `AWAITING_RESULT` never leaks to the UI. Reuse them rather than re-deriving labels.

### 3. Server state via TanStack Query only — never fetch in a component

Every read/write of backend data goes through a hook in `src/lib/query/hooks.ts` (~100 exported hooks). Components call the hook; they do not touch `axios` or `endpoints.ts` directly.

```tsx
export function PlayersScreen() {
  const { data, isLoading, isError } = usePlayers({ limit: 100 });
  const players = data ? adaptPlayers(data.items) : [];
  // ...render
}
```

- Query keys come from the `qk` factory in `hooks.ts` (`qk.players(params)`, `qk.player(id)`, …) so invalidation is consistent.
- Per-domain `staleTime`s tune freshness above the 30s global default set in `src/app/providers.tsx`: `STALE_STATIC` = 10 min (catalog: games, seasons), `STALE_SEMI` = 3 min (directories, standings), `STALE_LIST` = 1 min (filtered lists, admin badges). Mutations invalidate the relevant keys, so a longer window never surfaces stale data after a write.
- Mutation hooks pair a `mutationFn` with `onSuccess: () => qc.invalidateQueries(...)`. Follow that pattern; don't manually refetch.
- Live auction bids are the one exception to polling: `src/lib/query/use-auction-socket.ts` writes each `auction.update` WebSocket frame straight into the `["auctions", id]` cache. It runs for **bidders and admins only** (`enabled`); spectators stay on the poll.

### 4. All API calls go through `lib/api/endpoints.ts`, typed in `lib/api/types.ts`

`endpoints.ts` holds typed wrappers grouped by domain — 14 objects: `authApi`, `gamesApi`, `playersApi`, `mediaApi`, `franchisesApi`, `matchesApi`, `standingsApi`, `announcementsApi`, `registrationsApi`, `adminApi`, `disputesApi`, `seasonsApi`, `notificationsApi`, `auctionsApi`. Each function returns `.then(r => r.data)` and is fully typed against `types.ts` (~100 interfaces/types mirroring the backend DTOs). Paths are relative to the `/v1` base baked into the shared `api` axios instance (`lib/api/client.ts`).

- The axios instance handles auth transparently: Bearer token from the zustand store on every request, single-flight refresh-token rotation on a 401, one retry. Don't re-implement any of that per call.
- Use the `mediaSrc()` / `wsUrl()` helpers from `client.ts` for uploaded-image URLs and WebSocket URLs — both correctly keep the API origin and the `/v1` context path.
- **Display-shaping goes in `lib/adapters/`**, not in screens. `adapters/league.ts` and `adapters/admin.ts` map backend DTOs onto the display shapes the screens render (`adaptPlayers`, `Standing`, `PlayerRow`, …), including neutral fallbacks for fields the backend doesn't expose. Keep formatting logic there so screens stay thin.

### 5. Reuse the shared components; keep them small

Before building UI, check for an existing shared component under `components/sidequest/` (and `components/admin/`):

| Component | Use for |
|-----------|---------|
| `Modal` (`ModalProps`: `open`, `title`, `onClose`, `children`) | Any dialog |
| `ConfirmModal` | Destructive/confirming actions (themed, don't use `window.confirm`) |
| `Avatar` | Player/franchise images (pairs with `mediaSrc`) |
| `StateNote` (`tone: "muted" \| "error"`) | Loading / empty / error states |
| `NotificationBell` (`href`) | The unread-count bell in a shell header |
| `LeagueTitle` / `ScreenHeader` | Public / admin page headers |
| `LineupEditor`, `SearchableSelect`, `Markdown`, `SeasonCode`, `Toggle`, `TableScroll` | Their named jobs |

Keep components small and avoid deep nesting. Every screen should render explicit loading, empty, and error states (that's what `StateNote` is for), and must look right in **both** light and dark themes.

---

## API-change checklist (when the backend changes)

Backend DTOs and endpoints are mirrored here by hand. When they change, update **in this order** and verify every consumer — skipping a step ships a runtime type mismatch:

1. **`lib/api/types.ts`** — update/add the interface mirroring the DTO.
2. **`lib/api/endpoints.ts`** — update/add the typed wrapper in the right domain object.
3. **`lib/query/hooks.ts`** — update/add the hook (+ a `qk` key, + `invalidateQueries` for mutations).
4. **`lib/adapters/`** — if the display shape changes, update the adapter (not the screen).
5. **The consuming screen(s)** — update every place that reads the changed field.
6. **Verify every consumer**: `npm run typecheck` (catches most drift) → `npm run build` → drive the affected pages in a browser (Playwright): loading/empty/error, dark/light, console/network, refresh persistence, permissions.

---

## How to add a new screen

Say you're adding a "Casters" directory page. Work outside-in from the data:

1. **Type** — add the DTO interface(s) to `lib/api/types.ts` (e.g. `CasterSummary`, `PageResponse<CasterSummary>`).
2. **Endpoint** — add a `castersApi` object (or a function to an existing domain) in `lib/api/endpoints.ts`:
   ```ts
   export const castersApi = {
     list: (params?: CasterListParams) =>
       api.get<PageResponse<CasterSummary>>("/casters", { params: clean(params) }).then((r) => r.data),
   };
   ```
   (`clean()` drops `undefined`/`""` params so empty filters don't hit the wire.)
3. **Hook** — add to `lib/query/hooks.ts`: a `qk.casters` key and a `useCasters` hook with an appropriate `staleTime`.
4. **Adapter** — if the raw DTO needs shaping, add `adaptCasters` to `lib/adapters/league.ts`.
5. **Screen** — create `components/sidequest/screens/casters.tsx` (`"use client"`), call `useCasters()`, render with `SQ.*`/`FONT.*` tokens and shared components, handle loading/empty/error via `StateNote`.
6. **Route** — create `src/app/(site)/casters/page.tsx`: export `metadata`, render `<CastersScreen />`. Use `[id]` + `params: Promise<{id}>` for a detail route. Add it to the shell nav if it should be linked.
7. **Verify** — the build gate below, then browser-check both themes.

Admin screens are identical but under `components/admin/screens/` and `src/app/admin/`.

---

## Build gate (verify before "done")

There is **no automated unit or component test suite**. The quality gate is:

```bash
npm run typecheck   # tsc --noEmit — catches DTO/hook/screen type drift
npm run build       # next build (output: standalone) — must pass clean
```

Then drive the affected pages in a real browser with Playwright — loading/empty/error states, dark **and** light, browser console + network tab, refresh for persistence, and permission checks (admin vs. public). Take a screenshot on failure. Don't claim a feature is done without browser verification. See [./testing.md](./testing.md).

Two build-time gotchas worth knowing (see [./troubleshooting.md](./troubleshooting.md)):
- **`NEXT_PUBLIC_API_URL` is inlined at build time** (default `http://localhost:8080/v1`); a runtime change won't take — rebuild. `client.ts` fails the production build if it's missing or non-https (localhost excepted).
- The **standalone** output needs `public/` + `.next/static` copied into `.next/standalone` — the `postbuild` script does this. `start:standalone` runs `node .next/standalone/server.js`.

---

## Git

Terse, imperative, single-sentence commit messages, **no co-author trailer** (e.g. `Add casters directory screen`). Keep commits focused; don't reformat the repo or touch unrelated files.

**The user commits and pushes all code themselves — agents do not run `git commit` or `git push`.**
