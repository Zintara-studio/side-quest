"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT, rankAccent } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { useFranchises, useSeasons, useSeasonStandings } from "@/lib/query/hooks";
import { adaptFranchises } from "@/lib/adapters/league";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function FranchisesScreen() {
  const seasonsQ = useSeasons();
  const seasons = seasonsQ.data ?? [];
  const current = seasons.find((s) => s.current);
  const [selected, setSelected] = useState<string>("");
  const code = selected || current?.code || seasons[0]?.code || "";
  const isCurrent = !!current && code === current.code;

  // Live franchises for the current season; frozen snapshot for finished seasons.
  const liveQ = useFranchises({ active: true });
  const snapshotQ = useSeasonStandings(isCurrent ? undefined : code || undefined);
  const live = liveQ.data ? adaptFranchises(liveQ.data.items) : [];

  const isLoading =
    (seasonsQ.isLoading && seasons.length === 0) ||
    (isCurrent ? liveQ.isLoading : snapshotQ.isLoading);
  const isError = isCurrent ? liveQ.isError : snapshotQ.isError;
  const seasonLabel = seasons.find((s) => s.code === code)?.name ?? code;

  return (
    <div>
      <LeagueTitle eyebrow="League table" title="FRANCHISES" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "18px 0 22px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          {seasonLabel.toUpperCase()} · {isCurrent ? "ONGOING" : "FINISHED"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {seasons.map((s) => {
            const active = code === s.code;
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => setSelected(s.code)}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".1em",
                  padding: "8px 14px",
                  borderRadius: 5,
                  background: active ? SQ.red : "transparent",
                  color: active ? SQ.league : SQ.faint,
                  border: active ? "none" : `1px solid ${SQ.inputBorder}`,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {s.code}
                {s.current ? " ·" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <StateNote>Loading league table…</StateNote>
      ) : isCurrent ? (
        live.length === 0 ? (
          <StateNote tone={isError ? "error" : "muted"}>
            {isError ? "Couldn't reach the league API." : "No franchises yet."}
          </StateNote>
        ) : (
          <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
            <div style={{ minWidth: 640 }}>
              <div style={{ display: "flex", padding: "14px 18px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
                <div style={{ width: 44 }}>#</div>
                <div style={{ flex: 1 }}>FRANCHISE</div>
                <div style={{ width: 90, textAlign: "right" }}>ROSTER</div>
                <div style={{ width: 80, textAlign: "right" }}>PTS</div>
                <div style={{ width: 60, textAlign: "right" }}>STATUS</div>
              </div>
              {live.map((t) => {
                const accent = rankAccent(t.rank === "01");
                return (
                  <Link
                    key={t.id}
                    href={`/franchise/${t.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "14px 18px",
                      borderBottom: `1px solid ${SQ.hairlineSoft}`,
                      cursor: "pointer",
                      background: accent.rowBg,
                      textDecoration: "none",
                      color: SQ.ink,
                    }}
                  >
                    <div style={{ width: 44, fontFamily: FONT.display, fontSize: 17, color: accent.color }}>{t.rank}</div>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                      {t.name}
                      {t.sub ? (
                        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, fontWeight: 400, marginLeft: 6 }}>{t.sub}</span>
                      ) : null}
                    </div>
                    <div style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>{t.gp}</div>
                    <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}>{t.pts}</div>
                    <div style={{ width: 60, textAlign: "right", fontFamily: FONT.mono, fontSize: 12, color: t.formColor }}>{t.form}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        )
      ) : (snapshotQ.data ?? []).length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't reach the league API." : "No standings recorded for this season."}
        </StateNote>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
          <div style={{ minWidth: 480 }}>
            <div style={{ display: "flex", padding: "14px 18px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
              <div style={{ width: 44 }}>#</div>
              <div style={{ flex: 1 }}>FRANCHISE</div>
              <div style={{ width: 80, textAlign: "right" }}>PTS</div>
            </div>
            {(snapshotQ.data ?? []).map((r) => {
              const accent = rankAccent(r.rank === 1);
              const row = (
                <>
                  <div style={{ width: 44, fontFamily: FONT.display, fontSize: 17, color: accent.color }}>
                    {String(r.rank).padStart(2, "0")}
                  </div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                    {r.name}
                    {r.tag ? (
                      <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, fontWeight: 400, marginLeft: 6 }}>{r.tag}</span>
                    ) : null}
                  </div>
                  <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}>{r.points}</div>
                </>
              );
              const style = {
                display: "flex",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: `1px solid ${SQ.hairlineSoft}`,
                background: accent.rowBg,
                textDecoration: "none",
                color: SQ.ink,
              } as const;
              return r.franchiseId ? (
                <Link key={`${r.rank}-${r.tag}`} href={`/franchise/${r.franchiseId}`} style={{ ...style, cursor: "pointer" }}>
                  {row}
                </Link>
              ) : (
                <div key={`${r.rank}-${r.tag}`} style={style}>
                  {row}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
