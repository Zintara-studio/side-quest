export type GameId = "valorant" | "bgmi" | "marvel-rivals" | "cs2" | "dota2";

export interface Game {
  id: GameId;
  name: string;
  tagline: string;
  accent: "electric" | "purple" | "pink" | "lime" | "amber";
  cover: string;
  players: number;
  tournaments: number;
}

export type PlayerStatus =
  | "free-agent"
  | "signed"
  | "loaned"
  | "retired"
  | "benched";

export interface Player {
  id: string;
  handle: string;
  realName: string;
  country: string;
  countryCode: string;
  game: GameId;
  role: string;
  rating: number;
  rank: number;
  status: PlayerStatus;
  franchiseId?: string;
  avatar: string;
  banner: string;
  age: number;
  kd: number;
  acs: number;
  hsPct: number;
  winRate: number;
  mvpCount: number;
  matchesPlayed: number;
  earnings: number;
  followers: number;
  signedYear?: number;
  socials: { twitch?: string; twitter?: string; youtube?: string };
}

export interface Franchise {
  id: string;
  name: string;
  tag: string;
  region: string;
  game: GameId;
  logo: string;
  banner: string;
  founded: number;
  ranking: number;
  wins: number;
  losses: number;
  trophies: number;
  budget: number;
  walletBalance: number;
  rosterSize: number;
  primaryColor: string;
}

export interface Tournament {
  id: string;
  name: string;
  game: GameId;
  format: "single-elim" | "double-elim" | "swiss" | "group";
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "live" | "completed";
  prizePool: number;
  teamCount: number;
  region: string;
  cover: string;
  organizer: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  game: GameId;
  teamA: { id: string; name: string; tag: string; score: number; logo: string };
  teamB: { id: string; name: string; tag: string; score: number; logo: string };
  status: "scheduled" | "live" | "completed";
  scheduledAt: string;
  bestOf: 1 | 3 | 5;
  round?: string;
}

export interface BidEvent {
  id: string;
  ts: number;
  franchiseId: string;
  franchiseTag: string;
  amount: number;
}

export interface AuctionState {
  id: string;
  currentPlayerId: string;
  currentBid: number;
  topFranchiseId: string;
  basePrice: number;
  endsAt: number;
  bidHistory: BidEvent[];
  round: number;
  totalRounds: number;
}
