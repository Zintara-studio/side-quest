# Caching — High-Level Design

## Problem
The public browse pages (home, games, franchises, players, leaderboards) are read far more often
than the underlying data changes, yet every request re-ran list queries and, for standings, walked
all result rows. Under load (and on cold JVM) these reads dominated latency.

## Goals
- Cut latency and DB work on the hottest, mostly-static **read** paths.
- Never serve materially stale data for long; correctness must self-heal.
- Zero new infrastructure for the current single-instance deployment.
- Be invisible to controllers/clients (no API or contract change).

## Non-goals
- Caching per-user or mutating endpoints (`/auth/*`, `/me`, `/notifications`, registrations,
  admin writes). These are user-specific or must be immediately consistent.
- A distributed cache. Not needed at one instance; see "Scaling out".

## Design
**Spring Cache abstraction + Caffeine** (in-process, bounded, TTL'd). Chosen over Redis because the
app is single-instance today; Caffeine adds no ops and is a one-line swap to Redis later.

Cache manager: `CacheConfig` — `expireAfterWrite = 45s`, `maximumSize = 500` per cache.

| Cache | Populated by | Why hot |
|---|---|---|
| `games` | `GameService.list` | every games page + home |
| `standings` | `StandingsService.standings` | home + franchises table |
| `leaderboard-players` | `StandingsService.topPlayers` | home + players leaderboard |
| `game-rankings` | `StandingsService.gameRankings` | per-title pages |
| `franchises` | `FranchiseService.list` | home + franchises |
| `players` | `PlayerService.list` | home best-player + players |

Keys are the method arguments (Spring `SimpleKey`), so different filter/limit combos cache
independently.

### Consistency
Two layers, belt-and-suspenders:
1. **TTL (45s)** — an upper bound on staleness even if an eviction is missed.
2. **Explicit eviction on writes** (`@CacheEvict allEntries`):
   - `ScoringService.onResultsPublished` / `recomputeStandings` → evict `standings`,
     `leaderboard-players`, `game-rankings`, `franchises`, `players` (a result publish changes all
     standings-derived data).
   - `GameService.update` → evict `games`.
   - `FranchiseService.create/update/assignPlayer` → evict `franchises`, `players`.
   - `PlayerService.update/updateStatus` → evict `players`.

Eviction is `beforeInvocation=false` (after the transaction's method returns), so a failed write
leaves the cache untouched.

## Trade-offs
- Up to 45s of staleness on read paths with no corresponding write — acceptable for league
  browse data (not money, not auth).
- `allEntries` eviction is coarse (drops the whole cache, not one key) but correct and simple; the
  caches are small and repopulate on the next read.

## Scaling out (future)
- Swap `CaffeineCacheManager` for `RedisCacheManager` (same annotations, no service changes) when
  running multiple instances, so eviction is shared.
- Add cache hit/miss metrics via Actuator + Micrometer (`cache.gets`, `cache.evictions`).
- Consider per-key eviction and longer TTLs once hit rates are measured.

## Frontend complement
TanStack Query already caches on the client (`staleTime` 30s, no refetch-on-focus). The server
cache reduces origin latency on the first/SSR fetch and shared cold reads; together they keep the
browse pages snappy.
