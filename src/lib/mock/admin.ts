// Sample data for the Side Quest admin control room ("Broadcast HUD").
// Mirrors the design prototype's content — visual prototype, no live backend.

export type MatchStatus = "Live" | "Scheduled" | "Awaiting result" | "Completed";
export type PlayerStatus = "Verified" | "Pending" | "Flagged";
export type AnnouncementTag = "RESULT" | "LEAGUE" | "RECAP";

export interface AdminKpi {
  label: string;
  value: string;
  dot: string;
  delta: string;
  deltaColor: string;
  border: string;
}

export interface AdminTask {
  dot: string;
  title: string;
  meta: string;
  btn: string;
  href: string;
  primary: boolean;
}

export interface AdminActivity {
  time: string;
  text: string;
}

export interface AdminMatch {
  title: string;
  teams: string;
  game: string;
  when: string;
  status: MatchStatus;
}

export interface ResultRow {
  place: string;
  team: string;
  kills: number;
  placePts: string;
  total: string;
}

export interface PendingReg {
  name: string;
  meta: string;
  tags: string[];
}

export interface AdminFranchise {
  rank: string;
  name: string;
  sub: string;
  igl: string;
  players: number;
  pts: number;
}

export interface AdminPlayer {
  name: string;
  franchise: string;
  games: string;
  status: PlayerStatus;
}

export interface AdminAnnouncement {
  tag: AnnouncementTag;
  title: string;
  date: string;
}

export interface AdminGame {
  name: string;
  on: boolean;
  format: string;
  players: number;
  reg: "Open" | "Closed";
}

export const adminKpis: AdminKpi[] = [
  {
    label: "PENDING REGISTRATIONS",
    value: "14",
    dot: "#E0A82E",
    delta: "+5 today",
    deltaColor: "#E0A82E",
    border: "rgba(224,168,46,.35)",
  },
  {
    label: "MATCHES THIS WEEK",
    value: "6",
    dot: "#7FB2FF",
    delta: "2 live now",
    deltaColor: "#8A8C93",
    border: "rgba(255,255,255,.09)",
  },
  {
    label: "RESULTS TO ENTER",
    value: "3",
    dot: "#FF3D2E",
    delta: "oldest 2d ago",
    deltaColor: "#FF6A5E",
    border: "rgba(255,61,46,.35)",
  },
  {
    label: "OPEN DISPUTES",
    value: "1",
    dot: "#FF3D2E",
    delta: "BGMI M2 score",
    deltaColor: "#FF6A5E",
    border: "rgba(255,61,46,.35)",
  },
];

export const adminTasks: AdminTask[] = [
  {
    dot: "#E0A82E",
    title: "14 registrations awaiting review",
    meta: "8 PLAYERS · 6 SQUADS",
    btn: "Review",
    href: "/admin/registrations",
    primary: true,
  },
  {
    dot: "#FF3D2E",
    title: "BGMI All-Squad — enter result",
    meta: "PLAYED 2D AGO · MATCHDAY 18",
    btn: "Enter",
    href: "/admin/matches/result",
    primary: true,
  },
  {
    dot: "#FF3D2E",
    title: "Dispute: BGMI M2 placement points",
    meta: "RAISED BY VIPERS GC",
    btn: "Resolve",
    href: "/admin/matches",
    primary: false,
  },
  {
    dot: "#7FB2FF",
    title: "Valorant Matchday 19 needs scheduling",
    meta: "4 FIXTURES UNSET",
    btn: "Schedule",
    href: "/admin/matches",
    primary: false,
  },
];

export const adminActivity: AdminActivity[] = [
  { time: "09:42", text: "Raghavan (RXG) approved by Dev Mehta" },
  { time: "09:10", text: "BGMI Match 3 result published — RXG 1st" },
  { time: "08:55", text: "Squad “Nightowls” submitted for review" },
  { time: "Yest", text: "Franchise auction closed — 12 rosters locked" },
  { time: "Yest", text: "Season 04 fixtures generated (24 matchdays)" },
  { time: "2d", text: "Nisha (MOD) added to admin team" },
];

export const matchFilters = ["All", "Scheduled", "Live", "Completed"] as const;

export const adminMatches: AdminMatch[] = [
  { title: "Valo Match 1", teams: "RXG vs Nightfall", game: "VALORANT", when: "22 APR 18:30", status: "Live" },
  { title: "BGMI All-Squad Lobby", teams: "16 squads", game: "BGMI", when: "20 APR 19:30", status: "Awaiting result" },
  { title: "CS2 Match 2", teams: "Motichoor vs Vipers", game: "CS2", when: "23 APR 17:00", status: "Scheduled" },
  { title: "Smashkarts Cup", teams: "Free-for-all", game: "SMASHKARTS", when: "23 APR 20:00", status: "Scheduled" },
  { title: "BGMI Match 3", teams: "16 squads", game: "BGMI", when: "19 APR 19:30", status: "Completed" },
  { title: "Valo Match 4", teams: "Lotus vs Phantom9", game: "VALORANT", when: "18 APR 18:00", status: "Completed" },
];

export const adminResultEntry: ResultRow[] = [
  { place: "1", team: "RXG", kills: 12, placePts: "+15", total: "27" },
  { place: "2", team: "Nightfall", kills: 9, placePts: "+12", total: "21" },
  { place: "3", team: "Motichoor", kills: 8, placePts: "+10", total: "18" },
  { place: "4", team: "Cobra Unit", kills: 6, placePts: "+8", total: "14" },
  { place: "5", team: "Lotus Esports", kills: 5, placePts: "+6", total: "11" },
  { place: "6", team: "Vipers GC", kills: 4, placePts: "+4", total: "8" },
];

export const adminPending: PendingReg[] = [
  { name: "Kabir Sethi", meta: "@kabir · APPLIED 22 APR", tags: ["VALORANT · PRO", "CS2 · INTER"] },
  { name: "Ananya Rao", meta: "@anny · APPLIED 22 APR", tags: ["BGMI · PRO"] },
  { name: "Squad: Nightowls", meta: "4 PLAYERS · IGL @rev", tags: ["BGMI", "FREE-FOR-ALL"] },
  { name: "Tariq Khan", meta: "@tk · APPLIED 21 APR", tags: ["FREE FIRE · INTER"] },
  { name: "Squad: Quasar", meta: "5 PLAYERS · IGL @maya", tags: ["VALORANT", "FRANCHISE"] },
  { name: "Ishaan Verma", meta: "@ish · APPLIED 21 APR", tags: ["SMASHKARTS", "BGMI"] },
];

export const adminFranchises: AdminFranchise[] = [
  { rank: "01", name: "RXG", sub: "RAGING X", igl: "Raghavan", players: 5, pts: 224 },
  { rank: "02", name: "MOTICHOOR", sub: "", igl: "Aarav S.", players: 5, pts: 218 },
  { rank: "03", name: "NIGHTFALL", sub: "", igl: "Sora", players: 5, pts: 205 },
  { rank: "04", name: "COBRA UNIT", sub: "", igl: "Devang", players: 5, pts: 197 },
  { rank: "05", name: "LOTUS ESPORTS", sub: "", igl: "Khel", players: 4, pts: 188 },
  { rank: "06", name: "VIPERS GC", sub: "", igl: "Rohit V.", players: 5, pts: 176 },
];

export const adminPlayers: AdminPlayer[] = [
  { name: "Raghavan", franchise: "RXG", games: "VAL", status: "Verified" },
  { name: "Aarav S.", franchise: "MOTICHOOR", games: "BGMI·FF", status: "Verified" },
  { name: "Kabir Sethi", franchise: "— Unassigned", games: "VAL·CS2", status: "Pending" },
  { name: "Sora", franchise: "NIGHTFALL", games: "VAL·BGMI", status: "Verified" },
  { name: "Ananya Rao", franchise: "— Unassigned", games: "BGMI", status: "Pending" },
  { name: "Zed", franchise: "OUTLAWS", games: "VAL", status: "Flagged" },
  { name: "Khel", franchise: "LOTUS", games: "VAL·SMK", status: "Verified" },
  { name: "Meera", franchise: "APEX OWLS", games: "FF", status: "Verified" },
];

export const adminAnnouncements: AdminAnnouncement[] = [
  { tag: "RESULT", title: "BGMI Match 3 — RXG take 1st place", date: "21 APR · LIVE" },
  { tag: "RESULT", title: "Valo Match 1 — Motichoor edge it", date: "20 APR · LIVE" },
  { tag: "LEAGUE", title: "Franchise Auction completed", date: "18 APR · LIVE" },
  { tag: "LEAGUE", title: "Season 04 fixtures released", date: "15 APR · LIVE" },
  { tag: "RECAP", title: "Season 03 — post-season report", date: "10 APR · LIVE" },
];

export const adminGames: AdminGame[] = [
  { name: "VALORANT", on: true, format: "5v5 · BO3", players: 120, reg: "Open" },
  { name: "BGMI", on: true, format: "Squad", players: 96, reg: "Open" },
  { name: "COUNTER-STRIKE 2", on: true, format: "5v5", players: 84, reg: "Open" },
  { name: "SMASHKARTS", on: true, format: "FFA", players: 64, reg: "Open" },
  { name: "FREE FIRE", on: true, format: "Squad", players: 78, reg: "Open" },
  { name: "RAINBOW SIX", on: false, format: "5v5", players: 44, reg: "Closed" },
];
