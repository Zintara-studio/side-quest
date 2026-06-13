// Sample data for the player-facing Side Quest league ("Broadcast HUD").
// Mirrors the design prototype — visual prototype, no live backend.
import { SQ } from "@/components/sidequest/tokens";

export type AnnouncementTag = "RESULT" | "LEAGUE" | "RECAP";

export interface Standing {
  rank: string;
  name: string;
  sub: string;
  gp: number;
  w: number;
  pts: number;
  best: string;
  form: string;
  formColor: string;
}

export interface PlayerRow {
  rank: string;
  name: string;
  fr: string;
  gp: number;
  pts: number;
  tags: string;
}

export interface GameCard {
  name: string;
  players: number;
  pop: number;
  next: string;
  format: string;
}

export interface ResultRow {
  rank: string;
  team: string;
  kills: number;
  place: string;
  total: string;
}

export interface Announcement {
  tag: AnnouncementTag;
  title: string;
  date: string;
}

export interface LabelValue {
  label: string;
  value: string;
}

const G = SQ.green,
  R = SQ.ember,
  D = SQ.mute;

const mk = (
  rank: string,
  name: string,
  sub: string,
  gp: number,
  w: number,
  pts: number,
  best: string,
  form: string,
  formColor: string,
): Standing => ({ rank, name, sub, gp, w, pts, best, form, formColor });

export const standingsAll: Standing[] = [
  mk("01", "RXG", "RAGING X", 18, 14, 224, "Raghavan", "▲2", G),
  mk("02", "MOTICHOOR", "", 18, 13, 218, "Aarav S.", "▲1", G),
  mk("03", "NIGHTFALL", "", 18, 12, 205, "Sora", "—", D),
  mk("04", "COBRA UNIT", "", 18, 11, 197, "Devang", "▼1", R),
  mk("05", "LOTUS ESPORTS", "", 18, 10, 188, "Khel", "▲3", G),
  mk("06", "VIPERS GC", "", 18, 9, 176, "Rohit V.", "▼2", R),
  mk("07", "PHANTOM9", "", 18, 8, 169, "Ali R.", "▲1", G),
  mk("08", "APEX OWLS", "", 18, 7, 154, "Meera", "—", D),
  mk("09", "RONIN", "", 18, 6, 142, "Yuki", "▼1", R),
  mk("10", "BLITZ GG", "", 18, 5, 131, "Sam", "▲2", G),
  mk("11", "HALON", "", 18, 4, 118, "Priya", "—", D),
  mk("12", "OUTLAWS", "", 18, 3, 104, "Zed", "▼1", R),
];

export const standingsTop = standingsAll.slice(0, 6);

export const players: PlayerRow[] = [
  { rank: "01", name: "Raghavan", fr: "RXG", gp: 18, pts: 224, tags: "VAL" },
  { rank: "02", name: "Aarav S.", fr: "MOTICHOOR", gp: 17, pts: 218, tags: "BGMI·FF" },
  { rank: "03", name: "Sora", fr: "NIGHTFALL", gp: 18, pts: 205, tags: "VAL·BGMI" },
  { rank: "04", name: "Devang", fr: "COBRA UNIT", gp: 18, pts: 197, tags: "CS2" },
  { rank: "05", name: "Khel", fr: "LOTUS", gp: 18, pts: 188, tags: "VAL·SMK" },
  { rank: "06", name: "Aginov", fr: "VIPERS GC", gp: 16, pts: 176, tags: "VAL·CS2" },
  { rank: "07", name: "Ali R.", fr: "PHANTOM9", gp: 18, pts: 169, tags: "BGMI" },
  { rank: "08", name: "Meera", fr: "APEX OWLS", gp: 15, pts: 154, tags: "FF" },
  { rank: "09", name: "Yuki", fr: "RONIN", gp: 16, pts: 142, tags: "VAL·R6" },
  { rank: "10", name: "Sam", fr: "BLITZ GG", gp: 14, pts: 131, tags: "SMK" },
];

export const games: GameCard[] = [
  { name: "VALORANT", players: 120, pop: 92, next: "22 APR", format: "5v5 · BO3" },
  { name: "BGMI", players: 96, pop: 88, next: "22 APR", format: "SQUAD" },
  { name: "COUNTER-STRIKE 2", players: 84, pop: 80, next: "23 APR", format: "5v5" },
  { name: "SMASHKARTS", players: 64, pop: 74, next: "23 APR", format: "FFA" },
  { name: "FREE FIRE", players: 78, pop: 83, next: "24 APR", format: "SQUAD" },
  { name: "RAINBOW SIX", players: 44, pop: 61, next: "25 APR", format: "5v5" },
];

export const resultRows: ResultRow[] = [
  { rank: "01", team: "RXG", kills: 38, place: "+28", total: "66" },
  { rank: "02", team: "Nightfall", kills: 31, place: "+24", total: "55" },
  { rank: "03", team: "Motichoor", kills: 27, place: "+22", total: "49" },
  { rank: "04", team: "Cobra Unit", kills: 24, place: "+18", total: "42" },
  { rank: "05", team: "Lotus Esports", kills: 19, place: "+15", total: "34" },
  { rank: "06", team: "Vipers GC", kills: 16, place: "+12", total: "28" },
];

export const announcements: Announcement[] = [
  { tag: "RESULT", title: "BGMI Match 3 — RXG take 1st place", date: "21 APR" },
  { tag: "RESULT", title: "Valo Match 1 — Motichoor edge a 13–11 thriller", date: "20 APR" },
  { tag: "LEAGUE", title: "Franchise Auction completed — see final rosters", date: "18 APR" },
  { tag: "LEAGUE", title: "Season 04 fixtures released", date: "15 APR" },
  { tag: "RECAP", title: "Season 03 — full post-season report", date: "10 APR" },
];

export const announceShort = announcements.slice(0, 4);

export const statTiles: LabelValue[] = [
  { label: "ACTIVE FRANCHISES", value: "12" },
  { label: "REGISTERED PLAYERS", value: "486" },
  { label: "MATCHES PLAYED", value: "94" },
  { label: "PRIZE POOL", value: "₹2.4L" },
];

export const upcoming = [
  { day: "22", mon: "APR", meta: "VALORANT · 18:30", title: "RXG vs Nightfall" },
  { day: "22", mon: "APR", meta: "BGMI · 19:30", title: "All-Squad Lobby · 16 teams" },
  { day: "23", mon: "APR", meta: "CS2 · 17:00", title: "Motichoor vs Vipers" },
  { day: "23", mon: "APR", meta: "SMASHKARTS · 20:00", title: "Free-For-All Cup" },
];

export const rosterA = [
  { name: "Raghavan", kd: "1.42" },
  { name: "Sora X", kd: "1.18" },
  { name: "Neo", kd: "1.05" },
  { name: "Vex", kd: "0.98" },
  { name: "Jin", kd: "1.11" },
];

export const rosterB = [
  { name: "Kael", kd: "1.21" },
  { name: "Mira", kd: "1.09" },
  { name: "Dusk", kd: "0.94" },
  { name: "Ryo", kd: "1.02" },
  { name: "Pax", kd: "0.88" },
];

export const gameChips = [
  { label: "Valorant · Pro", selected: true },
  { label: "BGMI · Inter", selected: true },
  { label: "CS2", selected: false },
  { label: "Smashkarts", selected: false },
  { label: "Free Fire", selected: false },
  { label: "Rainbow Six", selected: false },
];

export const sortChips = [
  { label: "Franchise", selected: true },
  { label: "A–Z", selected: false },
  { label: "Z–A", selected: false },
  { label: "Games", selected: false },
  { label: "Points", selected: false },
];

export const teammates = [
  { text: "Sora X — added", invited: true },
  { text: "Search players…", invited: false },
  { text: "Search players…", invited: false },
];

export const playerStats: LabelValue[] = [
  { label: "K/D RATIO", value: "1.42" },
  { label: "MATCHES", value: "18" },
  { label: "TOTAL POINTS", value: "224" },
  { label: "WIN RATE", value: "72%" },
];

export const usernames = [
  { handle: "@raghavan#9021", game: "VALORANT", vis: "PUBLIC" },
  { handle: "RXG_Raghav", game: "PUBG / BGMI", vis: "PUBLIC" },
  { handle: "raghav.smk", game: "SMASHKARTS", vis: "PRIVATE" },
];

export const playerMatches = [
  { match: "BGMI All-Squad", date: "22 MAR", kills: "8", rank: "#12", rankColor: SQ.slate },
  { match: "Valo Match 1", date: "20 APR", kills: "24", rank: "#2", rankColor: SQ.ink },
  { match: "CS2 Match 2", date: "18 APR", kills: "19", rank: "#3", rankColor: SQ.ink },
  { match: "Valo Match 4", date: "14 APR", kills: "27", rank: "#1", rankColor: SQ.red },
  { match: "BGMI Match 3", date: "21 APR", kills: "11", rank: "#1", rankColor: SQ.red },
];

export const franchiseStats: LabelValue[] = [
  { label: "KILLS", value: "412" },
  { label: "AVG SURVIVAL", value: "18m" },
  { label: "DEATHS", value: "276" },
  { label: "DAMAGE", value: "1.2M" },
];

export const roster = [
  { name: "Raghavan", role: "IGL · VALORANT", pts: "224" },
  { name: "Sora X", role: "DUELIST", pts: "198" },
  { name: "Neo", role: "CONTROLLER", pts: "176" },
  { name: "Vex", role: "SENTINEL", pts: "154" },
  { name: "Jin", role: "INITIATOR", pts: "142" },
];

export const franchiseGames = [
  { match: "Valo Match 1", players: "Raghavan, Sora, Neo +2", pts: "+28", rank: "#2" },
  { match: "BGMI Match 3", players: "Full squad", pts: "+34", rank: "#1" },
  { match: "CS2 Match 2", players: "Neo, Vex, Jin +2", pts: "+22", rank: "#3" },
  { match: "Valo Match 4", players: "Raghavan, Sora +3", pts: "+30", rank: "#1" },
  { match: "Smashkarts Cup", players: "Vex, Jin", pts: "+18", rank: "#4" },
];
