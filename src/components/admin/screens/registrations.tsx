"use client";

import { useState } from "react";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { useRegistrations, useReviewRegistration } from "@/lib/query/hooks";
import { shortDate } from "@/lib/adapters/league";

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

export function RegistrationsScreen() {
  const [tab, setTab] = useState<"PLAYER" | "SQUAD">("PLAYER");
  const { data, isLoading, isError } = useRegistrations({ status: "PENDING", type: tab });
  const review = useReviewRegistration();
  const items = data?.items ?? [];

  const onApprove = (id: string) => review.mutate({ id, action: "approve" });
  const onReject = (id: string) => {
    const reason = window.prompt("Reason for rejection?");
    if (reason && reason.trim()) review.mutate({ id, action: "reject", reason: reason.trim() });
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
          margin: "14px 0 24px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          {items.length} PENDING · {tab === "PLAYER" ? "SOLO PLAYERS" : "SQUADS"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["PLAYER", "SQUAD"] as const).map((t) => (
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
              {t === "PLAYER" ? "PLAYERS" : "SQUADS"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <StateNote>Loading registrations…</StateNote>
      ) : items.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError
            ? "Couldn't load registrations (admin sign-in required)."
            : `No pending ${tab === "PLAYER" ? "player" : "squad"} registrations.`}
        </StateNote>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))",
            gap: 16,
          }}
        >
          {items.map((r) => {
            const name = r.player?.gamerTag ?? r.squadName ?? "Registration";
            const meta = [r.contact, shortDate(r.createdAt)].filter(Boolean).join(" · ");
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
          })}
        </div>
      )}
    </div>
  );
}
