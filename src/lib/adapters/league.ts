// Adapters mapping backend DTOs onto the existing "Broadcast HUD" display shapes, so wired
// screens reuse their exact prototype JSX. Fields the backend does not expose (games-played,
// per-player K/D, matchday dates, "form" trend) fall back to neutral placeholders.
import { SQ } from "@/components/sidequest/tokens";
import type {
  FranchiseSummary,
  GameSummary,
  MatchSummary,
  PlayerSummary,
} from "@/lib/api/types";
import type { AnnouncementTag } from "@/components/sidequest/tokens";

// Player-facing display shapes the adapters below map backend DTOs onto.
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

export interface Announcement {
  tag: AnnouncementTag;
  title: string;
  date: string;
}

const NA = "—";
const pad2 = (n: number) => String(n).padStart(2, "0");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** ISO-8601 → "21 APR" (the prototype's compact date style). */
export function shortDate(iso?: string): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** ISO-8601 → "HH:MM" (24h, local time; deterministic — no locale string). Empty on invalid input. */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function adaptGames(
  api: GameSummary[],
): (GameCard & { raw: string; pointsPerKill: number; placementPoints: string; standingsWeight: number })[] {
  return api.map((g) => ({
    name: g.name.toUpperCase(),
    raw: g.name, // exact catalog name, for linking to the match history filtered by this game
    players: 0, // backend GameSummary has no per-game player count
    pop: g.popularity,
    next: g.enabled ? "LIVE" : NA, // no matchday date on GameSummary; surface whether the title is live
    format: g.format,
    pointsPerKill: g.pointsPerKill,
    placementPoints: g.placementPoints,
    standingsWeight: g.standingsWeight,
  }));
}

export function adaptFranchises(api: FranchiseSummary[]): (Standing & { id: string })[] {
  return api.map((f) => ({
    id: f.id,
    rank: pad2(f.rank),
    name: f.name.toUpperCase(),
    sub: f.tag ?? "",
    gp: f.rosterSize, // surfaced as the "ROSTER" column
    w: 0,
    pts: f.points,
    best: NA,
    form: f.active ? "LIVE" : "OUT",
    formColor: f.active ? SQ.green : SQ.mute,
  }));
}

export interface UpcomingItem {
  id: string;
  day: string;
  mon: string;
  meta: string;
  title: string;
}

export function adaptUpcoming(api: MatchSummary[]): UpcomingItem[] {
  return api.map((m) => {
    const d = new Date(m.scheduledAt);
    const valid = !Number.isNaN(d.getTime());
    const time = shortTime(m.scheduledAt);
    return {
      id: m.id,
      day: valid ? pad2(d.getDate()) : NA,
      mon: valid ? MONTHS[d.getMonth()] : "",
      meta: [m.game.name.toUpperCase(), time].filter(Boolean).join(" · "),
      title: m.participantTags.length ? m.participantTags.join(" vs ") : m.arena ?? "Fixture",
    };
  });
}

export function adaptPlayers(api: PlayerSummary[]): (PlayerRow & { id: string; avatar?: string })[] {
  return api.map((p, i) => ({
    id: p.id,
    rank: pad2(i + 1),
    name: p.gamerTag,
    fr: p.franchiseName ?? "— Unassigned",
    gp: 0,
    pts: p.points,
    tags: p.region ?? NA,
    avatar: p.avatarUrl,
  }));
}

const CATEGORY_TAG: Record<string, Announcement["tag"]> = {
  RESULT: "RESULT",
  RECAP: "RECAP",
  GENERAL: "LEAGUE",
  MATCH: "LEAGUE",
  ROSTER: "LEAGUE",
  AUCTION: "AUCTION",
};

/** Map a backend AnnouncementCategory to the prototype's tag (RESULT / LEAGUE / RECAP). */
export function announcementTagFor(category: string): Announcement["tag"] {
  return CATEGORY_TAG[category] ?? "LEAGUE";
}
