import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { adminKpis, adminTasks, adminActivity } from "@/lib/mock/admin";

export function OverviewScreen() {
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
        12 FRANCHISES · 486 PLAYERS · 6 TITLES · MATCHDAY 18 OF 24
      </div>

      {/* KPI tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 16,
        }}
      >
        {adminKpis.map((k) => (
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

      {/* Needs Attention + Recent Activity */}
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
                color: SQ.ember,
                border: "1px solid rgba(255,61,46,.4)",
                padding: "3px 8px",
                borderRadius: 9,
              }}
            >
              4 OPEN
            </span>
          </div>
          {adminTasks.map((t) => (
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
                  border: `1px solid ${t.primary ? SQ.red : "rgba(255,255,255,.18)"}`,
                  padding: "9px 13px",
                  borderRadius: 5,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {t.btn}
              </Link>
            </div>
          ))}
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
          <div
            style={{
              background: SQ.panel,
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 8,
              padding: "6px 18px",
            }}
          >
            {adminActivity.map((a, i) => (
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
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13.5 }}>{a.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
