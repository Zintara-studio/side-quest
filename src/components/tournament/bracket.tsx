"use client";
import { cn } from "@/lib/utils";

type Slot = { team: string; tag: string; score?: number; winner?: boolean };
type MatchSlot = { id: string; a: Slot; b: Slot; status?: "scheduled" | "live" | "completed" };

const round1: MatchSlot[] = [
  { id: "m1", a: { team: "Sentinels Cipher", tag: "SEN", score: 2, winner: true }, b: { team: "Phantom Corps", tag: "PHC", score: 1 }, status: "completed" },
  { id: "m2", a: { team: "Neon Dynasty", tag: "ND", score: 2, winner: true }, b: { team: "Arc Titans", tag: "ARC", score: 0 }, status: "completed" },
  { id: "m3", a: { team: "Void Pulse", tag: "VOID", score: 1 }, b: { team: "Hyperion", tag: "HYP", score: 2, winner: true }, status: "completed" },
  { id: "m4", a: { team: "Echo Squad", tag: "ECH", score: 1 }, b: { team: "Frost Reign", tag: "FRR", score: 1 }, status: "live" },
];

const round2: MatchSlot[] = [
  { id: "s1", a: { team: "Sentinels Cipher", tag: "SEN" }, b: { team: "Neon Dynasty", tag: "ND" }, status: "scheduled" },
  { id: "s2", a: { team: "Hyperion", tag: "HYP" }, b: { team: "TBD", tag: "—" }, status: "scheduled" },
];

const final: MatchSlot[] = [
  { id: "f1", a: { team: "TBD", tag: "—" }, b: { team: "TBD", tag: "—" }, status: "scheduled" },
];

export function Bracket() {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-[820px] gap-12">
        <Column label="Quarterfinals" matches={round1} />
        <Column label="Semifinals" matches={round2} />
        <Column label="Grand Final" matches={final} />
      </div>
    </div>
  );
}

function Column({
  label,
  matches,
}: {
  label: string;
  matches: MatchSlot[];
}) {
  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-ink-dim">
        {label}
      </p>
      <div className="flex flex-1 flex-col justify-around gap-6">
        {matches.map((m) => (
          <MatchBox key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

function MatchBox({ m }: { m: MatchSlot }) {
  return (
    <div
      className={cn(
        "panel relative overflow-hidden p-3",
        m.status === "live" && "neon-border",
      )}
    >
      {m.status === "live" && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-neon-red shadow-[0_0_12px_rgba(239,68,68,0.7)]" />
      )}
      <Side slot={m.a} />
      <div className="my-1 h-px bg-white/[0.05]" />
      <Side slot={m.b} />
    </div>
  );
}

function Side({ slot }: { slot: Slot }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            slot.winner ? "text-neon-electric" : "text-ink-dim",
          )}
        >
          {slot.tag}
        </span>
        <span
          className={cn(
            "truncate text-sm",
            slot.winner ? "font-semibold text-ink" : "text-ink-muted",
          )}
        >
          {slot.team}
        </span>
      </div>
      <span
        className={cn(
          "stat-num text-sm",
          slot.winner ? "font-bold text-neon-electric" : "text-ink-muted",
        )}
      >
        {slot.score ?? "–"}
      </span>
    </div>
  );
}
