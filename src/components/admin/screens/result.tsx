"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { SQ, FONT, matchStatusColors } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import { SearchableSelect } from "@/components/sidequest/searchable-select";
import {
  useMatches,
  useMatch,
  useMatchRounds,
  useEnterRounds,
  useMatchPlayers,
} from "@/lib/query/hooks";
import type {
  GameType,
  MatchDetail,
  MatchPlayerView,
  ParticipantView,
  RoundEntry,
  RoundResultEntry,
} from "@/lib/api/types";
import { shortDate } from "@/lib/adapters/league";
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

// Outline "ghost" button used for lightweight convenience actions (auto-rank, etc.).
const ghostBtn = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: SQ.faint,
  background: "transparent",
  border: `1px solid ${SQ.inputBorder}`,
  padding: "9px 14px",
  borderRadius: 5,
  cursor: "pointer",
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

function statusLabel(s: string): string {
  if (s === "AWAITING_RESULT") return "Awaiting result";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// TACTICAL / SPORTS / FIGHTING are scored as a single result per participant (no placement ladder).
// BATTLE_ROYALE / PARTY (and an unknown/missing gameType) keep the per-round placement flow.
function isSingleResultGenre(gt: GameType | undefined): boolean {
  return gt === "TACTICAL" || gt === "SPORTS" || gt === "FIGHTING";
}

// Friendly genre label + a one-line "what to enter" hint shown in the match context header.
function genreMeta(gt: GameType | undefined): { label: string; hint: string } {
  switch (gt) {
    case "BATTLE_ROYALE":
      return { label: "Battle Royale", hint: "Per round: enter each entrant's placement rank + kills." };
    case "PARTY":
      return { label: "Party", hint: "Per round: enter each entrant's placement rank + points." };
    case "TACTICAL":
      return { label: "Tactical", hint: "Enter one map/series score per participant — rank follows the score." };
    case "SPORTS":
      return { label: "Sports", hint: "Enter goals for each side — rank follows the goal count." };
    case "FIGHTING":
      return { label: "Fighting", hint: "Enter stocks / rounds won per player — rank follows the score." };
    default:
      return { label: "", hint: "" };
  }
}

// The single-result score field label per genre.
function scoreLabelFor(gt: GameType | undefined): string {
  if (gt === "SPORTS") return "Goals";
  if (gt === "FIGHTING") return "Stocks";
  return "Map score"; // TACTICAL (and fallback)
}

// Lightweight, non-blocking pre-publish checks: flag duplicate ranks inside a round and a placement
// ladder that is too short to score every entrant.
function computeWarnings(rounds: RoundEntry[], ladder: number[], entrantCount: number): string[] {
  const out: string[] = [];
  for (const r of rounds) {
    const seen = new Set<number>();
    const dups = new Set<number>();
    for (const row of r.rows) {
      if (!row.rank || row.rank <= 0) continue;
      if (seen.has(row.rank)) dups.add(row.rank);
      else seen.add(row.rank);
    }
    if (dups.size) {
      out.push(
        `Round ${r.roundNumber} has duplicate rank(s): ${[...dups]
          .sort((a, b) => a - b)
          .join(", ")}.`,
      );
    }
  }
  if (entrantCount > 0 && ladder.length > 0 && ladder.length < entrantCount) {
    out.push(
      `Placement ladder lists ${ladder.length} rank(s) for ${entrantCount} entrants — anyone past rank ${ladder.length} scores 0 placement points.`,
    );
  }
  return out;
}

export function ResultScreen() {
  const matchesQ = useMatches({ limit: 50 });
  // Preselect a match from ?match=<id> (used by the per-row "Enter/Edit result" buttons). The
  // seeding effect below keys off matchId, so URL-preselected matches prefill/edit automatically.
  const sp = useSearchParams();
  const [matchId, setMatchId] = useState(sp.get("match") ?? "");
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
  // Single-result (TACTICAL/SPORTS/FIGHTING) draft: one numeric score per entrant, keyed by
  // franchiseId (franchise match) or playerId (FFA match).
  const [scoreDraft, setScoreDraft] = useState<Record<string, number>>({});
  const [seededFor, setSeededFor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const matches = matchesQ.data?.items ?? [];
  const participants = matchQ.data?.participants ?? [];
  const isFfa = matchQ.data?.matchType === "FFA";
  const ffaPlayers = matchPlayersQ.data ?? [];
  const ladder = parseLadder(placementCsv);
  const entrantCount = isFfa ? ffaPlayers.length : participants.length;

  // Genre drives presentation only (the placement flow vs the streamlined single-result card). The
  // publish payload for BR/PARTY is unchanged; single-result builds one round over the same request.
  const gameType = matchQ.data?.game?.gameType;
  const singleResult = isSingleResultGenre(gameType);
  const scoreLabel = scoreLabelFor(gameType);
  // Single-result entrants: participating franchises, or FFA entrants. `sub` is the small mono affix.
  const singleEntrants = isFfa
    ? ffaPlayers.map((m) => ({ id: m.playerId, name: m.gamerTag, sub: m.franchiseTag ?? m.squadName }))
    : participants.map((p) => ({ id: p.franchiseId, name: p.name, sub: p.tag }));

  // Select (or clear, with "") a match and wipe any in-progress draft/staged state.
  const chooseMatch = (id: string) => {
    setMatchId(id);
    setDraft({});
    setFfaDraft({});
    setScoreDraft({});
    setRounds([]);
    setDraftMap("");
    setDraftMode("");
    setSeededFor("");
    setMsg(null);
    setErr(null);
  };

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
    // Single-result genres edit ONE result, so seed the per-entrant score draft from the first
    // published round's rows (kills == score; FFA entrant ids ride in the franchiseId slot).
    if (isSingleResultGenre(matchQ.data.game?.gameType)) {
      const first = (roundsQ.data ?? [])[0];
      const nextScores: Record<string, number> = {};
      for (const row of first?.rows ?? []) {
        if (row.franchiseId) nextScores[row.franchiseId] = row.kills;
      }
      setScoreDraft(nextScores);
      // Restore the map/mode too so re-publishing an edit doesn't blank them.
      setDraftMap(first?.mapName ?? "");
      setDraftMode(first?.mode ?? "");
    }
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

  const setScore = (id: string, v: number) => setScoreDraft((d) => ({ ...d, [id]: v }));

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

  // Convenience: assign ranks 1..N by descending kills to the CURRENT draft (BR/FFA only). Pure UI —
  // it fills the same rank fields the admin would type, so the published payload is unaffected.
  const autoRankFranchise = () => {
    [...participants]
      .map((p) => ({ fid: p.franchiseId, kills: teamKills(p.franchiseId) }))
      .sort((a, b) => b.kills - a.kills)
      .forEach((o, i) => setRank(o.fid, i + 1));
  };
  const autoRankFfa = () => {
    [...ffaPlayers]
      .map((m) => ({ pid: m.playerId, kills: ffaDraft[m.playerId]?.kills ?? 0 }))
      .sort((a, b) => b.kills - a.kills)
      .forEach((o, i) => setFfaRank(o.pid, i + 1));
  };

  // Single-result publish: one RoundEntry whose rows carry the entrant's score as `kills`, rank
  // auto-assigned by score DESC (ties keep input order), placement ladder empty, points/kill = 1 so
  // total == score. Reuses the SAME useEnterRounds mutation — the backend path is unchanged.
  const publishSingle = async () => {
    setMsg(null);
    setErr(null);
    const rankOf = new Map<string, number>();
    singleEntrants
      .map((e, order) => ({ id: e.id, score: scoreDraft[e.id] ?? 0, order }))
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .forEach((e, i) => rankOf.set(e.id, i + 1));
    const rows: RoundResultEntry[] = singleEntrants.map((e) => ({
      franchiseId: isFfa ? undefined : e.id,
      playerId: isFfa ? e.id : undefined,
      rank: rankOf.get(e.id) ?? 0,
      kills: scoreDraft[e.id] ?? 0,
      survivalSeconds: 0,
    }));
    const round: RoundEntry = { roundNumber: 1, mapName: draftMap, mode: draftMode, rows };
    try {
      await enterRounds.mutateAsync({
        id: matchId,
        body: { pointsPerKill: 1, placementPoints: "", rounds: [round] },
      });
      setMsg("Published result — standings recomputed.");
      setSeededFor(""); // re-seed from the freshly published round
    } catch (e) {
      setErr(apiErrorMessage(e, "Could not publish results."));
    }
  };

  const pending = enterRounds.isPending;
  const editing = (roundsQ.data ?? []).length > 0;
  const warnings = computeWarnings(rounds, ladder, entrantCount);

  return (
    <div>
      <ScreenHeader eyebrow="Fixtures & results" title="ENTER RESULT" />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "18px 0 6px" }}>
        {!matchId ? (
          <div style={{ width: "100%", maxWidth: 420 }}>
            <SearchableSelect
              value={matchId}
              onChange={chooseMatch}
              options={matches.map((m) => ({
                value: m.id,
                label: `${m.game?.name ?? "Match"} · ${statusLabel(m.status)}`,
                hint: m.arena || undefined,
              }))}
              placeholder="Select a match…"
              searchPlaceholder="Search matches…"
            />
          </div>
        ) : null}
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

      {matchId && matchQ.data ? (
        <MatchContextHeader
          match={matchQ.data}
          entrantCount={entrantCount}
          entrantWord={isFfa ? "entrants" : "franchises"}
          onChange={() => chooseMatch("")}
        />
      ) : null}

      {!matchId ? (
        <StateNote>Pick a match to enter its result.</StateNote>
      ) : matchQ.isLoading ? (
        <StateNote>Loading match…</StateNote>
      ) : singleResult ? (
        // TACTICAL / SPORTS / FIGHTING — one score per participant, rank derived from the score.
        isFfa && matchPlayersQ.isLoading ? (
          <StateNote>Loading approved players…</StateNote>
        ) : isFfa && ffaPlayers.length === 0 ? (
          <StateNote>This FFA match has no approved players yet.</StateNote>
        ) : !isFfa && participants.length === 0 ? (
          <StateNote>This match has no participating franchises to score.</StateNote>
        ) : (
          <>
            <SectionHeader>Result</SectionHeader>
            <RoundMetaInputs
              map={draftMap}
              mode={draftMode}
              onMap={setDraftMap}
              onMode={setDraftMode}
              mapPlaceholder="Map / venue (optional)"
              modePlaceholder="Mode (optional)"
            />
            <SingleResultCard
              entrants={singleEntrants}
              scoreDraft={scoreDraft}
              scoreLabel={scoreLabel}
              onScore={setScore}
            />
            <RoundActions
              onPublish={publishSingle}
              pending={pending}
              roundCount={singleEntrants.length ? 1 : 0}
              publishLabel="Publish result ▸"
            />
          </>
        )
      ) : isFfa ? (
        matchPlayersQ.isLoading ? (
          <StateNote>Loading approved players…</StateNote>
        ) : ffaPlayers.length === 0 ? (
          <StateNote>This FFA match has no approved players yet.</StateNote>
        ) : (
          <>
            <SectionHeader>Scoring</SectionHeader>
            {/* FFA is per-player — no team/player toggle */}
            <ScoringWeightsBar
              pointsPerKill={pointsPerKill}
              placementCsv={placementCsv}
              onKill={setPointsPerKill}
              onPlacement={setPlacementCsv}
            />

            {rounds.length > 0 ? <SectionHeader>Staged rounds</SectionHeader> : null}
            <StagedRounds rounds={rounds} onEdit={editFfaRound} onRemove={removeRound} entrantWord="entries" />

            <SectionHeader>Round entry</SectionHeader>
            <RoundMetaInputs
              map={draftMap}
              mode={draftMode}
              onMap={setDraftMap}
              onMode={setDraftMode}
              mapPlaceholder="Map (e.g. Ascent)"
              modePlaceholder="Mode (e.g. FFA)"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button type="button" onClick={autoRankFfa} style={ghostBtn}>
                Auto-rank by kills
              </button>
            </div>

            <FfaPoolCard
              players={ffaPlayers}
              draft={ffaDraft}
              pointsPerKill={pointsPerKill}
              ladder={ladder}
              onRank={setFfaRank}
              onKills={setFfaKills}
            />

            <WarnList warnings={warnings} />

            <RoundActions onAdd={addFfaRound} onPublish={publish} pending={pending} roundCount={rounds.length} />
          </>
        )
      ) : participants.length === 0 ? (
        <StateNote>This match has no participating franchises to score.</StateNote>
      ) : (
        <>
          <SectionHeader>Scoring</SectionHeader>
          {/* scoring weights + detail-mode toggle (passed as children) */}
          <ScoringWeightsBar
            pointsPerKill={pointsPerKill}
            placementCsv={placementCsv}
            onKill={setPointsPerKill}
            onPlacement={setPlacementCsv}
          >
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
          </ScoringWeightsBar>

          {rounds.length > 0 ? <SectionHeader>Staged rounds</SectionHeader> : null}
          <StagedRounds rounds={rounds} onEdit={editRound} onRemove={removeRound} entrantWord="teams" />

          <SectionHeader>Round entry</SectionHeader>
          <RoundMetaInputs
            map={draftMap}
            mode={draftMode}
            onMap={setDraftMap}
            onMode={setDraftMode}
            mapPlaceholder="Map (e.g. Erangel)"
            modePlaceholder="Mode (e.g. TPP)"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button type="button" onClick={autoRankFranchise} style={ghostBtn}>
              Auto-rank by kills
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {participants.map((p) => (
              <DraftTeamCard
                key={p.franchiseId}
                p={p}
                matchId={matchId}
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

          <WarnList warnings={warnings} />

          <RoundActions onAdd={addRound} onPublish={publish} pending={pending} roundCount={rounds.length} />
        </>
      )}
    </div>
  );
}

function DraftTeamCard({
  p,
  matchId,
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
  matchId: string;
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
  // Source the per-player kill rows from the match's FIELDED LINEUP (GET /matches/{id}/players
  // returns each franchise's assigned lineup, falling back to its full roster when none is set),
  // filtered to this franchise. TanStack dedupes the shared query across every team card.
  const playersQ = useMatchPlayers(mode === "player" ? matchId : undefined);
  const roster = (playersQ.data ?? []).filter((pl) => pl.franchiseId === p.franchiseId);
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
          {playersQ.isLoading ? (
            <div style={{ fontSize: 12, color: SQ.mute }}>Loading lineup…</div>
          ) : roster.length === 0 ? (
            <div style={{ fontSize: 12, color: SQ.mute }}>No lineup — use Team detail to enter team kills.</div>
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

// Lightweight mono section header so the long entry column reads as distinct sections.
function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 10,
        letterSpacing: ".2em",
        textTransform: "uppercase",
        color: SQ.dim,
        margin: "0 0 12px",
      }}
    >
      {children}
    </div>
  );
}

// Scoring weights panel (points/kill + placement CSV) shared by the franchise and FFA branches.
// The franchise branch passes its player/team detail toggle as `children` (rendered after the fields).
function ScoringWeightsBar({
  pointsPerKill,
  placementCsv,
  onKill,
  onPlacement,
  children,
}: {
  pointsPerKill: number;
  placementCsv: string;
  onKill: (v: number) => void;
  onPlacement: (v: string) => void;
  children?: ReactNode;
}) {
  return (
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
          onChange={(e) => onKill(Number(e.target.value) || 0)}
        />
      </label>
      <label style={{ flex: 1, minWidth: 220 }}>
        <div style={{ ...headCell, marginBottom: 6 }}>PLACEMENT POINTS (BY RANK, HIGHEST FIRST)</div>
        <input
          style={{ ...textInput, width: "100%" }}
          value={placementCsv}
          onChange={(e) => onPlacement(e.target.value)}
          placeholder="15,12,10,8,6,4,2,1"
        />
      </label>
      {children}
    </div>
  );
}

// Map/mode inputs for a round (placeholders differ per branch/genre).
function RoundMetaInputs({
  map,
  mode,
  onMap,
  onMode,
  mapPlaceholder,
  modePlaceholder,
}: {
  map: string;
  mode: string;
  onMap: (v: string) => void;
  onMode: (v: string) => void;
  mapPlaceholder: string;
  modePlaceholder: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      <input placeholder={mapPlaceholder} value={map} onChange={(e) => onMap(e.target.value)} style={{ ...textInput, flex: 1, minWidth: 160 }} />
      <input placeholder={modePlaceholder} value={mode} onChange={(e) => onMode(e.target.value)} style={{ ...textInput, width: 160 }} />
    </div>
  );
}

// Add-round (optional) + publish button row, shared by both round-entry branches and the
// single-result card (which omits `onAdd` and supplies its own publish label).
function RoundActions({
  onAdd,
  onPublish,
  pending,
  roundCount,
  publishLabel,
}: {
  onAdd?: () => void;
  onPublish: () => void;
  pending: boolean;
  roundCount: number;
  publishLabel?: string;
}) {
  const disabled = pending || roundCount === 0;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: SQ.ink, background: "transparent", border: `1px solid ${SQ.inputBorder}`, padding: "13px 20px", borderRadius: 5, cursor: "pointer" }}
        >
          + Add round
        </button>
      ) : null}
      <button type="button" onClick={onPublish} disabled={disabled} style={publishBtn(disabled)}>
        {pending ? "Publishing…" : (publishLabel ?? `Publish ${roundCount || ""} round(s) ▸`)}
      </button>
    </div>
  );
}

// Streamlined single-result entry (TACTICAL/SPORTS/FIGHTING): one numeric score per participant with
// a live rank preview (rank follows the score, DESC; ties keep input order). Publishing turns this
// into ONE RoundEntry over the same EnterRoundsRequest — no placement ladder, points/kill = 1.
function SingleResultCard({
  entrants,
  scoreDraft,
  scoreLabel,
  onScore,
}: {
  entrants: { id: string; name: string; sub?: string }[];
  scoreDraft: Record<string, number>;
  scoreLabel: string;
  onScore: (id: string, v: number) => void;
}) {
  const rankOf = new Map<string, number>();
  entrants
    .map((e, order) => ({ id: e.id, score: scoreDraft[e.id] ?? 0, order }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .forEach((e, i) => rankOf.set(e.id, i + 1));
  return (
    <div style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 10, borderBottom: `1px solid ${SQ.hairlineSoft}` }}>
        <div style={{ ...headCell, flex: 1, minWidth: 140 }}>PARTICIPANT</div>
        <div style={{ ...headCell, width: 74, textAlign: "center" }}>{scoreLabel.toUpperCase()}</div>
        <div style={{ ...headCell, width: 70, textAlign: "right" }}>RANK</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {entrants.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</span>{" "}
              {e.sub ? (
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>{e.sub}</span>
              ) : null}
            </div>
            <input
              type="number"
              style={{ ...numInput, width: 74 }}
              value={scoreDraft[e.id] ?? 0}
              onChange={(ev) => onScore(e.id, Number(ev.target.value) || 0)}
            />
            <div style={{ width: 70, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}>
              #{rankOf.get(e.id)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Shared staged-rounds list used by both the FRANCHISE ("teams") and FFA ("entries") branches;
// `entrantWord` preserves each branch's wording for the per-round row count.
function StagedRounds({
  rounds,
  onEdit,
  onRemove,
  entrantWord,
}: {
  rounds: RoundEntry[];
  onEdit: (r: RoundEntry) => void;
  onRemove: (roundNumber: number) => void;
  entrantWord: "teams" | "entries";
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
            {r.rows.length} {entrantWord}
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

// Context card shown once a match is picked: game, stage, schedule, type badge, entrant count and a
// live status pill, plus a "Change match" affordance (the raw picker is hidden while a match is set).
function MatchContextHeader({
  match,
  entrantCount,
  entrantWord,
  onChange,
}: {
  match: MatchDetail;
  entrantCount: number;
  entrantWord: string;
  onChange: () => void;
}) {
  const label = statusLabel(match.status);
  const [stColor, stBorder] = matchStatusColors(label as Parameters<typeof matchStatusColors>[0]);
  const isFfa = match.matchType === "FFA";
  const genre = genreMeta(match.game?.gameType);
  const pillBase = {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: ".1em",
    padding: "4px 9px",
    borderRadius: 9,
  } as const;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 9,
        padding: "16px 18px",
        marginBottom: 20,
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontFamily: FONT.display, fontSize: 20, letterSpacing: "-.02em" }}>
          {match.game?.name ?? "Match"}
        </div>
        <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 4 }}>
          {match.arena || "No stage label"} · {shortDate(match.scheduledAt)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...pillBase, color: SQ.ember, border: `1px solid ${SQ.inputBorder}` }}>
          {isFfa ? "FFA" : "FRANCHISE"}
        </span>
        {genre.label ? (
          <span style={{ ...pillBase, color: SQ.blue, border: "1px solid rgba(59,111,212,.45)" }}>
            {genre.label.toUpperCase()}
          </span>
        ) : null}
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>
          {entrantCount} {entrantWord}
        </span>
        <span style={{ ...pillBase, color: stColor, border: `1px solid ${stBorder}` }}>{label}</span>
        <button
          type="button"
          onClick={onChange}
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: SQ.faint,
            background: "transparent",
            border: `1px solid ${SQ.inputBorder}`,
            padding: "6px 11px",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Change match
        </button>
      </div>
      {genre.hint ? (
        <div style={{ flexBasis: "100%", fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>
          {genre.hint}
        </div>
      ) : null}
    </div>
  );
}

// Non-blocking amber pre-publish warnings (duplicate ranks / short placement ladder).
function WarnList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 18,
        background: SQ.panel,
        border: "1px solid rgba(181,131,26,.5)",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".14em", color: SQ.amber, marginBottom: 6 }}>
        BEFORE YOU PUBLISH
      </div>
      {warnings.map((w, i) => (
        <div
          key={i}
          style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.amber, marginTop: i === 0 ? 0 : 4 }}
        >
          • {w}
        </div>
      ))}
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
