"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { useRegistrations, useReviewRegistration, useMatches } from "@/lib/query/hooks";
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
  const { data, isLoading, isError } = useRegistrations({
    status: "PENDING",
    type: tab === "ALL" ? undefined : tab,
    limit: 100,
  });
  // Matches supply richer section-header context (fixture / schedule) than the
  // registration alone carries. Registration still falls back to its own gameName.
  const matchesQ = useMatches({ limit: 100 });
  const review = useReviewRegistration();

  const onApprove = (id: string) => review.mutate({ id, action: "approve" });
  const onReject = (id: string) => {
    const reason = window.prompt("Reason for rejection?");
    if (reason && reason.trim()) review.mutate({ id, action: "reject", reason: reason.trim() });
  };

  // FRANCHISE proposals live on the admin Franchises page — never surface them here,
  // even in the ALL tab (which fetches every pending type).
  const items = (data?.items ?? []).filter((r) => r.type !== "FRANCHISE");

  const matchById = new Map((matchesQ.data?.items ?? []).map((m) => [m.id, m] as const));

  // Group by targeted match; non-match sign-ups fall into the general bucket.
  const matchGroups = new Map<string, RegistrationView[]>();
  const general: RegistrationView[] = [];
  for (const r of items) {
    if (r.matchId) {
      const arr = matchGroups.get(r.matchId);
      if (arr) arr.push(r);
      else matchGroups.set(r.matchId, [r]);
    } else {
      general.push(r);
    }
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
                          m.status === "ACCEPTED" ? SQ.green : m.status === "REJECTED" ? SQ.ember : SQ.amber,
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
            disabled={review.isPending}
            onClick={() => onApprove(r.id)}
            style={{ ...cardBtn, color: SQ.sidebar, background: SQ.green, border: "none", opacity: review.isPending ? 0.6 : 1 }}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={review.isPending}
            onClick={() => onReject(r.id)}
            style={{
              ...cardBtn,
              color: SQ.ember,
              background: "transparent",
              border: "1px solid rgba(232,96,44,.45)",
              opacity: review.isPending ? 0.6 : 1,
            }}
          >
            Reject
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <ScreenHeader eyebrow="Approval queue" title="REGISTRATIONS" />

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
          {items.length} PENDING · {TAB_LABEL[tab]}
          {matchSections.length > 0 ? ` · ${matchSections.length} MATCH${matchSections.length > 1 ? "ES" : ""}` : ""}
          {general.length > 0 ? ` · ${general.length} GENERAL` : ""}
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
        page.
      </div>

      {isLoading ? (
        <StateNote>Loading registrations…</StateNote>
      ) : items.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError
            ? "Couldn't load registrations (admin sign-in required)."
            : `No pending ${
                tab === "PLAYER" ? "solo player " : tab === "SQUAD" ? "squad " : ""
              }registrations.`}
        </StateNote>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          {/* One section per targeted match / announcement, soonest first. */}
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
                    {regs.length} PENDING
                  </span>
                </div>
                <div style={gridStyle}>{regs.map(renderCard)}</div>
              </section>
            );
          })}

          {/* Non-match "website / general" sign-ups — clearly separated + highlighted. */}
          {general.length > 0 ? (
            <section
              style={{
                border: `1px solid ${SQ.hairline}`,
                borderLeft: `3px solid ${SQ.amber}`,
                background: "rgba(181,131,26,.06)",
                borderRadius: 9,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <span style={{ fontFamily: FONT.display, fontSize: 16, letterSpacing: ".01em" }}>
                  Website · General
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".08em", color: SQ.mute }}>
                  Not tied to a match — open / general sign-ups
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".1em",
                    color: SQ.faint,
                  }}
                >
                  {general.length} PENDING
                </span>
              </div>
              <div style={gridStyle}>{general.map(renderCard)}</div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
