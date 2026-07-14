"use client";

import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { useAdminOverview } from "@/lib/query/hooks";
import {
  adaptKpis,
  adaptActivity,
  adaptTasks,
  adaptOverviewSummary,
} from "@/lib/adapters/admin";

export function OverviewScreen() {
  const { data, isLoading, isError } = useAdminOverview();
  const kpis = data ? adaptKpis(data) : [];
  const activity = data ? adaptActivity(data) : [];
  const tasks = data ? adaptTasks(data) : [];
  const summary = data
    ? adaptOverviewSummary(data)
    : isLoading
      ? "LOADING LEAGUE METRICS…"
      : "SIGN IN AS AN ADMIN TO VIEW LIVE METRICS";

  return (
    <div>
      <ScreenHeader eyebrow="Control room" title="OVERVIEW" />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "12px 0 26px",
          paddingBottom: 24,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        {summary}
      </div>

      {/* KPI tiles */}
      {isLoading ? (
        <StateNote>Loading metrics…</StateNote>
      ) : kpis.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load the control room (admin sign-in required)." : "No metrics yet."}
        </StateNote>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: 16,
          }}
        >
          {kpis.map((k) => (
            <div
              key={k.label}
              style={{
                background: SQ.panel,
                border: `1px solid ${k.border}`,
                borderRadius: 9,
                padding: "20px 22px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: ".14em",
                    color: SQ.label,
                  }}
                >
                  {k.label}
                </div>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: k.dot }} />
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: 38,
                  letterSpacing: "-.02em",
                  marginTop: 8,
                }}
              >
                {k.value}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10.5,
                  letterSpacing: ".06em",
                  color: k.deltaColor,
                  marginTop: 4,
                }}
              >
                {k.delta}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Needs Attention + Recent Activity */}
      {data ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
            gap: 24,
            marginTop: 30,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                }}
              >
                Needs Attention
              </div>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  color: tasks.length ? SQ.ember : SQ.mute,
                  border: `1px solid ${tasks.length ? "rgba(232,96,44,.45)" : SQ.inputBorder}`,
                  padding: "3px 8px",
                  borderRadius: 9,
                }}
              >
                {tasks.length} OPEN
              </span>
            </div>
            {tasks.length === 0 ? (
              <StateNote>All clear — nothing needs attention.</StateNote>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "15px 16px",
                    background: SQ.panel,
                    border: `1px solid ${SQ.hairline}`,
                    borderRadius: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{ width: 9, height: 9, borderRadius: "50%", background: t.dot, flex: "0 0 auto" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        letterSpacing: ".08em",
                        color: SQ.mute,
                        marginTop: 3,
                      }}
                    >
                      {t.meta}
                    </div>
                  </div>
                  <Link
                    href={t.href}
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10.5,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: t.primary ? SQ.sidebar : SQ.faint,
                      background: t.primary ? SQ.red : "transparent",
                      border: `1px solid ${t.primary ? SQ.red : SQ.inputBorder}`,
                      padding: "9px 13px",
                      borderRadius: 5,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.btn}
                  </Link>
                </div>
              ))
            )}
          </div>

          <div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 12,
                letterSpacing: ".2em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Recent Activity
            </div>
            {activity.length === 0 ? (
              <StateNote>No recent activity.</StateNote>
            ) : (
              <div
                style={{
                  background: SQ.panel,
                  border: `1px solid ${SQ.hairline}`,
                  borderRadius: 8,
                  padding: "6px 18px",
                  // Scrollable so a busy trail doesn't push the page down — the panel stays a fixed size.
                  maxHeight: 440,
                  overflowY: "auto",
                }}
              >
                {activity.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 14,
                      padding: "13px 0",
                      borderBottom: `1px solid ${SQ.hairlineFaint}`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        color: SQ.dim,
                        width: 54,
                        flex: "0 0 auto",
                        paddingTop: 2,
                      }}
                    >
                      {a.time}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: SQ.ink }}>{a.title}</div>
                      {a.meta ? (
                        <div
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10.5,
                            color: SQ.dim,
                            marginTop: 3,
                            lineHeight: 1.5,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {a.meta}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
