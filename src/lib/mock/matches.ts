import type { Match } from "@/lib/types";
import { franchises } from "./franchises";

const now = Date.now();
const hr = 3_600_000;

function teamFromFranchise(idx: number, score: number) {
  const f = franchises[idx % franchises.length];
  return {
    id: f.id,
    name: f.name,
    tag: f.tag,
    logo: f.logo,
    score,
  };
}

export const matches: Match[] = [
  {
    id: "m-001",
    tournamentId: "iem-rio-major",
    game: "cs2",
    teamA: teamFromFranchise(3, 13),
    teamB: teamFromFranchise(4, 9),
    status: "live",
    scheduledAt: new Date(now - hr).toISOString(),
    bestOf: 3,
    round: "Quarterfinal",
  },
  {
    id: "m-002",
    tournamentId: "iem-rio-major",
    game: "cs2",
    teamA: teamFromFranchise(0, 16),
    teamB: teamFromFranchise(1, 12),
    status: "live",
    scheduledAt: new Date(now - 2 * hr).toISOString(),
    bestOf: 3,
    round: "Quarterfinal",
  },
  {
    id: "m-003",
    tournamentId: "vct-champions-2026",
    game: "valorant",
    teamA: teamFromFranchise(0, 0),
    teamB: teamFromFranchise(2, 0),
    status: "scheduled",
    scheduledAt: new Date(now + 4 * 24 * hr).toISOString(),
    bestOf: 5,
    round: "Group Stage",
  },
  {
    id: "m-004",
    tournamentId: "vct-champions-2026",
    game: "valorant",
    teamA: teamFromFranchise(1, 0),
    teamB: teamFromFranchise(2, 0),
    status: "scheduled",
    scheduledAt: new Date(now + 5 * 24 * hr).toISOString(),
    bestOf: 3,
    round: "Group Stage",
  },
  {
    id: "m-005",
    tournamentId: "bgmi-pro-series",
    game: "bgmi",
    teamA: teamFromFranchise(5, 0),
    teamB: teamFromFranchise(3, 0),
    status: "scheduled",
    scheduledAt: new Date(now + 9 * 24 * hr).toISOString(),
    bestOf: 1,
    round: "Round 1",
  },
  {
    id: "m-006",
    tournamentId: "iem-rio-major",
    game: "cs2",
    teamA: teamFromFranchise(4, 2),
    teamB: teamFromFranchise(3, 1),
    status: "completed",
    scheduledAt: new Date(now - 26 * hr).toISOString(),
    bestOf: 3,
    round: "Group B",
  },
];

export const liveMatches = () => matches.filter((m) => m.status === "live");
export const matchById = (id: string) => matches.find((m) => m.id === id);
