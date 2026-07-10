"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import { useRegistrations, useRejectRegistration, useMatches } from "@/lib/query/hooks";
import { shortDate } from "@/lib/adapters/league";
import type { RegistrationView } from "@/lib/api/types";

type Tab = "ALL" | "PLAYER" | "SQUAD";

const tabBase = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".1em",
  padding: "8px 14px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

const cardBtn = {
  flex: 1,
  textAlign: "center",
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: 10,
  borderRadius: 5,
  cursor: "pointer",
} as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))",
  gap: 16,
} as const;

const TAB_LABEL: Record<Tab, string> = { ALL: "ALL", PLAYER: "SOLO", SQUAD: "SQUADS" };

export function RegistrationsScreen() {
  const [tab, setTab] = useState<Tab>("ALL");
  // Fetch without a status filter — match registrations are live from creation, so we want the
  // whole set and narrow to the live ones below (FORMING / ACTIVE / LOCKED).
  const { data, isLoading, isError } = useRegistrations({
    type: tab === "ALL" ? undefined : tab,
    limit: 100,
  });
  // Matches supply richer section-header context (fixture / schedule) than the
  // registration alone carries. Registration still falls back to its own gameName.
  const matchesQ = useMatches({ limit: 100 });
  const discard = useRejectRegistration();
  const [pendingDiscard, setPendingDiscard] = useState<string | null>(null);

  // Discard removes the registration from the match; reason is optional — omitted here. Staged for a
  // themed confirm dialog instead of the native window.confirm.
  const onDiscard = (id: string) => setPendingDiscard(id);

  // Only live MATCH registrations belong here: a SQUAD forming, a solo PLAYER active, or either once
  // auto-locked — always tied to a specific fixture. FRANCHISE proposals (PENDING/APPROVED) live on
  // the admin Franchises page, AUCTION pool entries on the Auction page, general website sign-ups are
  // no longer surfaced, and discarded (REJECTED) registrations drop off entirely.
  const items = (data?.items ?? []).filter(
    (r) =>
      (r.type === "PLAYER" || r.type === "SQUAD") &&
      !!r.matchId &&
      ["FORMING", "ACTIVE", "LOCKED"].includes(r.status),
  );

  const matchById = new Map((matchesQ.data?.items ?? []).map((m) => [m.id, m] as const));

  // Group by targeted match, soonest fixture first.
  const matchGroups = new Map<string, RegistrationView[]>();
  for (const r of items) {
    const arr = matchGroups.get(r.matchId!);
    if (arr) arr.push(r);
    else matchGroups.set(r.matchId!, [r]);
  }

  const matchSections = Array.from(matchGroups.entries())
    .map(([matchId, regs]) => ({ matchId, regs, match: matchById.get(matchId) }))
    .sort((a, b) => {
      const ta = a.match ? new Date(a.match.scheduledAt).getTime() : Infinity;
      const tb = b.match ? new Date(b.match.scheduledAt).getTime() : Infinity;
      return ta - tb;
    });

  const renderCard = (r: RegistrationView) => {
    const name = r.player?.gamerTag ?? r.squadName ?? "Registration";
    const meta = [
      tab === "ALL" ? (r.type === "SQUAD" ? "SQUAD" : "SOLO") : null,
      r.gameName,
      r.contact,
      shortDate(r.createdAt),
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <div
        key={r.id}
        style={{
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 9,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: SQ.avatar,
              border: `1px solid ${SQ.avatarBorder}`,
              flex: "0 0 auto",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: ".08em",
                color: SQ.mute,
                marginTop: 2,
              }}
            >
              {meta || r.type}
            </div>
          </div>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: ".1em",
              color: SQ.amber,
              border: "1px solid rgba(181,131,26,.5)",
              padding: "4px 8px",
              borderRadius: 9,
            }}
          >
            {r.status}
          </span>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "14px 0" }}>
          {(r.games ?? []).map((g) => (
            <span
              key={g}
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: ".04em",
                color: SQ.faint,
                border: `1px solid ${SQ.field}`,
                padding: "5px 9px",
                borderRadius: 5,
              }}
            >
              {g}
            </span>
          ))}
        </div>

        {r.type === "SQUAD" ? (
          <div style={{ margin: "0 0 14px" }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: ".1em",
                color: SQ.label,
                marginBottom: 8,
              }}
            >
              TEAM · {r.acceptedCount} CONFIRMED
            </div>
            {r.members.length === 0 ? (
              <div style={{ fontSize: 12, color: SQ.mute }}>No members yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {r.members.map((m) => (
                  <div
                    key={m.playerId}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
                  >
                    <span style={{ flex: 1, fontWeight: m.isCaptain ? 700 : 500 }}>
                      {m.gamerTag}
                      {m.isCaptain ? (
                        <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: SQ.ember, marginLeft: 6 }}>
                          CAPTAIN
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 9.5,
                        letterSpacing: ".08em",
                        color:
                          m.status === "ACCEPTED"
                            ? SQ.green
                            : m.status === "REJECTED" || m.status === "EXPIRED"
                              ? SQ.mute
                              : SQ.amber,
                      }}
                    >
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            disabled={discard.isPending}
            onClick={() => onDiscard(r.id)}
            style={{
              ...cardBtn,
              color: SQ.ember,
              background: "transparent",
              border: "1px solid rgba(232,96,44,.45)",
              opacity: discard.isPending ? 0.6 : 1,
            }}
          >
            Discard
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <ScreenHeader eyebrow="Match sign-ups" title="REGISTRATIONS" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "14px 0 14px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          {items.length} REGISTERED · {TAB_LABEL[tab]}
          {matchSections.length > 0 ? ` · ${matchSections.length} MATCH${matchSections.length > 1 ? "ES" : ""}` : ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["ALL", "PLAYER", "SQUAD"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                ...tabBase,
                background: tab === t ? SQ.red : "transparent",
                color: tab === t ? SQ.sidebar : SQ.faint,
                fontWeight: tab === t ? 600 : 400,
                border: tab === t ? "none" : `1px solid ${SQ.inputBorder}`,
              }}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10.5,
          letterSpacing: ".06em",
          color: SQ.mute,
          marginBottom: 24,
        }}
      >
        Franchise proposals are reviewed on the{" "}
        <Link href="/admin/franchises" style={{ color: SQ.ember, textDecoration: "none" }}>
          Franchises
        </Link>{" "}
        page; auction pool entries on the{" "}
        <Link href="/admin/auction" style={{ color: SQ.ember, textDecoration: "none" }}>
          Auction
        </Link>{" "}
        page.
      </div>

      {isLoading ? (
        <StateNote>Loading registrations…</StateNote>
      ) : items.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError
            ? "Couldn't load registrations (admin sign-in required)."
            : `No live ${
                tab === "PLAYER" ? "solo player " : tab === "SQUAD" ? "squad " : ""
              }match registrations.`}
        </StateNote>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          {/* One section per targeted match, soonest first. */}
          {matchSections.map(({ matchId, regs, match }) => {
            const fixture = match
              ? match.participantTags.length
                ? match.participantTags.join(" vs ")
                : match.arena ?? "Match fixture"
              : regs[0]?.gameName ?? "Match";
            const gameName = match?.game?.name ?? regs[0]?.gameName ?? "—";
            return (
              <section key={matchId}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 14,
                    paddingBottom: 10,
                    borderBottom: `1px solid ${SQ.hairlineSoft}`,
                  }}
                >
                  <span style={{ fontFamily: FONT.display, fontSize: 16, letterSpacing: ".01em" }}>
                    {fixture}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      color: SQ.ember,
                    }}
                  >
                    {gameName.toUpperCase()}
                  </span>
                  {match ? (
                    <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".08em", color: SQ.mute }}>
                      {shortDate(match.scheduledAt)}
                    </span>
                  ) : null}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      color: SQ.faint,
                    }}
                  >
                    {regs.length} REGISTERED
                  </span>
                </div>
                <div style={gridStyle}>{regs.map(renderCard)}</div>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!pendingDiscard}
        title="Discard registration"
        tone="destructive"
        message="Discard this registration? The player or squad is removed from this match. This can't be undone."
        confirmLabel="Discard"
        busy={discard.isPending}
        onConfirm={() =>
          pendingDiscard &&
          discard.mutate({ id: pendingDiscard }, { onSettled: () => setPendingDiscard(null) })
        }
        onClose={() => setPendingDiscard(null)}
      />
    </div>
  );
}
