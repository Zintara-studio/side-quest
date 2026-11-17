# Data fetching & state

How the Side Quest frontend talks to the backend and holds server state: the axios client, the TanStack Query cache, the zustand auth store, the live auction WebSocket, and the DTO→display adapters.

**See also:** [./architecture.md](./architecture.md) · [./routes.md](./routes.md) · [./tech-stack.md](./tech-stack.md) · [./contributing.md](./contributing.md) (the API-change checklist) · [../CLAUDE.md](../CLAUDE.md)

---

## The layers at a glance

```
screen (components/{sidequest,admin}/screens)
   │  imports hooks — never axios directly
   ▼
lib/query/hooks.ts        TanStack Query: useQuery / useInfiniteQuery / useMutation, qk keys, invalidation
   │
   ▼
lib/api/endpoints.ts      one typed function per backend endpoint (the only place axios is called)
   │
   ▼
lib/api/client.ts         axios instance: Bearer injection, refresh rotation, base URL, wsUrl/mediaSrc
   │
   ▼
Spring Boot API @ /v1
```

Side channels + small helper libs sit next to this spine:

- **`lib/auth/`** — the zustand session store (`store.ts`) + the React context (`context.tsx`) that hydrates it.
- **`lib/query/use-auction-socket.ts`** — a WebSocket that writes live frames straight into the Query cache.
- **`lib/adapters/`** — pure DTO→display mappers so screens don't shape data inline.
- **`lib/routes.ts`** — pretty-URL helpers (`playerHref`/`franchiseHref`/`matchHref`/`announcementHref`/`registerHref`, all URL-encoded). The UI builds links only through these.
- **`lib/username.ts`** — a client mirror of the backend `UsernameRules` (no spaces, 3–20, `[A-Za-z0-9_.-]`) for instant signup/onboarding feedback (the server stays authoritative).
- **`lib/image.ts`** — client-side image handling: `compressImage` (legacy downscale) plus the cropper primitives `loadImageFile` / `cropToDataUrl` / `CROP_DIMS` / `ASPECT` used by `ImageCropper`.
- **`lib/use-media-query.ts`** — a tiny SSR-safe `matchMedia` hook that drives the responsive admin sidebar→drawer switch.

The core layer plus the store, socket, and helpers:

| File | LOC | Role |
|------|----:|------|
| `lib/api/client.ts` | 151 | axios instance, interceptors, `wsUrl` / `mediaSrc` / `apiErrorMessage` |
| `lib/api/endpoints.ts` | 450 | per-domain typed API functions (the single API-call surface) |
| `lib/api/types.ts` | 1022 | TS mirrors of backend DTOs (`com.sidequest.arena.*.dto`) |
| `lib/query/hooks.ts` | 1097 | all Query hooks + the `qk` key factory + per-domain stale times |
| `lib/query/use-auction-socket.ts` | 86 | realtime bid feed → `["auctions", id]` cache |
| `lib/auth/store.ts` | 112 | zustand tokens/user/gamerTag/avatarUrl/onboardingRequired, `authTokens.*` non-React accessors |
| `lib/auth/context.tsx` | 161 | `AuthProvider` hydration + `login`/`signup`/`verifyEmail`/`googleLogin`/`refreshUser`/`logout` |
| `lib/routes.ts` · `lib/username.ts` · `lib/image.ts` · `lib/use-media-query.ts` | 18 / 17 / 196 / 20 | pretty-URL helpers · username-rule mirror · image compress+crop · responsive breakpoint hook |

---

## The axios client (`lib/api/client.ts`)

### Base URL — baked at build time

`API_BASE_URL` comes from `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8080/v1`. Because
`NEXT_PUBLIC_*` is **inlined at `next build` time**, a runtime change won't take — you must rebuild, and
it must be the *browser-reachable* backend URL (see [../CLAUDE.md](../CLAUDE.md) gotchas).

A build-time guard turns a misconfigured URL into a failed build rather than a bundle that silently calls
`localhost` from every visitor:

```ts
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL must be set for a production build (e.g. https://api.your-domain.com/v1).");
}
// …also: must parse as a URL, and must be https unless hostname is localhost/127.0.0.1.
```

### Bearer injection (request interceptor)

Every request gets `Authorization: Bearer <accessToken>` read from the zustand store via the non-React
`authTokens.getAccess()` accessor. The access token lives **in memory only**, so on a fresh page load it's
`null` until re-minted. Rather than fire the request unauthenticated and eat a 401+retry, the interceptor
mints the access token *first* from the refresh token, sharing one in-flight refresh:

```ts
api.interceptors.request.use(async (config) => {
  let token = authTokens.getAccess();
  if (!token && authTokens.getRefresh()) {
    if (!refreshing) refreshing = rotateRefreshToken().finally(() => { refreshing = null; });
    token = await refreshing;                 // all concurrent callers await the same refresh
  }
  if (token) AxiosHeaders.from(config.headers).set("Authorization", `Bearer ${token}`);
  return config;
});
```

### Refresh-token rotation (response interceptor)

On a `401` for a request that hasn't already been retried and where a refresh token exists, it rotates once
and replays the original request with the new token. A single shared `refreshing` promise means N concurrent
401s trigger **one** `/auth/refresh` call, not N:

```ts
if (error.response?.status === 401 && original && !original._retried && authTokens.getRefresh()) {
  original._retried = true;
  if (!refreshing) refreshing = rotateRefreshToken().finally(() => { refreshing = null; });
  const newToken = await refreshing;
  if (newToken) { /* set header, api.request(original) */ }
}
```

`rotateRefreshToken()` POSTs to `/auth/refresh`, calls `authTokens.setSession(data)` on success, and
`authTokens.clear()` on failure. It uses a **bare `refreshClient`** (no interceptors) to avoid recursion.

### Helpers

- **`wsUrl(path)`** — maps `http→ws` / `https→wss` and keeps the full base **including `/v1`** (WS endpoints
  register under it, e.g. `ws://host/v1/ws/live/auctions/{id}`). Do not strip `/v1`.
- **`mediaSrc(url)`** — resolves a stored media ref (`/media/{id}`, served from the API origin) to a loadable
  URL; passes `http(s):` / `data:` URLs through unchanged; returns `undefined` for null/empty.
- **`apiErrorMessage(err, fallback)`** — normalizes an axios error into a readable string from the backend's
  `{ message | error | detail }` shape. Used everywhere a mutation surfaces an error.

---

## The API surface (`lib/api/endpoints.ts`)

**All** backend calls live here, grouped per domain (`authApi`, `gamesApi`, `playersApi`, `franchisesApi`,
`matchesApi`, `standingsApi`, `announcementsApi`, `registrationsApi`, `adminApi`, `disputesApi`, `seasonsApi`,
`notificationsApi`, `mediaApi`, `auctionsApi`). Screens never call axios; hooks call these. Two conventions:

- **`clean(params)`** strips `undefined` and `""` before they hit the query string, so an empty filter never
  becomes `?status=`.
- **Empty-body → `null` coercion.** The backend returns an empty body (`""`) for "no active auction",
  "no current season", and "free agent with no franchise". Those endpoints do `.then((r) => r.data || null)`
  so `?? null` consumers never receive a truthy empty string:

```ts
mine: () => api.get<FranchiseMineView | "">("/franchises/mine").then((r) => r.data || null),
active: () => api.get<AuctionView | "">("/auctions/active").then((r) => r.data || null),
```

Cursor-paginated lists return `PageResponse<T> = { items, nextCursor, limit }` (`types.ts`); everything else
returns the DTO (or `DTO[]`) directly. Types in `lib/api/types.ts` mirror the Spring DTOs one-to-one;
`Instant` fields arrive as ISO-8601 strings (Jackson `write-dates-as-timestamps: false`).

**Recently added calls** (their hooks are below): `playersApi.usernameAvailable` (`GET
/players/username-available?username=`) + `playersApi.onboard` (`POST /players/onboard`); `auctionsApi.pool`
(`GET /auctions/pool` — the standing auction pool, readable even with no live auction); `gamesApi.myVotes` +
`gamesApi.saveVotes` (`GET /games/my-votes`, `PUT /games/votes` — community game-popularity voting);
`adminApi.updateAvatar` (`PATCH /admin/profile/avatar` — the league admin's account-level avatar). Note
`gamesApi.create`/`update` no longer send `popularity` — it's **vote-derived** server-side now.

---

## TanStack Query (`lib/query/hooks.ts`)

### Client defaults

One `QueryClient`, created once in `src/app/providers.tsx` and mounted in the root layout:

```ts
new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
```

So the baseline is a 30s freshness window, one retry, and no refocus-refetch — individual hooks widen or
override these.

### `qk` — the query-key factory

Keys are namespaced per domain in one exported object so invalidation can target a whole domain or one entity:

```ts
export const qk = {
  games: (enabled?: boolean) => ["games", { enabled }] as const,
  player: (id: string) => ["players", id] as const,
  matches: (p?: MatchListParams) => ["matches", p ?? {}] as const,
  match: (id: string) => ["matches", id] as const,
  standings: () => ["standings"] as const,
  // …
};
```

The leading segment is the domain (`"players"`, `"matches"`, `"franchises"`, …), so a mutation can call
`invalidateQueries({ queryKey: ["players"] })` to blow away every players query — list *and* detail — at once.
Some keys are inlined rather than in `qk` (e.g. `["franchises", "mine"]`, `["matches", id, "room"]`,
`["auctions", id]`); they follow the same domain-first shape.

### Per-domain stale times

The 30s default is too eager for near-static catalog data, so hooks lengthen it. Every mutation still
invalidates, so a longer window never surfaces stale data after a write:

```ts
const MINUTE = 60_000;
const STALE_STATIC = 10 * MINUTE; // catalog: games, seasons
const STALE_SEMI   = 3 * MINUTE;  // directories & standings
const STALE_LIST   = MINUTE;      // filtered lists & admin badges
```

| Constant | Value | Used by (examples) |
|----------|------:|--------------------|
| default (providers) | 30s | detail queries, per-entity fetches |
| `STALE_LIST` | 60s | `useMatches`, `useRegistrations`, `useAdminOverview`, `useSettings` |
| `STALE_SEMI` | 3m | `usePlayers`, `useFranchises`, `useStandings`, `useTopPlayers`, `useAnnouncements` |
| `STALE_STATIC` | 10m | `useGames`, `useSeasons`, `useCurrentSeason`, `useAllTimeStandings` |

### `useQuery` patterns

Detail hooks gate on the id with `enabled`, and list hooks keep the previous page visible while refetching a
new filter (`placeholderData: keepPreviousData`) so the table doesn't flash empty:

```ts
export const usePlayer = (id: string | undefined) =>
  useQuery({ queryKey: qk.player(id ?? ""), queryFn: () => playersApi.get(id!), enabled: !!id });

export const usePlayers = (params?: PlayerListParams) =>
  useQuery({
    queryKey: qk.players(params),
    queryFn: () => playersApi.list(params),
    staleTime: STALE_SEMI,
    placeholderData: keepPreviousData,   // no empty flash between filters
  });
```

### `useInfiniteQuery` — cursor pagination

The match archive and announcements feed accumulate pages via a `nextCursor`:

```ts
export const useMatchesInfinite = (params?: MatchListParams) =>
  useInfiniteQuery({
    queryKey: [...qk.matches(params), "infinite"],
    queryFn: ({ pageParam }) => matchesApi.list({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,   // stops when null
    staleTime: STALE_LIST,
    placeholderData: keepPreviousData,
  });
```

### Polling that adapts to state

Live surfaces poll via `refetchInterval` as a function of the current data, so idle pages barely poll and live
pages poll hard. The active-auction poll, for instance, is ~12x cheaper at idle than at LIVE:

```ts
refetchInterval: (q) => {                     // useActiveAuction
  const s = q.state.data?.status;
  if (!s || s === "COMPLETED") return 60_000;  // idle: slow
  return s === "LIVE" ? 5_000 : 15_000;        // live: fast
},
```

Same idea in `useMatchRoom` (`4s` while `data.live`, else stop), `useAuction` (`1.5s` LIVE / `4s` other /
stop at COMPLETED, with `refetchIntervalInBackground: false`), and `useUnreadCount` / `useMyMatchRooms`
(`30s` + `refetchOnWindowFocus`). Query v5 auto-pauses intervals while the tab is hidden. `useAuctionPool`
(the standing pool) polls `30s` **only when there's no active auction** (`enabled` gates it), so it costs
nothing during a live auction.

### Feature hooks (username, onboarding, votes, pool, admin avatar)

A handful of hooks back the newer flows:

- **`useUsernameAvailability(debouncedValue)`** — live signup/onboarding username check. Feed it an
  **already-debounced** value (the component debounces ~400ms); the query key is the value, `enabled` only at
  ≥3 chars, `retry:false`. Backs the inline ✓/✗ on the signup form and the onboarding screen.
- **`useOnboard()`** — `POST /players/onboard` (claim the immutable username + apply the optional profile);
  the onboarding screen calls `refreshUser()` after so the guard releases.
- **`useMyGameVotes(enabled)` / `useSaveGameVotes()`** — the "▲ Vote for your games" panel. Save (a full-set
  PUT replace) invalidates `["games"]`, which also covers `["games","my-votes"]`, so the popularity bars and
  the pre-selected chips both refresh.
- **`useAuctionPool(enabled)`** — described above; shared key `["auctions","pool"]` so the public auction page
  and the admin create-auction form dedupe one fetch.
- The **admin avatar** save goes through `adminApi.updateAvatar` + `refreshUser()` (no dedicated query — it
  mutates the session's `avatarUrl`).

### Mutations & cache invalidation

Two write-back strategies, chosen per mutation:

**1. Invalidate the affected domains.** A mutation calls `invalidateQueries` for every key its write can touch.
Shared helpers keep these fan-outs consistent — e.g. entering match results ripples into leaderboards,
standings, and season tables:

```ts
export const useEnterRounds = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => matchesApi.enterRounds(id, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.matchLeaderboard(v.id) });
      qc.invalidateQueries({ queryKey: qk.matchRounds(v.id) });
      qc.invalidateQueries({ queryKey: qk.match(v.id) });
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["seasons"] });
    },
  });
};
```

**2. Write the returned entity straight into cache with `setQueryData`,** then invalidate the derived lists.
Auction actions all return the full `AuctionView`, so `applyAuction` seeds `["auctions", id]` (no extra GET)
and only invalidates what an assignment/sale can move:

```ts
const applyAuction = (qc, view: AuctionView) => {
  qc.setQueryData(["auctions", view.id], view);
  qc.invalidateQueries({ queryKey: ["auctions", "active"] });
  qc.invalidateQueries({ queryKey: ["franchises"] });   // SOLD lots change rosters + balances
  qc.invalidateQueries({ queryKey: ["players"] });
};
```

The id-only auction admin actions (open-hall/join/start/pause/resume/finalize/unsold/complete/cancel) share a
tiny `useAuctionAction(fn)` factory that wraps `mutationFn` + `onSuccess: applyAuction`.

---

## Auth session store (`lib/auth/store.ts`)

A zustand store with the `persist` middleware. The design point: the **access token lives in memory only**
(XSS surface), while the **refresh token is persisted to `localStorage`** so a returning visitor stays signed
in. `partialize` enforces exactly that — only the refresh token survives a reload:

```ts
export const useAuthStore = create<AuthState>()(
  persist((set) => ({ accessToken: null, refreshToken: null, user: null, playerId: null, hydrated: false, /* … */ }), {
    name: "sq-auth",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ refreshToken: state.refreshToken }),  // access token is re-minted, never stored
  }),
);
```

State: `accessToken`, `refreshToken`, `user` (`{ id, name, email, role, adminLevel }`), `playerId` (from
`/auth/me`, or null), `gamerTag` (for building pretty `/player/<tag>` links), `avatarUrl` (drives the nav-bar
avatar — falls back **player→user**: `me.player?.avatarUrl ?? me.user?.avatarUrl ?? null`, so the league admin,
who has no player, can still have an account-level avatar), `onboardingRequired` (true while a fresh SSO
account must still pick a username — gates the whole app via `OnboardingGuard`), and `hydrated`. Actions:
`setSession(AuthResponse)`, `setUser(MeResponse)`, `setHydrated`, `clear` (which resets every field). Only the
refresh token is persisted; the rest are re-derived from `/auth/me` on load.

Because the axios interceptors run outside React, the store exposes **non-React accessors** so they can read
and rotate tokens without a hook:

```ts
export const authTokens = {
  getAccess:  () => useAuthStore.getState().accessToken,
  getRefresh: () => useAuthStore.getState().refreshToken,
  setSession: (auth) => useAuthStore.getState().setSession(auth),
  clear:      () => useAuthStore.getState().clear(),
};
```

### Hydration & the auth context (`lib/auth/context.tsx`)

`AuthProvider` wraps the store in a React context and drives first-load hydration. On mount, if a refresh
token survived in `localStorage`, it calls `GET /auth/me` (the axios interceptor silently rotates the token to
authenticate that call), populates `user`/`playerId`, and flips `hydrated`. A `mounted` flag avoids an SSR
hydration mismatch — `hydrated` reads `false` until the client mount runs.

`login` / `verifyEmail` / `googleLogin` each `setSession(...)` then best-effort `setUser(await me())`;
`signup` issues **no** session (the account must verify its email first); `logout` best-effort revokes the
refresh token server-side then `clear()`s locally regardless. `googleLogin` now returns
`{ role, onboardingRequired }` so the caller can route a brand-new SSO account to `/onboarding`. A
**`refreshUser()`** action re-fetches `/auth/me` into the store on demand — used after onboarding completes and
after the admin sets an avatar, so the session picks up the new `gamerTag`/`avatarUrl`/`onboardingRequired`
without a reload. The context also derives `isAuthenticated`, `isAdmin` (`adminLevel !== "NONE"`),
`isSuperAdmin` (`adminLevel === "SUPER_ADMIN"`), exposes `gamerTag`/`avatarUrl`/`onboardingRequired`, and
re-exports `apiErrorMessage`.

---

## Realtime auction socket (`lib/query/use-auction-socket.ts`)

The live bid room streams over WebSocket **for bidders and admins only**; spectators stay on the poll. Each
`auction.update` frame is written into the *same* `["auctions", id]` cache the poll fills, so the board
re-renders with zero extra requests:

```ts
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data as string);
  if (msg?.event === "auction.update" && msg.data)
    qc.setQueryData<AuctionView>(["auctions", auctionId], msg.data as AuctionView);
};
```

Key behaviours:

- **Token in the query string.** WS can't send an `Authorization` header, so the fresh access token goes as
  `?token=`: `wsUrl(\`/ws/live/auctions/${auctionId}?token=${encodeURIComponent(token)}\`)`. The token is read
  **per connect attempt** (`authTokens.getAccess()`), since tokens rotate.
- **Reconnect with capped backoff.** `onclose` schedules a retry at `min(1000 * 2**attempts, 15_000)` ms,
  resetting `attempts` to 0 on a successful open.
- **Heartbeat.** A `ping` every 25s while OPEN, so an idle proxy doesn't close the socket.
- **Clean teardown.** On unmount it sets `closed = true`, clears heartbeat/retry timers, and nulls
  `socket.onclose` before closing so an intentional teardown doesn't trigger a reconnect.

It's gated by an `enabled` flag the screen computes from role — mounted only when the viewer can bid:

```ts
// components/sidequest/screens/auction-bid.tsx
const canBid = !!myAF && (mine?.myRole === "OWNER" || mine?.myRole === "MANAGER");
useAuctionSocket({ auctionId: activeQ.data?.id, enabled: (canBid || isAdmin) && live });
```

`auction-bid.tsx` is the only consumer. When `enabled` is false the effect returns immediately and no socket
opens — spectators fall back to `useAuction`'s poll.

---

## Adapters (`lib/adapters/`)

Pure functions mapping backend DTOs onto the "Broadcast HUD" display shapes, so screens keep their exact
prototype JSX and **display-shaping stays out of the screens**. `league.ts` covers the public league
(`adaptGames`, `adaptFranchises`, `adaptPlayers`, `adaptUpcoming` — which now also carries each match's `slug`
for pretty links, plus `shortDate` / `shortTime` ISO formatters); `admin.ts` maps the overview DTO onto
control-room KPI/task/activity shapes.

`adaptActivity` (the admin "Recent Activity") now returns `{ time, title, meta }`: `title` is a **definitive,
human-readable label** looked up from the audit `action` code via an `ACTION_LABELS` map (~55 codes →
"Game settings updated", "Admin appointed", "Player status changed", …), and `meta` is the cleaned `detail` +
actor on a muted second line (`cleanDetail` strips bare UUIDs and dangling "from proposal"). This replaced the
old "raw detail · email" that rendered as cryptic strings when the detail was a scoring diff or a bare email.

Where the backend doesn't expose a field the prototype showed (per-player K/D, games-played, "form" trend),
the adapter falls back to a neutral placeholder (`—`) rather than inventing a number — see the honest comments
in `adaptGames` / `adaptPlayers`. Dates are formatted deterministically (no locale string) to stay stable
across environments.

---

## Limitations

- **No cache persistence.** The Query cache is in-memory; a hard reload refetches. Only the refresh token
  persists (auth store).
- **No optimistic updates.** Mutations wait for the server response, then either `setQueryData` the returned
  entity or invalidate. Correctness over snappiness — acceptable given how fast the endpoints are, and it
  avoids rollback logic for the league's strict server-owned rules.
- **Realtime is auction-only.** Only the bid room uses WebSockets; every other live surface (match room,
  notifications, active-auction banner) is adaptive polling. That's a deliberate scope line, not an
  architectural limit.
- **Env is build-time.** `NEXT_PUBLIC_API_URL` and thus the WS origin are frozen at `next build`; there is no
  runtime reconfiguration. Rebuild to change the backend target.
- **No automated tests for this layer.** The quality gate is `npm run typecheck` (`tsc --noEmit`) +
  `next build` + ad-hoc Playwright E2E — see [./testing.md](./testing.md). There is no unit/component suite
  over the hooks, adapters, or interceptors.
