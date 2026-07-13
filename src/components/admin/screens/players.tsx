"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import { Avatar } from "@/components/sidequest/avatar";
import { Modal } from "@/components/sidequest/modal";
import { usePlayers, useUpdatePlayerStatus } from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/auth/context";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const STATUSES = ["PENDING", "VERIFIED", "FLAGGED", "SUSPENDED"];

// Sort chips mirror the public players screen; "Games" is swapped for "Status"
// since the admin directory tracks status rather than a games-played count.
const SORT_CHIPS = ["Franchise", "A–Z", "Z–A", "Points", "Status"];

// For the "Status" sort, surface the members that need attention first.
const STATUS_ORDER: Record<string, number> = {
  FLAGGED: 0,
  SUSPENDED: 1,
  PENDING: 2,
  VERIFIED: 3,
};

function statusColor(s: string): string {
  if (s === "VERIFIED") return SQ.green;
  if (s === "PENDING") return SQ.amber;
  return SQ.ember;
}

interface PendingChange {
  id: string;
  gamerTag: string;
  from: string;
  to: string;
}

export function PlayersScreen() {
  const { data, isLoading, isError } = usePlayers({ limit: 100 });
  const updateStatus = useUpdatePlayerStatus();
  const players = data?.items ?? [];
  const counts = players.reduce<Record<string, number>>((m, p) => {
    m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, {});

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<string>(SORT_CHIPS[0]);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? players.filter((p) =>
        `${p.gamerTag} ${p.franchiseName ?? ""} ${p.status}`.toLowerCase().includes(q),
      )
    : players;
  // Normalise the chip label (strip the en-dash etc.) so "A–Z"/"Z–A" match.
  const visible = [...filtered].sort((a, b) => {
    switch (sort.replace(/[^A-Za-z]/g, "").toUpperCase()) {
      case "AZ":
        return a.gamerTag.localeCompare(b.gamerTag);
      case "ZA":
        return b.gamerTag.localeCompare(a.gamerTag);
      case "POINTS":
        return b.points - a.points || a.gamerTag.localeCompare(b.gamerTag);
      case "STATUS":
        return (
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
          a.gamerTag.localeCompare(b.gamerTag)
        );
      case "FRANCHISE":
      default:
        return (
          (a.franchiseName ?? "").localeCompare(b.franchiseName ?? "") ||
          a.gamerTag.localeCompare(b.gamerTag)
        );
    }
  });

  const closePending = () => {
    if (!updateStatus.isPending) {
      setPending(null);
      setStatusError(null);
    }
  };

  const confirmChange = async () => {
    if (!pending) return;
    setStatusError(null);
    try {
      await updateStatus.mutateAsync({ id: pending.id, status: pending.to });
      setPending(null);
    } catch (err) {
      // Keep the modal open and surface the failure (the <select> stays on the old value).
      setStatusError(apiErrorMessage(err, "Could not update status."));
    }
  };

  // Tone of the confirmation: restricting a member vs. clearing a restriction.
  const destructive = pending?.to === "FLAGGED" || pending?.to === "SUSPENDED";
  const clearing =
    !!pending &&
    (pending.from === "SUSPENDED" || pending.from === "FLAGGED") &&
    (pending.to === "VERIFIED" || pending.to === "PENDING");
  const confirmBg = destructive ? SQ.red : clearing ? SQ.green : SQ.ink;

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players…"
            className="sq-field"
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".04em",
              color: SQ.ink,
              background: SQ.inset,
              border: `1px solid ${SQ.field}`,
              borderRadius: 5,
              padding: "8px 12px",
              minWidth: 180,
            }}
          />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: ".1em",
              color: SQ.label,
              alignSelf: "center",
            }}
          >
            SORT
          </span>
          {SORT_CHIPS.map((label) => {
            const active = label === sort;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSort(label)}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".06em",
                  padding: "8px 12px",
                  borderRadius: 5,
                  border: `1px solid ${active ? SQ.red : SQ.inputBorder}`,
                  color: active ? SQ.sidebar : SQ.faint,
                  background: active ? SQ.red : "transparent",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <StateNote>Loading players…</StateNote>
      ) : players.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load players (admin sign-in required)." : "No players yet."}
        </StateNote>
      ) : visible.length === 0 ? (
        <StateNote>No players match “{query}”.</StateNote>
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

          {visible.map((p) => (
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
                <Avatar url={p.avatarUrl} alt={p.gamerTag} size={28} />
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
                  onChange={(e) => {
                    const to = e.target.value;
                    // Don't mutate immediately — stage the change for confirmation.
                    // The select is controlled by p.status, so it reverts on cancel.
                    if (to !== p.status) {
                      setStatusError(null);
                      setPending({ id: p.id, gamerTag: p.gamerTag, from: p.status, to });
                    }
                  }}
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

      <Modal open={!!pending} title="Confirm status change" onClose={closePending}>
        {pending && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".08em",
                  color: statusColor(pending.from),
                  border: `1px solid ${SQ.inputBorder}`,
                  borderRadius: 5,
                  padding: "5px 10px",
                  background: SQ.inset,
                }}
              >
                {pending.from}
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 14, color: SQ.mute }}>→</span>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".08em",
                  color: statusColor(pending.to),
                  border: `1px solid ${SQ.inputBorder}`,
                  borderRadius: 5,
                  padding: "5px 10px",
                  background: SQ.inset,
                }}
              >
                {pending.to}
              </span>
            </div>

            <p style={{ fontFamily: FONT.mono, fontSize: 12.5, lineHeight: 1.6, color: SQ.faint, margin: 0 }}>
              Change <strong style={{ color: SQ.ink }}>{pending.gamerTag}</strong>&apos;s status from{" "}
              {pending.from} to {pending.to}.
            </p>

            {destructive && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1px solid ${SQ.red}`,
                  background: "rgba(232,96,44,.08)",
                  fontFamily: FONT.mono,
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  color: SQ.ember,
                }}
              >
                This restricts the player. {pending.to === "SUSPENDED" ? "Suspended" : "Flagged"}{" "}
                members are pulled from active standing and cannot compete until cleared.
              </div>
            )}

            {clearing && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1px solid ${SQ.green}`,
                  background: "rgba(31,157,99,.08)",
                  fontFamily: FONT.mono,
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  color: SQ.green,
                }}
              >
                This clears the {pending.from === "SUSPENDED" ? "suspension" : "flag"} and restores{" "}
                {pending.gamerTag} to good standing.
              </div>
            )}

            {statusError && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1px solid ${SQ.red}`,
                  background: "rgba(232,96,44,.08)",
                  fontFamily: FONT.mono,
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  color: SQ.red,
                }}
              >
                {statusError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={closePending}
                disabled={updateStatus.isPending}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10.5,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  padding: "10px 16px",
                  borderRadius: 5,
                  color: SQ.faint,
                  background: "transparent",
                  border: `1px solid ${SQ.inputBorder}`,
                  cursor: "pointer",
                  opacity: updateStatus.isPending ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmChange}
                disabled={updateStatus.isPending}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10.5,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  padding: "10px 16px",
                  borderRadius: 5,
                  color: SQ.sidebar,
                  background: confirmBg,
                  border: "none",
                  cursor: "pointer",
                  opacity: updateStatus.isPending ? 0.6 : 1,
                }}
              >
                {updateStatus.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
