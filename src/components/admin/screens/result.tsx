"use client";

import { useEffect, useState } from "react";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import {
  useMatches,
  useMatch,
  useMatchRounds,
  useEnterRounds,
  useFranchiseRoster,
  useMatchPlayers,
} from "@/lib/query/hooks";
import type { MatchPlayerView, ParticipantView, RoundEntry } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/auth/context";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const numInput = {
  width: 62,
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "7px 8px",
  fontSize: 13,
  fontFamily: FONT.mono,
  color: SQ.ink,
  textAlign: "center",
} as const;

const textInput = {
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "9px 12px",
  fontSize: 13.5,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

type PlayerDraft = { kills: number };
type TeamDraft = { rank: number; kills: number; survivalMin: number; players: Record<string, PlayerDraft> };
// FFA scores each entrant individually — a per-player rank + kills line (no team wrapper).
type FfaPlayerDraft = { rank: number; kills: number };

const emptyTeam = (): TeamDraft => ({ rank: 0, kills: 0, survivalMin: 0, players: {} });
const emptyFfa = (): FfaPlayerDraft => ({ rank: 0, kills: 0 });

function parseLadder(csv: string): number[] {
  return csv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}
function placementForRank(ladder: number[], rank: number): number {
  const idx = rank - 1;
  return idx >= 0 && idx < ladder.length ? ladder[idx] : 0;
}

export function ResultScreen() {
  const matchesQ = useMatches({ limit: 50 });
  const [matchId, setMatchId] = useState("");
  const matchQ = useMatch(matchId || undefined);
  const roundsQ = useMatchRounds(matchId || undefined);
  // FFA player pool = the approved registrations for this match; only fetched for FFA fixtures.
  const matchPlayersQ = useMatchPlayers(
    matchQ.data?.matchType === "FFA" ? matchId || undefined : undefined,
  );
  const enterRounds = useEnterRounds();

  // Scoring weights (prefilled from the match; editable per match).
  const [pointsPerKill, setPointsPerKill] = useState(1);
  const [placementCsv, setPlacementCsv] = useState("15,12,10,8,6,4,2,1");

  const [detailMode, setDetailMode] = useState<"player" | "team">("player");
  const [rounds, setRounds] = useState<RoundEntry[]>([]);
  const [draftMap, setDraftMap] = useState("");
  const [draftMode, setDraftMode] = useState("");
  const [draft, setDraft] = useState<Record<string, TeamDraft>>({});
  const [ffaDraft, setFfaDraft] = useState<Record<string, FfaPlayerDraft>>({});
  const [seededFor, setSeededFor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const matches = matchesQ.data?.items ?? [];
  const participants = matchQ.data?.participants ?? [];
  const isFfa = matchQ.data?.matchType === "FFA";
  const ffaPlayers = matchPlayersQ.data ?? [];
  const ladder = parseLadder(placementCsv);

  // When a match is selected, prefill its weights and pre-stage any existing rounds so previous
  // results can be edited and re-published.
  useEffect(() => {
    if (!matchId || seededFor === matchId) return;
    if (!matchQ.data || roundsQ.data === undefined) return;
    // Wait for any in-flight refetch (e.g. after publishing) so we seed from fresh data, not the
    // stale cache TanStack still serves while revalidating.
    if (matchQ.isFetching || roundsQ.isFetching) return;
    setPointsPerKill(matchQ.data.pointsPerKill ?? 1);
    setPlacementCsv(matchQ.data.placementPoints ?? "15,12,10,8,6,4,2,1");
    // For FFA rounds the round view carries the entrant's PLAYER id in the franchiseId slot (the row
    // has no franchise), so re-stage it as playerId; franchise rounds keep franchiseId.
    const seedFfa = matchQ.data.matchType === "FFA";
    setRounds(
      (roundsQ.data ?? []).map((rd) => ({
        roundNumber: rd.roundNumber,
        mapName: rd.mapName,
        mode: rd.mode,
        rows: rd.rows.map((r) => ({
          franchiseId: seedFfa ? undefined : r.franchiseId,
          playerId: seedFfa ? r.franchiseId : undefined,
          rank: r.rank,
          kills: r.kills,
          survivalSeconds: r.survivalSeconds,
          players:
            !seedFfa && r.players && r.players.length
              ? r.players.map((p) => ({
                  playerId: p.playerId,
                  kills: p.kills,
                  survivalSeconds: p.survivalSeconds,
                }))
              : undefined,
        })),
      })),
    );
    setSeededFor(matchId);
  }, [matchId, matchQ.data, roundsQ.data, matchQ.isFetching, roundsQ.isFetching, seededFor]);

  const setRank = (fid: string, v: number) =>
    setDraft((d) => ({ ...d, [fid]: { ...(d[fid] ?? emptyTeam()), rank: v } }));
  const setTeamKills = (fid: string, v: number) =>
    setDraft((d) => ({ ...d, [fid]: { ...(d[fid] ?? emptyTeam()), kills: v } }));
  const setTeamSurv = (fid: string, v: number) =>
    setDraft((d) => ({ ...d, [fid]: { ...(d[fid] ?? emptyTeam()), survivalMin: v } }));
  const setPlayerKills = (fid: string, pid: string, v: number) =>
    setDraft((d) => {
      const cur = d[fid] ?? emptyTeam();
      return { ...d, [fid]: { ...cur, players: { ...cur.players, [pid]: { kills: v } } } };
    });

  const setFfaRank = (pid: string, v: number) =>
    setFfaDraft((d) => ({ ...d, [pid]: { ...(d[pid] ?? emptyFfa()), rank: v } }));
  const setFfaKills = (pid: string, v: number) =>
    setFfaDraft((d) => ({ ...d, [pid]: { ...(d[pid] ?? emptyFfa()), kills: v } }));

  const teamKills = (fid: string): number => {
    const t = draft[fid] ?? emptyTeam();
    if (detailMode === "player") {
      return Object.values(t.players).reduce((s, p) => s + (p.kills || 0), 0);
    }
    return t.kills || 0;
  };

  const addRound = () => {
    const rows = participants.map((p) => {
      const t = draft[p.franchiseId] ?? emptyTeam();
      if (detailMode === "player") {
        const players = Object.entries(t.players)
          .filter(([, pv]) => (pv.kills || 0) >= 0)
          .map(([pid, pv]) => ({ playerId: pid, kills: pv.kills || 0, survivalSeconds: 0 }));
        const kills = players.reduce((s, x) => s + x.kills, 0);
        return {
          franchiseId: p.franchiseId,
          rank: t.rank || 0,
          kills,
          survivalSeconds: (t.survivalMin || 0) * 60,
          players: players.length ? players : undefined,
        };
      }
      return {
        franchiseId: p.franchiseId,
        rank: t.rank || 0,
        kills: t.kills || 0,
        survivalSeconds: (t.survivalMin || 0) * 60,
      };
    });
    setRounds((r) => [...r, { roundNumber: r.length + 1, mapName: draftMap, mode: draftMode, rows }]);
    setDraft({});
    setDraftMap("");
    setDraftMode("");
    setMsg(null);
  };

  // Pull a staged round back into the editable draft cards (and off the staged list) so its values
  // can be corrected, then re-added. Makes editing a previously published round in-place possible.
  const editRound = (r: RoundEntry) => {
    const anyPlayers = r.rows.some((x) => x.players && x.players.length);
    setDetailMode(anyPlayers ? "player" : "team");
    setDraftMap(r.mapName ?? "");
    setDraftMode(r.mode ?? "");
    const next: Record<string, TeamDraft> = {};
    for (const row of r.rows) {
      if (!row.franchiseId) continue;
      const players: Record<string, PlayerDraft> = {};
      for (const pl of row.players ?? []) players[pl.playerId] = { kills: pl.kills };
      next[row.franchiseId] = {
        rank: row.rank,
        kills: row.kills,
        survivalMin: Math.round((row.survivalSeconds ?? 0) / 60),
        players,
      };
    }
    setDraft(next);
    setRounds((rs) =>
      rs.filter((x) => x.roundNumber !== r.roundNumber).map((x, i) => ({ ...x, roundNumber: i + 1 })),
    );
    setMsg(null);
  };

  // FFA round: every approved entrant becomes one result row identified by its playerId (FFA rows have
  // no franchise — the backend scores each entrant individually). Kills/rank are carried on the row.
  const addFfaRound = () => {
    const rows = ffaPlayers.map((m) => {
      const cur = ffaDraft[m.playerId] ?? emptyFfa();
      return {
        playerId: m.playerId,
        rank: cur.rank || 0,
        kills: cur.kills || 0,
        survivalSeconds: 0,
      };
    });
    setRounds((r) => [...r, { roundNumber: r.length + 1, mapName: draftMap, mode: draftMode, rows }]);
    setFfaDraft({});
    setDraftMap("");
    setDraftMode("");
    setMsg(null);
  };

  // Pull a staged FFA round back into the editable per-player draft (keyed by the row's player id).
  const editFfaRound = (r: RoundEntry) => {
    setDraftMap(r.mapName ?? "");
    setDraftMode(r.mode ?? "");
    const next: Record<string, FfaPlayerDraft> = {};
    for (const row of r.rows) {
      const pid = row.playerId ?? row.players?.[0]?.playerId ?? row.franchiseId;
      if (!pid) continue;
      next[pid] = { rank: row.rank, kills: row.kills || row.players?.[0]?.kills || 0 };
    }
    setFfaDraft(next);
    setRounds((rs) =>
      rs.filter((x) => x.roundNumber !== r.roundNumber).map((x, i) => ({ ...x, roundNumber: i + 1 })),
    );
    setMsg(null);
  };

  const removeRound = (roundNumber: number) =>
    setRounds((rs) =>
      rs.filter((x) => x.roundNumber !== roundNumber).map((x, i) => ({ ...x, roundNumber: i + 1 })),
    );

  const publish = async () => {
    setMsg(null);
    setErr(null);
    try {
      await enterRounds.mutateAsync({
        id: matchId,
        body: { pointsPerKill, placementPoints: placementCsv, rounds },
      });
      setMsg(`Published ${rounds.length} round(s) — placement points applied and standings recomputed.`);
      setSeededFor(""); // re-seed from the freshly published rounds
    } catch (e) {
      setErr(apiErrorMessage(e, "Could not publish results."));
    }
  };

  const pending = enterRounds.isPending;
  const editing = (roundsQ.data ?? []).length > 0;

  return (
    <div>
      <ScreenHeader eyebrow="Fixtures & results" title="ENTER RESULT" />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "18px 0 6px" }}>
        <select
          value={matchId}
          onChange={(e) => {
            setMatchId(e.target.value);
            setDraft({});
            setFfaDraft({});
            setRounds([]);
            setSeededFor("");
            setMsg(null);
          }}
          style={{ ...textInput, minWidth: 300, cursor: "pointer" }}
        >
          <option value="">Select a match…</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.game?.name} · {m.status}
              {m.arena ? ` · ${m.arena}` : ""}
            </option>
          ))}
        </select>
        {matchId && editing ? (
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".08em", color: SQ.amber }}>
            EDITING PUBLISHED RESULT — PUBLISH REPLACES IT
          </span>
        ) : null}
      </div>

      {err ? (
        <div style={{ margin: "10px 0 0", fontFamily: FONT.mono, fontSize: 12, color: SQ.red }}>{err}</div>
      ) : null}
      {msg ? (
        <div style={{ margin: "10px 0 0", fontFamily: FONT.mono, fontSize: 12, color: SQ.green }}>{msg}</div>
      ) : null}

      <div style={{ height: 1, background: SQ.hairline, margin: "20px 0 24px" }} />

      {!matchId ? (
        <StateNote>Pick a match to enter its result.</StateNote>
      ) : matchQ.isLoading ? (
        <StateNote>Loading match…</StateNote>
      ) : isFfa ? (
        matchPlayersQ.isLoading ? (
          <StateNote>Loading approved players…</StateNote>
        ) : ffaPlayers.length === 0 ? (
          <StateNote>This FFA match has no approved players yet.</StateNote>
        ) : (
          <>
            {/* scoring weights (FFA is per-player — no team/player toggle) */}
            <div
              style={{
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
                alignItems: "flex-end",
                background: SQ.panel,
                border: `1px solid ${SQ.hairline}`,
                borderRadius: 9,
                padding: "16px 18px",
                marginBottom: 20,
              }}
            >
              <label>
                <div style={{ ...headCell, marginBottom: 6 }}>POINTS / KILL</div>
                <input
                  type="number"
                  style={numInput}
                  value={pointsPerKill}
                  onChange={(e) => setPointsPerKill(Number(e.target.value) || 0)}
                />
              </label>
              <label style={{ flex: 1, minWidth: 220 }}>
                <div style={{ ...headCell, marginBottom: 6 }}>PLACEMENT POINTS (BY RANK, HIGHEST FIRST)</div>
                <input
                  style={{ ...textInput, width: "100%" }}
                  value={placementCsv}
                  onChange={(e) => setPlacementCsv(e.target.value)}
                  placeholder="15,12,10,8,6,4,2,1"
                />
              </label>
            </div>

            <StagedRounds rounds={rounds} onEdit={editFfaRound} onRemove={removeRound} />

            {/* draft round entry */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <input placeholder="Map (e.g. Ascent)" value={draftMap} onChange={(e) => setDraftMap(e.target.value)} style={{ ...textInput, flex: 1, minWidth: 160 }} />
              <input placeholder="Mode (e.g. FFA)" value={draftMode} onChange={(e) => setDraftMode(e.target.value)} style={{ ...textInput, width: 160 }} />
            </div>

            <FfaPoolCard
              players={ffaPlayers}
              draft={ffaDraft}
              pointsPerKill={pointsPerKill}
              ladder={ladder}
              onRank={setFfaRank}
              onKills={setFfaKills}
            />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
              <button
                type="button"
                onClick={addFfaRound}
                style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: SQ.ink, background: "transparent", border: `1px solid ${SQ.inputBorder}`, padding: "13px 20px", borderRadius: 5, cursor: "pointer" }}
              >
                + Add round
              </button>
              <button type="button" onClick={publish} disabled={pending || rounds.length === 0} style={publishBtn(pending || rounds.length === 0)}>
                {pending ? "Publishing…" : `Publish ${rounds.length || ""} round(s) ▸`}
              </button>
            </div>
          </>
        )
      ) : participants.length === 0 ? (
        <StateNote>This match has no participating franchises to score.</StateNote>
      ) : (
        <>
          {/* scoring weights + detail-mode bar */}
          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              alignItems: "flex-end",
              background: SQ.panel,
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 9,
              padding: "16px 18px",
              marginBottom: 20,
            }}
          >
            <label>
              <div style={{ ...headCell, marginBottom: 6 }}>POINTS / KILL</div>
              <input
                type="number"
                style={numInput}
                value={pointsPerKill}
                onChange={(e) => setPointsPerKill(Number(e.target.value) || 0)}
              />
            </label>
            <label style={{ flex: 1, minWidth: 220 }}>
              <div style={{ ...headCell, marginBottom: 6 }}>PLACEMENT POINTS (BY RANK, HIGHEST FIRST)</div>
              <input
                style={{ ...textInput, width: "100%" }}
                value={placementCsv}
                onChange={(e) => setPlacementCsv(e.target.value)}
                placeholder="15,12,10,8,6,4,2,1"
              />
            </label>
            <div style={{ display: "flex", gap: 6, background: SQ.inset, border: `1px solid ${SQ.hairline}`, borderRadius: 7, padding: 5 }}>
              {(["player", "team"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDetailMode(m)}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    padding: "8px 12px",
                    borderRadius: 5,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    color: detailMode === m ? SQ.sidebar : SQ.faint,
                    background: detailMode === m ? SQ.red : "transparent",
                  }}
                >
                  {m === "player" ? "Player detail" : "Team detail"}
                </button>
              ))}
            </div>
          </div>

          {/* staged rounds */}
          {rounds.length > 0 ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, marginBottom: 10 }}>
                {rounds.length} ROUND(S) STAGED
              </div>
              {rounds.map((r) => (
                <div
                  key={r.roundNumber}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 7, marginBottom: 8 }}
                >
                  <span style={{ fontFamily: FONT.display, fontSize: 15, color: SQ.ember }}>R{r.roundNumber}</span>
                  <span style={{ fontSize: 13 }}>
                    {r.mapName || "—"} {r.mode ? `· ${r.mode}` : ""}
                  </span>
                  <span style={{ marginLeft: "auto", fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>
                    {r.rows.length} teams
                    {r.rows.some((x) => x.players && x.players.length) ? " · per-player" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => editRound(r)}
                    style={{ background: "transparent", border: `1px solid ${SQ.inputBorder}`, color: SQ.faint, cursor: "pointer", fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", padding: "5px 9px", borderRadius: 4 }}
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRounds((rs) =>
                        rs.filter((x) => x.roundNumber !== r.roundNumber).map((x, i) => ({ ...x, roundNumber: i + 1 })),
                      )
                    }
                    style={{ background: "transparent", border: "none", color: SQ.mute, cursor: "pointer", fontSize: 14 }}
                    aria-label="Remove round"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* draft round entry */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <input placeholder="Map (e.g. Erangel)" value={draftMap} onChange={(e) => setDraftMap(e.target.value)} style={{ ...textInput, flex: 1, minWidth: 160 }} />
            <input placeholder="Mode (e.g. TPP)" value={draftMode} onChange={(e) => setDraftMode(e.target.value)} style={{ ...textInput, width: 160 }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {participants.map((p) => (
              <DraftTeamCard
                key={p.franchiseId}
                p={p}
                mode={detailMode}
                team={draft[p.franchiseId] ?? emptyTeam()}
                teamKills={teamKills(p.franchiseId)}
                placePts={placementForRank(ladder, draft[p.franchiseId]?.rank ?? 0)}
                pointsPerKill={pointsPerKill}
                onRank={(v) => setRank(p.franchiseId, v)}
                onKills={(v) => setTeamKills(p.franchiseId, v)}
                onSurv={(v) => setTeamSurv(p.franchiseId, v)}
                onPlayerKills={(pid, v) => setPlayerKills(p.franchiseId, pid, v)}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <button
              type="button"
              onClick={addRound}
              style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: SQ.ink, background: "transparent", border: `1px solid ${SQ.inputBorder}`, padding: "13px 20px", borderRadius: 5, cursor: "pointer" }}
            >
              + Add round
            </button>
            <button type="button" onClick={publish} disabled={pending || rounds.length === 0} style={publishBtn(pending || rounds.length === 0)}>
              {pending ? "Publishing…" : `Publish ${rounds.length || ""} round(s) ▸`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DraftTeamCard({
  p,
  mode,
  team,
  teamKills,
  placePts,
  pointsPerKill,
  onRank,
  onKills,
  onSurv,
  onPlayerKills,
}: {
  p: ParticipantView;
  mode: "player" | "team";
  team: TeamDraft;
  teamKills: number;
  placePts: number;
  pointsPerKill: number;
  onRank: (v: number) => void;
  onKills: (v: number) => void;
  onSurv: (v: number) => void;
  onPlayerKills: (pid: string, v: number) => void;
}) {
  const rosterQ = useFranchiseRoster(mode === "player" ? p.franchiseId : undefined);
  const roster = rosterQ.data ?? [];
  const total = teamKills * pointsPerKill + placePts;

  return (
    <div style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 140, fontWeight: 700, fontSize: 14.5 }}>
          {p.name} <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>{p.tag}</span>
        </div>
        <label style={{ textAlign: "center" }}>
          <div style={{ ...headCell, marginBottom: 4 }}>RANK</div>
          <input type="number" style={numInput} value={team.rank} onChange={(e) => onRank(Number(e.target.value) || 0)} />
        </label>
        {mode === "team" ? (
          <label style={{ textAlign: "center" }}>
            <div style={{ ...headCell, marginBottom: 4 }}>KILLS</div>
            <input type="number" style={numInput} value={team.kills} onChange={(e) => onKills(Number(e.target.value) || 0)} />
          </label>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ ...headCell, marginBottom: 4 }}>KILLS</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 14, color: SQ.ink, paddingTop: 6 }}>{teamKills}</div>
          </div>
        )}
        <label style={{ textAlign: "center" }}>
          <div style={{ ...headCell, marginBottom: 4 }}>SURV (MIN)</div>
          <input type="number" style={numInput} value={team.survivalMin} onChange={(e) => onSurv(Number(e.target.value) || 0)} />
        </label>
        <div style={{ textAlign: "center" }}>
          <div style={{ ...headCell, marginBottom: 4 }}>PLACE PTS</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 14, color: SQ.faint, paddingTop: 6 }}>+{placePts}</div>
        </div>
        <div style={{ textAlign: "right", width: 70 }}>
          <div style={{ ...headCell, marginBottom: 4 }}>TOTAL</div>
          <div style={{ fontFamily: FONT.display, fontSize: 17, paddingTop: 2 }}>{total}</div>
        </div>
      </div>

      {mode === "player" ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${SQ.hairlineSoft}` }}>
          {rosterQ.isLoading ? (
            <div style={{ fontSize: 12, color: SQ.mute }}>Loading roster…</div>
          ) : roster.length === 0 ? (
            <div style={{ fontSize: 12, color: SQ.mute }}>No roster — use Team detail to enter team kills.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {roster.map((m) => (
                <label key={m.playerId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>{m.gamerTag}</span>
                  <input
                    type="number"
                    style={{ ...numInput, width: 56 }}
                    value={team.players[m.playerId]?.kills ?? 0}
                    onChange={(e) => onPlayerKills(m.playerId, Number(e.target.value) || 0)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Shared staged-rounds list (generic over franchise/FFA rows). The FRANCHISE branch keeps its own
// inline copy unchanged; this is used by the FFA branch.
function StagedRounds({
  rounds,
  onEdit,
  onRemove,
}: {
  rounds: RoundEntry[];
  onEdit: (r: RoundEntry) => void;
  onRemove: (roundNumber: number) => void;
}) {
  if (rounds.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, marginBottom: 10 }}>
        {rounds.length} ROUND(S) STAGED
      </div>
      {rounds.map((r) => (
        <div
          key={r.roundNumber}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 7, marginBottom: 8 }}
        >
          <span style={{ fontFamily: FONT.display, fontSize: 15, color: SQ.ember }}>R{r.roundNumber}</span>
          <span style={{ fontSize: 13 }}>
            {r.mapName || "—"} {r.mode ? `· ${r.mode}` : ""}
          </span>
          <span style={{ marginLeft: "auto", fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>
            {r.rows.length} entries
            {r.rows.some((x) => x.players && x.players.length) ? " · per-player" : ""}
          </span>
          <button
            type="button"
            onClick={() => onEdit(r)}
            style={{ background: "transparent", border: `1px solid ${SQ.inputBorder}`, color: SQ.faint, cursor: "pointer", fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", padding: "5px 9px", borderRadius: 4 }}
          >
            EDIT
          </button>
          <button
            type="button"
            onClick={() => onRemove(r.roundNumber)}
            style={{ background: "transparent", border: "none", color: SQ.mute, cursor: "pointer", fontSize: 14 }}
            aria-label="Remove round"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// A single FFA pool card: every approved entrant gets a per-player rank + kills line, with live
// place-points/total previews mirroring the franchise DraftTeamCard's column set (minus survival).
function FfaPoolCard({
  players,
  draft,
  pointsPerKill,
  ladder,
  onRank,
  onKills,
}: {
  players: MatchPlayerView[];
  draft: Record<string, FfaPlayerDraft>;
  pointsPerKill: number;
  ladder: number[];
  onRank: (pid: string, v: number) => void;
  onKills: (pid: string, v: number) => void;
}) {
  return (
    <div style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 10, borderBottom: `1px solid ${SQ.hairlineSoft}` }}>
        <div style={{ ...headCell, flex: 1, minWidth: 140 }}>PLAYER</div>
        <div style={{ ...headCell, width: 62, textAlign: "center" }}>RANK</div>
        <div style={{ ...headCell, width: 62, textAlign: "center" }}>KILLS</div>
        <div style={{ ...headCell, width: 62, textAlign: "center" }}>PLACE PTS</div>
        <div style={{ ...headCell, width: 70, textAlign: "right" }}>TOTAL</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {players.map((m) => {
          const cur = draft[m.playerId] ?? emptyFfa();
          const placePts = placementForRank(ladder, cur.rank || 0);
          const total = (cur.kills || 0) * pointsPerKill + placePts;
          const affiliation = m.franchiseTag ?? m.squadName;
          return (
            <div key={m.playerId} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{m.gamerTag}</span>{" "}
                {affiliation ? (
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>{affiliation}</span>
                ) : null}
              </div>
              <input
                type="number"
                style={{ ...numInput, width: 62 }}
                value={cur.rank}
                onChange={(e) => onRank(m.playerId, Number(e.target.value) || 0)}
              />
              <input
                type="number"
                style={{ ...numInput, width: 62 }}
                value={cur.kills}
                onChange={(e) => onKills(m.playerId, Number(e.target.value) || 0)}
              />
              <div style={{ width: 62, textAlign: "center", fontFamily: FONT.mono, fontSize: 14, color: SQ.faint }}>+{placePts}</div>
              <div style={{ width: 70, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}>{total}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function publishBtn(disabled: boolean) {
  return {
    fontFamily: FONT.mono,
    fontSize: 11,
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: SQ.sidebar,
    background: SQ.red,
    border: "none",
    padding: "13px 20px",
    borderRadius: 5,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    marginTop: 22,
  };
}
