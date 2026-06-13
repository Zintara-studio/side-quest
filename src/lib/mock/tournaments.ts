import type { Tournament } from "@/lib/types";

const now = Date.now();
const day = 86_400_000;

export const tournaments: Tournament[] = [
  {
    id: "vct-champions-2026",
    name: "VCT Champions 2026",
    game: "valorant",
    format: "double-elim",
    startsAt: new Date(now + 4 * day).toISOString(),
    endsAt: new Date(now + 18 * day).toISOString(),
    status: "upcoming",
    prizePool: 2_250_000,
    teamCount: 16,
    region: "Global",
    cover:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80",
    organizer: "Riot Esports",
  },
  {
    id: "iem-rio-major",
    name: "IEM Rio Major",
    game: "cs2",
    format: "swiss",
    startsAt: new Date(now - 1 * day).toISOString(),
    endsAt: new Date(now + 11 * day).toISOString(),
    status: "live",
    prizePool: 1_500_000,
    teamCount: 24,
    region: "Global",
    cover:
      "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80",
    organizer: "ESL",
  },
  {
    id: "bgmi-pro-series",
    name: "BGMI Pro Series Season 4",
    game: "bgmi",
    format: "group",
    startsAt: new Date(now + 9 * day).toISOString(),
    endsAt: new Date(now + 38 * day).toISOString(),
    status: "upcoming",
    prizePool: 600_000,
    teamCount: 32,
    region: "APAC",
    cover:
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80",
    organizer: "Krafton",
  },
  {
    id: "ti-international",
    name: "The International 14",
    game: "dota2",
    format: "double-elim",
    startsAt: new Date(now + 60 * day).toISOString(),
    endsAt: new Date(now + 78 * day).toISOString(),
    status: "upcoming",
    prizePool: 25_000_000,
    teamCount: 18,
    region: "Global",
    cover:
      "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1600&q=80",
    organizer: "Valve",
  },
  {
    id: "marvel-clash",
    name: "Marvel Rivals Clash",
    game: "marvel-rivals",
    format: "single-elim",
    startsAt: new Date(now - 12 * day).toISOString(),
    endsAt: new Date(now - 2 * day).toISOString(),
    status: "completed",
    prizePool: 250_000,
    teamCount: 12,
    region: "Global",
    cover:
      "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1600&q=80",
    organizer: "NetEase",
  },
];

export const tournamentById = (id: string) =>
  tournaments.find((t) => t.id === id);
