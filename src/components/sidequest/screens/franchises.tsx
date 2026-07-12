"use client";

import { useState } from "react";
import Link from "next/link";
import { franchiseHref } from "@/lib/routes";
import { SQ, FONT, rankAccent } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { useFranchises, useSeasons, useSeasonStandings, useAllTimeStandings } from "@/lib/query/hooks";
import { adaptFranchises } from "@/lib/adapters/league";

const ALL = "__all__";

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
  const isAll = selected === ALL;
  const code = selected || current?.code || seasons[0]?.code || "";
  const isCurrent = !isAll && !!current && code === current.code;

  // Live franchises for the current season; frozen snapshot for finished seasons;
  // aggregated all-time standings for the "All seasons" view.
  // Explicit high limit so the league table isn't silently clamped to the server default (20 rows).
  const liveQ = useFranchises({ active: true, limit: 100 });
  const snapshotQ = useSeasonStandings(isCurrent || isAll ? undefined : code || undefined);
  const allTimeQ = useAllTimeStandings();
  const live = liveQ.data ? adaptFranchises(liveQ.data.items) : [];

  // The frozen-snapshot table markup is reused for both a finished season and the
  // combined all-time view; feed it whichever SeasonStandingView[] source applies.
  const snapshotData = isAll ? (allTimeQ.data ?? []) : (snapshotQ.data ?? []);
  const snapshotLoading = isAll ? allTimeQ.isLoading : snapshotQ.isLoading;
  const snapshotError = isAll ? allTimeQ.isError : snapshotQ.isError;

  const isLoading =
    (seasonsQ.isLoading && seasons.length === 0) ||
    (isCurrent ? liveQ.isLoading : snapshotLoading);
  const isError = isCurrent ? liveQ.isError : snapshotError;
  const seasonLabel = seasons.find((s) => s.code === code)?.name ?? code;
  const headerLabel = isAll
    ? "ALL SEASONS · COMBINED"
    : `${seasonLabel.toUpperCase()} · ${isCurrent ? "ONGOING" : "FINISHED"}`;

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
          {headerLabel}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {seasons.map((s) => {
            const active = !isAll && code === s.code;
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
          <button
            key={ALL}
            type="button"
            onClick={() => setSelected(ALL)}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".1em",
              padding: "8px 14px",
              borderRadius: 5,
              background: isAll ? SQ.red : "transparent",
              color: isAll ? SQ.league : SQ.faint,
              border: isAll ? "none" : `1px solid ${SQ.inputBorder}`,
              fontWeight: isAll ? 600 : 400,
              cursor: "pointer",
            }}
          >
            All seasons
          </button>
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
                    href={t.sub ? franchiseHref(t.sub) : `/franchise/${t.id}`}
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
      ) : snapshotData.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError
            ? "Couldn't reach the league API."
            : isAll
              ? "No standings recorded yet."
              : "No standings recorded for this season."}
        </StateNote>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
          <div style={{ minWidth: 480 }}>
            <div style={{ display: "flex", padding: "14px 18px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
              <div style={{ width: 44 }}>#</div>
              <div style={{ flex: 1 }}>FRANCHISE</div>
              <div style={{ width: 80, textAlign: "right" }}>PTS</div>
            </div>
            {snapshotData.map((r) => {
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
                <Link key={`${r.rank}-${r.tag}`} href={r.tag ? franchiseHref(r.tag) : `/franchise/${r.franchiseId}`} style={{ ...style, cursor: "pointer" }}>
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
