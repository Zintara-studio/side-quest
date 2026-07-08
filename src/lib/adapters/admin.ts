// Adapters mapping backend admin DTOs onto the control-room display shapes.
import type { OverviewResponse } from "@/lib/api/types";

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
  text: string;
}

/** ISO-8601 → "HH:MM" (24h), the activity-feed timestamp style. */
function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function prettyAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
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
    // Prefer the human-readable detail (e.g. "Approved squad 'Phantom Five'"); fall back to the
    // machine action + entity type. Always attribute the actor when known.
    const what = a.detail && a.detail.trim() ? a.detail : `${prettyAction(a.action)} — ${a.entityType}`;
    return {
      time: shortTime(a.at),
      text: `${what}${a.actorEmail ? ` · ${a.actorEmail}` : ""}`,
    };
  });
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** "Needs attention" tasks derived from the real overview counts (no mock). */
export function adaptTasks(o: OverviewResponse): AdminTask[] {
  const tasks: AdminTask[] = [];
  if (o.pendingRegistrations > 0)
    tasks.push({
      dot: "#B5831A",
      title: `${plural(o.pendingRegistrations, "registration")} awaiting review`,
      meta: "APPROVAL QUEUE",
      btn: "Review",
      href: "/admin/registrations",
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
