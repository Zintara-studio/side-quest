"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import {
  useSeasons,
  useSeasonStandings,
  useAllTimeStandings,
  useStartSeason,
  useFinishSeason,
  useMatches,
} from "@/lib/query/hooks";
import { useAuth } from "@/lib/auth/context";
import { apiErrorMessage } from "@/lib/api/client";
import { shortDate } from "@/lib/adapters/league";

const ALL = "__all__";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const formInput = {
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "9px 12px",
  fontSize: 13.5,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

export function HistoryScreen() {
  const seasonsQ = useSeasons();
  const seasons = seasonsQ.data ?? [];
  const current = seasons.find((s) => s.current);

  const [selected, setSelected] = useState<string>("");
  const code = selected || current?.code || seasons[0]?.code || "";
  const isAll = selected === ALL;

  const standingsQ = useSeasonStandings(isAll ? undefined : code || undefined);
  const allTimeQ = useAllTimeStandings();
  // When "All seasons" is picked, source the aggregated all-time standings
  // (same SeasonStandingView shape); otherwise the frozen per-season standings.
  const standingsRows = isAll ? (allTimeQ.data ?? []) : (standingsQ.data ?? []);
  const standingsLoading = isAll ? allTimeQ.isLoading : standingsQ.isLoading;
  const matchesQ = useMatches({ limit: 50 });
  const matches = useMemo(() => {
    const all = matchesQ.data?.items ?? [];
    // Untagged (null-season) fixtures — off-season FFA matches — always show alongside the season.
    return isAll ? all : all.filter((m) => m.seasonId === code || !m.seasonId);
  }, [matchesQ.data, isAll, code]);

  const { isSuperAdmin } = useAuth();
  const startSeason = useStartSeason();
  const finishSeason = useFinishSeason();
  const [newCode, setNewCode] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onStart = async () => {
    setMsg(null);
    setErr(null);
    if (!newCode.trim() || !newName.trim()) {
      setErr("Enter a season code and name.");
      return;
    }
    try {
      const s = await startSeason.mutateAsync({ code: newCode.trim(), name: newName.trim() });
      setMsg(`Started ${s.name}. Franchise points reset for the new season.`);
      setNewCode("");
      setNewName("");
      setSelected(s.code);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't start the season."));
    }
  };

  // Staged behind a themed confirm dialog (not the native window.confirm).
  const onFinish = () => {
    if (current) setConfirmFinish(true);
  };
  const doFinish = async () => {
    setMsg(null);
    setErr(null);
    if (!current) return;
    try {
      await finishSeason.mutateAsync();
      setMsg(`${current.name} finished and archived.`);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't finish the season."));
    } finally {
      setConfirmFinish(false);
    }
  };

  return (
    <div>
      <ScreenHeader eyebrow="Seasons & archives" title="HISTORY" />

      {/* season lifecycle controls — starting/finishing a season is main-admin-only */}
      {isSuperAdmin ? (
      <div
        style={{
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 9,
          padding: 18,
          margin: "18px 0 24px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <div>
            <div style={{ ...headCell, marginBottom: 6 }}>CURRENT SEASON</div>
            <div style={{ fontFamily: FONT.display, fontSize: 22 }}>
              {current ? current.name : "Between seasons"}
            </div>
          </div>
          {current ? (
            <button
              type="button"
              onClick={onFinish}
              disabled={finishSeason.isPending}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.ember,
                background: "transparent",
                border: "1px solid rgba(232,96,44,.45)",
                padding: "11px 16px",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              {finishSeason.isPending ? "Finishing…" : "Finish season"}
            </button>
          ) : null}
        </div>

        <div style={{ height: 1, background: SQ.hairlineSoft, margin: "16px 0" }} />

        <div style={{ ...headCell, marginBottom: 8 }}>START A NEW SEASON</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (e.g. S05)"
            style={{ ...formInput, width: 140 }}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Season 05 — Summer)"
            style={{ ...formInput, flex: 1, minWidth: 220 }}
          />
          <button
            type="button"
            onClick={onStart}
            disabled={startSeason.isPending}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: SQ.sidebar,
              background: SQ.red,
              border: "none",
              padding: "11px 18px",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            {startSeason.isPending ? "Starting…" : "Start season ▸"}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: SQ.mute, marginTop: 8 }}>
          The current season must be finished (and its standings frozen) before a new one can start.
          Starting a season resets franchise points to zero.
        </div>
        {msg ? <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.green, marginTop: 8 }}>{msg}</div> : null}
        {err ? <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember, marginTop: 8 }}>{err}</div> : null}
      </div>
      ) : (
        <div
          style={{
            background: SQ.panel,
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 9,
            padding: 18,
            margin: "18px 0 24px",
            fontSize: 12.5,
            color: SQ.mute,
          }}
        >
          Starting and finishing seasons is done by the main admin.
        </div>
      )}

      {/* season selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {[...seasons.map((s) => ({ code: s.code, label: `${s.code}${s.current ? " ·" : ""}` })), { code: ALL, label: "All seasons" }].map((opt) => {
          const active = (selected || current?.code || seasons[0]?.code || "") === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setSelected(opt.code)}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".06em",
                padding: "8px 13px",
                borderRadius: 5,
                border: `1px solid ${active ? SQ.red : SQ.inputBorder}`,
                color: active ? SQ.sidebar : SQ.faint,
                background: active ? SQ.red : "transparent",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 28,
        }}
      >
        {/* season standings */}
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 14 }}>
            {isAll ? "All-time Standings" : `${code} Standings`}
          </div>
          {standingsLoading ? (
            <StateNote>Loading standings…</StateNote>
          ) : standingsRows.length === 0 ? (
            <StateNote>{isAll ? "No standings recorded yet." : "No standings recorded for this season."}</StateNote>
          ) : (
            <TableScroll minWidth={320}>
              <div style={{ display: "flex", padding: "12px 16px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
                <div style={{ width: 40 }}>#</div>
                <div style={{ flex: 1 }}>FRANCHISE</div>
                <div style={{ width: 80, textAlign: "right" }}>POINTS</div>
              </div>
              {standingsRows.map((r) => (
                <div
                  key={`${r.rank}-${r.franchiseId}-${r.tag}`}
                  style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${SQ.hairlineSoft}` }}
                >
                  <div style={{ width: 40, fontFamily: FONT.display, fontSize: 16, color: r.rank === 1 ? SQ.red : SQ.steel }}>
                    {String(r.rank).padStart(2, "0")}
                  </div>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                    {r.name}
                    {r.tag ? <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginLeft: 6 }}>{r.tag}</span> : null}
                  </div>
                  <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 16 }}>{r.points}</div>
                </div>
              ))}
            </TableScroll>
          )}
        </div>

        {/* season match history */}
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 14 }}>
            Match History
          </div>
          {matchesQ.isLoading ? (
            <StateNote>Loading matches…</StateNote>
          ) : matches.length === 0 ? (
            <StateNote>No matches recorded for this season.</StateNote>
          ) : (
            <div>
              {matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/admin/match/${m.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 0",
                    borderTop: `1px solid ${SQ.hairlineCell}`,
                    textDecoration: "none",
                    color: SQ.ink,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.game?.name ?? "Match"}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: SQ.mute, marginTop: 2 }}>
                      {shortDate(m.scheduledAt)} · {m.status}
                      {m.matchType ? ` · ${m.matchType}` : ""}
                      {m.seasonId ? ` · ${m.seasonId}` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.dim }}>▸</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmFinish}
        title="Finish season"
        tone="destructive"
        message={
          current
            ? `Finish ${current.name}? Its standings will be frozen into history and a new season can then be started. Every rostered player (except owners/managers) is released for the next auction.`
            : "Finish the current season? Every rostered player (except owners/managers) is released for the next auction."
        }
        confirmLabel="Finish season"
        busy={finishSeason.isPending}
        onConfirm={doFinish}
        onClose={() => setConfirmFinish(false)}
      />
    </div>
  );
}
