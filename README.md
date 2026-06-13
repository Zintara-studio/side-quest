# Esports Arena

A futuristic, production-grade frontend for a multi-game esports management platform — tournaments, franchises, live auctions, rankings, and analytics.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS + custom design tokens
- Framer Motion · Recharts · React Hook Form + Zod
- TanStack Query · Radix primitives
- Mock data + simulated socket layer (no backend required)

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Pages

| Path | What's in it |
| --- | --- |
| `/` | Cinematic landing — hero, featured tournaments, live matches, top players, franchise rankings, live auction banner, animated stats, sponsors marquee |
| `/games/[game]` | Game hub: rankings, tournaments, teams, meta stats (try `valorant`, `cs2`, `bgmi`, `dota2`, `marvel-rivals`) |
| `/players/[id]` | Player profile with banner, KPI row, performance chart, radar, map proficiency, career timeline, achievements (try `nyx`, `asphalt`) |
| `/franchises/[id]` | Franchise dashboard: KPIs, roster, recent matches, analytics, operations grid (try `sentinels-cipher`) |
| `/tournaments/[id]` | Tournament with bracket viz, schedule, standings, MVP race (try `vct-champions-2026`, `iem-rio-major`) |
| `/auction/[id]` | Live auction room — animated bid card, simulated socket bid feed, franchise wallets, AI fair-value, chat |
| `/leaderboards` | Filterable, sortable global rankings |
| `/login`, `/signup`, `/2fa`, `/forgot-password` | Polished auth UI (form validation only — no real auth) |

## Project layout

```
src/
├── app/                  # App Router pages
│   ├── (auth)/           # Auth route group
│   ├── games/[game]/
│   ├── players/[id]/
│   ├── franchises/[id]/
│   ├── tournaments/[id]/
│   ├── auction/[id]/
│   └── leaderboards/
├── components/
│   ├── ui/               # Primitives — button, card, badge, tabs, etc.
│   ├── common/           # Section, StatCard, AnimatedCounter, Countdown, LiveIndicator
│   ├── layout/           # TopNav, MobileNav, Footer, Logo
│   ├── landing/          # Hero, GamesStrip, FeaturedTournaments, ...
│   ├── auction/          # AuctionRoom
│   ├── player/           # PerformanceChart, Radar
│   └── tournament/       # Bracket
├── lib/
│   ├── mock/             # Players, franchises, tournaments, matches, games
│   ├── socket/           # MockSocket — simulates bid:new events
│   ├── types.ts
│   └── utils.ts
└── providers/            # QueryProvider (TanStack)
```

## Design system

- Dark, futuristic, glassmorphic — neon electric blue + purple + pink gradient accents.
- All animations powered by Framer Motion and CSS keyframes (shimmer, marquee, pulse-glow, scan).
- Custom scrollbar, gradient text utility, glass / panel / neon-border classes in `globals.css`.

## What's mocked

- All data lives in `src/lib/mock/*`.
- The auction room uses a `MockSocket` that emits randomized `bid:new` events every 2–5s.
- No real authentication — form validation only.
