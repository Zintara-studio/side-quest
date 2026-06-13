import type { Player } from "@/lib/types";

const seeds = [
  ["nyx", "Aarav Mehta", "IN", "🇮🇳", "valorant", "Duelist"],
  ["zaph", "Lukas Brandt", "DE", "🇩🇪", "valorant", "Controller"],
  ["k0re", "Diego Alvarez", "BR", "🇧🇷", "valorant", "Initiator"],
  ["rune", "Min-Jae Park", "KR", "🇰🇷", "valorant", "Sentinel"],
  ["echo", "Olivia Smith", "US", "🇺🇸", "valorant", "IGL"],
  ["asphalt", "Yusuf Demir", "TR", "🇹🇷", "cs2", "AWPer"],
  ["vortex", "Anna Kovacs", "HU", "🇭🇺", "cs2", "Rifler"],
  ["pivot", "Carlos Mendes", "PT", "🇵🇹", "cs2", "IGL"],
  ["shadow", "Wei Zhang", "CN", "🇨🇳", "cs2", "Support"],
  ["forge", "Henrik Lund", "SE", "🇸🇪", "cs2", "Entry"],
  ["jaguar", "Rahul Verma", "IN", "🇮🇳", "bgmi", "Assaulter"],
  ["ranger", "Akash Nair", "IN", "🇮🇳", "bgmi", "Sniper"],
  ["pulse", "Hiro Tanaka", "JP", "🇯🇵", "bgmi", "IGL"],
  ["axiom", "Erik Møller", "NO", "🇳🇴", "dota2", "Mid"],
  ["myth", "Sasha Ivanov", "RU", "🇷🇺", "dota2", "Carry"],
  ["fable", "Pietro Conti", "IT", "🇮🇹", "marvel-rivals", "DPS"],
] as const;

const franchiseMap: Record<string, string | undefined> = {
  nyx: "sentinels-cipher",
  zaph: "neon-dynasty",
  k0re: "sentinels-cipher",
  rune: "void-pulse",
  echo: "neon-dynasty",
  asphalt: "arc-titans",
  vortex: "phantom-corps",
  pivot: "arc-titans",
  shadow: "phantom-corps",
  forge: undefined,
  jaguar: "hyperion-bgmi",
  ranger: "hyperion-bgmi",
  pulse: undefined,
  axiom: undefined,
  myth: undefined,
  fable: undefined,
};

const statusMap: Record<string, Player["status"]> = {
  forge: "free-agent",
  pulse: "free-agent",
  axiom: "free-agent",
  myth: "loaned",
  fable: "free-agent",
};

export const players: Player[] = seeds.map(
  ([handle, realName, country, flag, game, role], i) => {
    const id = handle as string;
    return {
      id,
      handle: handle as string,
      realName: realName as string,
      country: country as string,
      countryCode: flag as string,
      game: game as Player["game"],
      role: role as string,
      rating: +(1.45 - i * 0.04).toFixed(2),
      rank: i + 1,
      status: statusMap[id] ?? "signed",
      franchiseId: franchiseMap[id],
      avatar: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${handle}`,
      banner: `https://images.unsplash.com/photo-${
        ["1542751371-adc38448a05e", "1538481199705-c710c4e965fc", "1511512578047-dfb367046420", "1493711662062-fa541adb3fc8"][i % 4]
      }?w=1600&q=80`,
      age: 19 + ((i * 3) % 11),
      kd: +(1.4 - i * 0.03).toFixed(2),
      acs: 280 - i * 7,
      hsPct: 38 - i,
      winRate: 72 - i,
      mvpCount: 18 - i,
      matchesPlayed: 412 - i * 9,
      earnings: 480_000 - i * 22_000,
      followers: 1_800_000 - i * 80_000,
      signedYear: 2022 + (i % 3),
      socials: {
        twitch: `https://twitch.tv/${handle}`,
        twitter: `https://twitter.com/${handle}`,
        youtube: `https://youtube.com/@${handle}`,
      },
    };
  },
);

export const playerById = (id: string) => players.find((p) => p.id === id);
export const playersByGame = (game: string) =>
  players.filter((p) => p.game === game);
export const playersByFranchise = (id: string) =>
  players.filter((p) => p.franchiseId === id);
