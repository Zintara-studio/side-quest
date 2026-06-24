"use client";

import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { useDisputes, useResolveDispute } from "@/lib/query/hooks";
import { shortDate } from "@/lib/adapters/league";

const cardBtn = {
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: "9px 14px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

export function DisputesScreen() {
  const { data, isLoading, isError } = useDisputes();
  const resolve = useResolveDispute();
  const disputes = data ?? [];

  const onResolve = (id: string, dismiss: boolean) => {
    const resolution = window.prompt(dismiss ? "Note for dismissing this dispute?" : "How was it resolved?");
    if (resolution && resolution.trim()) {
      resolve.mutate({ id, body: { resolution: resolution.trim(), dismiss } });
    }
  };

  return (
    <div>
      <ScreenHeader eyebrow="Result integrity" title="DISPUTES" />

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "14px 0 24px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        {disputes.length} OPEN · CHALLENGES AGAINST PUBLISHED RESULTS
      </div>

      {isLoading ? (
        <StateNote>Loading disputes…</StateNote>
      ) : disputes.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load disputes (admin sign-in required)." : "No open disputes — all clear."}
        </StateNote>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {disputes.map((d) => (
            <div
              key={d.id}
              style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 18 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: ".1em",
                    color: SQ.ember,
                    border: "1px solid rgba(232,96,44,.45)",
                    padding: "4px 8px",
                    borderRadius: 9,
                  }}
                >
                  {d.status}
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>
                  {shortDate(d.createdAt)}
                </span>
                {d.matchId ? (
                  <Link
                    href={`/admin/match/${d.matchId}`}
                    style={{
                      marginLeft: "auto",
                      fontFamily: FONT.mono,
                      fontSize: 10.5,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: SQ.faint,
                      border: `1px solid ${SQ.inputBorder}`,
                      padding: "7px 12px",
                      borderRadius: 5,
                      textDecoration: "none",
                    }}
                  >
                    View match ▸
                  </Link>
                ) : null}
              </div>
              <div style={{ fontSize: 14.5, color: SQ.ink, marginTop: 12, lineHeight: 1.5 }}>{d.reason}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => onResolve(d.id, false)}
                  style={{ ...cardBtn, color: SQ.sidebar, background: SQ.green, border: "none", opacity: resolve.isPending ? 0.6 : 1 }}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => onResolve(d.id, true)}
                  style={{ ...cardBtn, color: SQ.faint, background: "transparent", border: `1px solid ${SQ.inputBorder}`, opacity: resolve.isPending ? 0.6 : 1 }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
