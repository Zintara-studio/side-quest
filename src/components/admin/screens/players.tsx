"use client";

import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import { usePlayers, useUpdatePlayerStatus } from "@/lib/query/hooks";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const STATUSES = ["PENDING", "VERIFIED", "FLAGGED", "SUSPENDED"];

function statusColor(s: string): string {
  if (s === "VERIFIED") return SQ.green;
  if (s === "PENDING") return SQ.amber;
  return SQ.ember;
}

export function PlayersScreen() {
  const { data, isLoading, isError } = usePlayers({ limit: 100 });
  const updateStatus = useUpdatePlayerStatus();
  const players = data?.items ?? [];
  const counts = players.reduce<Record<string, number>>((m, p) => {
    m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div>
      <ScreenHeader eyebrow="Member directory" title="PLAYERS" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "14px 0 22px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          {players.length} MEMBERS · {counts.VERIFIED ?? 0} VERIFIED · {counts.PENDING ?? 0} PENDING ·{" "}
          {counts.FLAGGED ?? 0} FLAGGED
        </div>
      </div>

      {isLoading ? (
        <StateNote>Loading players…</StateNote>
      ) : players.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load players (admin sign-in required)." : "No players yet."}
        </StateNote>
      ) : (
        <TableScroll minWidth={720}>
          <div
            style={{
              display: "flex",
              padding: "14px 18px",
              borderBottom: `1px solid ${SQ.hairline}`,
              ...headCell,
            }}
          >
            <div style={{ flex: 1 }}>PLAYER</div>
            <div style={{ width: 160 }}>FRANCHISE</div>
            <div style={{ width: 90, textAlign: "right" }}>POINTS</div>
            <div style={{ width: 150, textAlign: "right" }}>STATUS</div>
          </div>

          {players.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "13px 18px",
                borderBottom: `1px solid ${SQ.hairlineSoft}`,
              }}
            >
              <Link
                href={`/admin/player/${p.id}`}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: SQ.ink }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: SQ.avatar,
                    border: `1px solid ${SQ.avatarBorder}`,
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.gamerTag}</span>
              </Link>
              <div style={{ width: 160, fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>
                {p.franchiseName ?? "— Unassigned"}
              </div>
              <div
                style={{ width: 90, textAlign: "right", fontFamily: FONT.display, fontSize: 15 }}
              >
                {p.points}
              </div>
              <div style={{ width: 150, display: "flex", justifyContent: "flex-end" }}>
                <select
                  value={p.status}
                  disabled={updateStatus.isPending}
                  onChange={(e) => updateStatus.mutate({ id: p.id, status: e.target.value })}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: ".06em",
                    color: statusColor(p.status),
                    background: SQ.inset,
                    border: `1px solid ${SQ.inputBorder}`,
                    borderRadius: 5,
                    padding: "6px 8px",
                    cursor: "pointer",
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </TableScroll>
      )}
    </div>
  );
}
