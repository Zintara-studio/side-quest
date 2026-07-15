// Adapters mapping backend admin DTOs onto the control-room display shapes.
import type { OverviewResponse } from "@/lib/api/types";
import { shortTime } from "@/lib/adapters/league";

// Control-room display shapes the overview adapter maps backend DTOs onto.
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
  /** Definitive one-line statement of what happened (from the action code). */
  title: string;
  /** Supporting specifics from the audit detail (cleaned), plus the actor — muted secondary line. */
  meta: string;
}

/**
 * Definitive human-readable label for each audit action code. The raw `detail` string (e.g.
 * "pointsPerKill=1, placementPoints=…", or a bare email) is often cryptic on its own, so the label
 * always leads and the detail becomes supporting context. Keep in step with the backend action codes
 * recorded via AuditService.record(...).
 */
const ACTION_LABELS: Record<string, string> = {
  "settings.update": "League settings updated",
  "config.seed": "Static config seeded",
  "dispute.raise": "Dispute raised",
  "dispute.resolve": "Dispute resolved",
  "admin.appoint": "Admin appointed",
  "admin.revoke": "Admin access revoked",
  "admin.avatar": "Admin photo updated",
  "game.create": "Game added",
  "game.update": "Game settings updated",
  "franchise.create": "Franchise created",
  "franchise.update": "Franchise updated",
  "franchise.branding": "Franchise branding updated",
  "franchise.roster.assign": "Player assigned to franchise",
  "franchise.owner.set": "Franchise owner set",
  "franchise.manager.set": "Franchise manager set",
  "franchise.leader.remove": "Franchise leader removed",
  "franchise.discard": "Franchise discarded",
  "franchise.restore": "Franchise restored",
  "franchise.fromProposal": "Franchise created from a proposal",
  "franchise.invite.create": "Franchise invite sent",
  "franchise.invite.accept": "Franchise invite accepted",
  "franchise.invite.reject": "Franchise invite declined",
  "franchise.roster.tags": "Roster tags updated",
  "match.create": "Match created",
  "match.update": "Match updated",
  "match.results.publish": "Match results published",
  "match.rounds.publish": "Match rounds published",
  "match.lineup.set": "Match lineup set",
  "match.start": "Match started",
  "match.end": "Match ended",
  "match.reschedule": "Match rescheduled",
  "match.delete": "Match deleted",
  "match.message": "Match room message posted",
  "player.status": "Player status changed",
  "registration.apply": "Registration submitted",
  "registration.invite": "Squad invite sent",
  "registration.discard": "Registration discarded",
  "registration.cancel": "Registration cancelled",
  "invite.accept": "Squad invite accepted",
  "invite.reject": "Squad invite declined",
  "invite.leave": "Player left a franchise",
  "auction.lockpool": "Auction pool locked",
  "auction.start": "Auction started",
  "auction.pause": "Auction paused",
  "auction.resume": "Auction resumed",
  "auction.complete": "Auction completed",
  "auction.cancel": "Auction cancelled",
  "auction.assign": "Player assigned in auction",
  "auction.reauction": "Player re-auctioned",
  "auction.addfunds": "Auction funds added",
  "season.start": "Season started",
  "season.finish": "Season finished",
  "announcement.create": "Announcement posted",
  "announcement.update": "Announcement edited",
  "announcement.delete": "Announcement deleted",
  "announcement.close": "Registration closed",
};

function actionLabel(action: string): string {
  // Fallback: turn an unknown "some.action.code" into "Some action code".
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Trim raw UUIDs (and now-dangling "from proposal") out of a detail string so it reads cleanly. */
function cleanDetail(detail?: string): string {
  if (!detail) return "";
  return detail
    .replace(UUID_RE, "")
    .replace(/\bfrom proposal\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[·\-\s]+$/, "")
    .trim();
}

export function adaptKpis(o: OverviewResponse): AdminKpi[] {
  return [
    {
      label: "PENDING REGISTRATIONS",
      value: String(o.pendingRegistrations),
      dot: "#E0A82E",
      delta: "awaiting review",
      deltaColor: "#E0A82E",
      border: "rgba(224,168,46,.35)",
    },
    {
      label: "RESULTS TO ENTER",
      value: String(o.resultsToEnter),
      dot: "#FF3D2E",
      delta: "matches awaiting",
      deltaColor: "#FF6A5E",
      border: "rgba(255,61,46,.35)",
    },
    {
      label: "OPEN DISPUTES",
      value: String(o.openDisputes),
      dot: "#FF3D2E",
      delta: o.openDisputes > 0 ? "needs resolution" : "all clear",
      deltaColor: o.openDisputes > 0 ? "#FF6A5E" : "#8A8C93",
      border: o.openDisputes > 0 ? "rgba(255,61,46,.35)" : "rgba(255,255,255,.09)",
    },
    {
      label: "REGISTERED PLAYERS",
      value: String(o.totals.players),
      dot: "#7FB2FF",
      delta: `${o.totals.franchises} franchises`,
      deltaColor: "#8A8C93",
      border: "rgba(255,255,255,.09)",
    },
  ];
}

export function adaptActivity(o: OverviewResponse): AdminActivity[] {
  return o.recentActivity.map((a) => {
    // The action code gives a definitive statement of WHAT happened; the (cleaned) detail + actor are
    // supporting context on a muted second line. This replaces the old "raw detail · email" which read
    // as random strings when the detail was a scoring diff or a bare email.
    const detail = cleanDetail(a.detail);
    const meta = [detail, a.actorEmail].filter((s) => s && s.trim()).join(" · ");
    return {
      time: shortTime(a.at),
      title: actionLabel(a.action),
      meta,
    };
  });
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** "Needs attention" tasks derived from the real overview counts (no mock). */
export function adaptTasks(o: OverviewResponse): AdminTask[] {
  const tasks: AdminTask[] = [];
  // PENDING registrations are FRANCHISE-creation proposals — reviewed on the Franchises page.
  if (o.pendingRegistrations > 0)
    tasks.push({
      dot: "#B5831A",
      title: `${plural(o.pendingRegistrations, "franchise proposal")} awaiting review`,
      meta: "FRANCHISE PROPOSALS",
      btn: "Review",
      href: "/admin/franchises",
      primary: true,
    });
  if (o.resultsToEnter > 0)
    tasks.push({
      dot: "#E8602C",
      title: `${plural(o.resultsToEnter, "match")} need results entered`,
      meta: "RESULT ENTRY",
      btn: "Enter",
      href: "/admin/matches/result",
      primary: true,
    });
  if (o.openDisputes > 0)
    tasks.push({
      dot: "#E8602C",
      title: `${plural(o.openDisputes, "open dispute")}`,
      meta: "DISPUTES",
      btn: "Resolve",
      href: "/admin/disputes",
      primary: false,
    });
  return tasks;
}

/** The control-room sub-header summary line, derived from real totals. */
export function adaptOverviewSummary(o: OverviewResponse): string {
  const t = o.totals;
  return `${t.franchises} FRANCHISES · ${t.players} PLAYERS · ${t.games} TITLES · ${t.matches} MATCHES`;
}
