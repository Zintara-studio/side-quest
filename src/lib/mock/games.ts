import type { Game } from "@/lib/types";

export const games: Game[] = [
  {
    id: "valorant",
    name: "Valorant",
    tagline: "Tactical 5v5 shooter",
    accent: "pink",
    cover:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80",
    players: 18432,
    tournaments: 124,
  },
  {
    id: "cs2",
    name: "Counter-Strike 2",
    tagline: "The benchmark of FPS esports",
    accent: "amber",
    cover:
      "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&q=80",
    players: 22118,
    tournaments: 187,
  },
  {
    id: "bgmi",
    name: "BGMI",
    tagline: "Battle royale at scale",
    accent: "electric",
    cover:
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&q=80",
    players: 30210,
    tournaments: 96,
  },
  {
    id: "dota2",
    name: "Dota 2",
    tagline: "5v5 MOBA, the eternal game",
    accent: "purple",
    cover:
      "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&q=80",
    players: 14778,
    tournaments: 110,
  },
  {
    id: "marvel-rivals",
    name: "Marvel Rivals",
    tagline: "Hero shooter, super-powered teamfights",
    accent: "lime",
    cover:
      "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1200&q=80",
    players: 9320,
    tournaments: 41,
  },
];

export const gameById = (id: string) => games.find((g) => g.id === id);
