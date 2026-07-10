"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SQ, FONT, rankAccent, matchStatusLabel, matchStatusColors } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import {
  useCreateDispute,
  useEndMatch,
  useMatch,
  useMatchLeaderboard,
  useMatchRoom,
  useMatchRounds,
  useMatchesInfinite,
  useGames,
  usePostMatchMessage,
  useSeasons,
} from "@/lib/query/hooks";
import { ConfirmModal } from "../confirm-modal";
import { useAuth } from "@/lib/auth/context";
import { apiErrorMessage } from "@/lib/api/client";
import { shortDate, shortTime } from "@/lib/adapters/league";

const ALL = "__all__";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

/** ISO → epoch ms, coercing invalid dates to 0 so they sink to the bottom of the sort. */
function ts(iso?: string): number {
  const t = new Date(iso ?? "").getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** [text color, border color] for a backend match status (uppercase). */
function matchStatusTone(status: string): { color: string; border: string; live: boolean; final: boolean } {
  const s = (status ?? "").toUpperCase();
  if (s === "LIVE") return { color: SQ.ember, border: "rgba(232,96,44,.45)", live: true, final: false };
  if (s === "SCHEDULED") return { color: SQ.blue, border: "rgba(59,111,212,.45)", live: false, final: false };
  if (s === "COMPLETED") return { color: SQ.green, border: "rgba(31,157,99,.45)", live: false, final: true };
  return { color: SQ.mute, border: SQ.inputBorder, live: false, final: false };
}

/** History route (/match with no id): the full match archive, newest first. */
function MatchHistory({ base }: { base: string }) {
  const seasonsQ = useSeasons();
  const seasons = seasonsQ.data ?? [];
  const current = seasons.find((s) => s.current);
  const [selected, setSelected] = useState<string>("");
  const code = selected || current?.code || seasons[0]?.code || "";
  const isAll = selected === ALL;

  // Search / game filter / sort controls over the archive. The game filter seeds from a ?game= param so
  // "View matches" on a games card lands here pre-filtered to that title.
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [gameFilter, setGameFilter] = useState(params.get("game") ?? "");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "status" | "game">("newest");
  const gamesQ = useGames(true);

  const mq = useMatchesInfinite({ limit: 100 });
  const loaded = (mq.data?.pages ?? []).flatMap((p) => p.items);

  // Filter client-side: season (untagged/off-season fixtures always show so they don't vanish between
  // seasons), then game, then a free-text search over teams / game / arena / format; finally sort.
  const q = search.trim().toLowerCase();
  const matches = loaded
    .filter((m) => isAll || m.seasonId === code || !m.seasonId)
    .filter((m) => !gameFilter || m.game.name === gameFilter)
    .filter((m) =>
      !q
        ? true
        : [m.game.name, m.arena ?? "", m.format ?? "", ...m.participantTags]
            .join(" ")
            .toLowerCase()
            .includes(q),
    )
    .sort((a, b) => {
      switch (sortMode) {
        case "oldest":
          return ts(a.scheduledAt) - ts(b.scheduledAt);
        case "status":
          return (a.status ?? "").localeCompare(b.status ?? "");
        case "game":
          return a.game.name.localeCompare(b.game.name);
        default:
          return ts(b.scheduledAt) - ts(a.scheduledAt);
      }
    });
  const finals = matches.filter((m) => (m.status ?? "").toUpperCase() === "COMPLETED").length;

  const controlStyle = {
    fontFamily: FONT.mono,
    fontSize: 11.5,
    background: SQ.inset,
    border: `1px solid ${SQ.inputBorder}`,
    borderRadius: 5,
    padding: "8px 11px",
    color: SQ.ink,
  } as const;

  return (
    <div>
      <LeagueTitle eyebrow="Match archive" title="MATCHES" />

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
          {matches.length} MATCHES · {finals} COMPLETED
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

      {/* search · game · sort */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, game, arena…"
          style={{ ...controlStyle, flex: 1, minWidth: 180 }}
        />
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          style={{ ...controlStyle, cursor: "pointer" }}
        >
          <option value="">All games</option>
          {(gamesQ.data ?? []).map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
          style={{ ...controlStyle, cursor: "pointer" }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="status">By status</option>
          <option value="game">By game</option>
        </select>
      </div>

      {mq.isLoading || seasonsQ.isLoading ? (
        // Wait for seasons too, so `code` is settled before filtering (avoids a wrong-season flash).
        <StateNote>Loading matches…</StateNote>
      ) : matches.length === 0 ? (
        <StateNote tone={mq.isError ? "error" : "muted"}>
          {mq.isError
            ? "Couldn't reach the league API."
            : isAll
              ? "No matches yet."
              : "No matches recorded for this season."}
        </StateNote>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
          <div style={{ minWidth: 620 }}>
            <div
              style={{
                display: "flex",
                padding: "14px 18px",
                borderBottom: `1px solid ${SQ.hairline}`,
                ...headCell,
              }}
            >
              <div style={{ width: 96 }}>DATE</div>
              <div style={{ flex: 1 }}>MATCH</div>
              <div style={{ width: 150, textAlign: "right" }}>STATUS</div>
            </div>
            {matches.map((m) => {
              const tone = matchStatusTone(m.status);
              const rowBg = tone.live
                ? "linear-gradient(90deg,rgba(232,96,44,.12),transparent)"
                : tone.final
                  ? "linear-gradient(90deg,rgba(31,157,99,.10),transparent)"
                  : "transparent";
              const title = m.participantTags.length
                ? m.participantTags.join(" vs ")
                : m.arena ?? m.game.name;
              const sub = [m.game.name.toUpperCase(), m.format].filter(Boolean).join(" · ");
              return (
                <Link
                  key={m.id}
                  href={`${base}/match/${m.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderBottom: `1px solid ${SQ.hairlineSoft}`,
                    background: rowBg,
                    textDecoration: "none",
                    color: SQ.ink,
                  }}
                >
                  <div style={{ width: 96, fontFamily: FONT.mono, fontSize: 12, color: SQ.faint }}>
                    {shortDate(m.scheduledAt)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
                    {sub ? (
                      <div
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10.5,
                          letterSpacing: ".08em",
                          color: SQ.mute,
                          marginTop: 4,
                        }}
                      >
                        {sub}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ width: 150, textAlign: "right" }}>
                    <span
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10.5,
                        letterSpacing: ".14em",
                        color: tone.color,
                        border: `1px solid ${tone.border}`,
                        padding: "6px 10px",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {(m.status ?? "").toUpperCase()}
                      {tone.final ? " ▸" : ""}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {mq.hasNextPage ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={() => mq.fetchNextPage()}
            disabled={mq.isFetchingNextPage}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11.5,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: SQ.faint,
              background: "transparent",
              border: `1px solid ${SQ.inputBorder}`,
              borderRadius: 6,
              padding: "10px 20px",
              cursor: mq.isFetchingNextPage ? "not-allowed" : "pointer",
            }}
          >
            {mq.isFetchingNextPage ? "Loading…" : "Load more matches"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MatchScreen({ id, base = "" }: { id?: string; base?: string }) {
  // MatchHistory reads useSearchParams (the ?game= autoselect), which must sit under a Suspense boundary
  // or the static prerender of /match fails.
  if (!id) {
    return (
      <Suspense fallback={null}>
        <MatchHistory base={base} />
      </Suspense>
    );
  }
  return <MatchDetail id={id} base={base} />;
}

/**
 * The live match room: the (participant-only) lobby code + venue + polled message feed, with an admin
 * compose box. Renders nothing for spectators or non-participants (the room query 403s and we hide it).
 */
function MatchRoomPanel({ matchId }: { matchId: string }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const roomQ = useMatchRoom(matchId, isAuthenticated);
  const post = usePostMatchMessage();
  const endMatch = useEndMatch();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const room = roomQ.data;

  if (!isAuthenticated || roomQ.isError || !room) return null;

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setErr(null);
    try {
      await post.mutateAsync({ id: matchId, body });
      setText("");
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't post the message."));
    }
  };

  return (
    <div
      style={{
        marginTop: 24,
        border: `1px solid ${room.live ? "rgba(232,96,44,.45)" : SQ.hairline}`,
        borderRadius: 10,
        background: room.live ? "linear-gradient(180deg,rgba(232,96,44,.06),transparent)" : SQ.panel,
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: SQ.ink,
          }}
        >
          Match Room
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: ".12em",
            color: room.live ? SQ.ember : SQ.mute,
            border: `1px solid ${room.live ? "rgba(232,96,44,.45)" : SQ.inputBorder}`,
            borderRadius: 999,
            padding: "3px 9px",
          }}
        >
          {room.live ? "● LIVE" : "CLOSED"}
        </span>
        {isAdmin && room.live ? (
          // Admins can wrap up right from inside the room instead of going back to the matches list.
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            disabled={endMatch.isPending}
            style={{
              marginLeft: "auto",
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: SQ.ember,
              background: "transparent",
              border: "1px solid rgba(232,96,44,.45)",
              borderRadius: 5,
              padding: "6px 12px",
              cursor: endMatch.isPending ? "default" : "pointer",
              opacity: endMatch.isPending ? 0.6 : 1,
            }}
          >
            End match
          </button>
        ) : null}
      </div>

      {room.roomId || room.venue ? (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
          {room.roomId ? (
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label }}>
                ROOM CODE
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 15, fontWeight: 700, color: SQ.ember, marginTop: 3 }}>
                {room.roomId}
              </div>
            </div>
          ) : null}
          {room.venue ? (
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label }}>
                VENUE
              </div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{room.venue}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {room.messages.length === 0 ? (
          <div style={{ fontSize: 12.5, color: SQ.mute }}>No messages yet.</div>
        ) : (
          room.messages.map((msg) => (
            <div
              key={msg.id}
              style={{ borderTop: `1px solid ${SQ.hairlineCell}`, paddingTop: 8 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".06em", color: SQ.ember }}>
                  {msg.authorName ?? "Admin"}
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>{shortTime(msg.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13.5, color: SQ.ink, marginTop: 3, lineHeight: 1.5 }}>{msg.body}</div>
            </div>
          ))
        )}
      </div>

      {isAdmin && room.live ? (
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <input
            className="sq-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Message the participants…"
            style={{
              flex: 1,
              background: SQ.inset,
              border: `1px solid ${SQ.field}`,
              borderRadius: 5,
              padding: "9px 12px",
              fontSize: 13.5,
              color: SQ.ink,
              fontFamily: FONT.sans,
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={post.isPending || !text.trim()}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: SQ.league,
              background: SQ.red,
              border: "none",
              borderRadius: 5,
              padding: "9px 16px",
              cursor: post.isPending || !text.trim() ? "not-allowed" : "pointer",
              opacity: post.isPending || !text.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </div>
      ) : null}
      {err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 8 }}>{err}</div>
      ) : null}

      <ConfirmModal
        open={confirmEnd}
        title="End match?"
        message="This moves the match to results-pending and closes its room. Participants are notified."
        confirmLabel="End match"
        busy={endMatch.isPending}
        onConfirm={async () => {
          try {
            setErr(null);
            await endMatch.mutateAsync(matchId);
          } catch (e) {
            setErr(apiErrorMessage(e, "Couldn't end the match."));
          } finally {
            setConfirmEnd(false);
          }
        }}
        onClose={() => setConfirmEnd(false)}
      />
    </div>
  );
}

function MatchDetail({ id, base }: { id: string; base: string }) {
  const mq = useMatch(id);
  const lbQ = useMatchLeaderboard(id);
  const roundsQ = useMatchRounds(id);
  const m = mq.data;
  const rounds = roundsQ.data ?? [];

  const { isAuthenticated } = useAuth();
  const createDispute = useCreateDispute();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeErr, setDisputeErr] = useState<string | null>(null);
  const [disputeDone, setDisputeDone] = useState(false);

  const submitDispute = async () => {
    if (!disputeReason.trim()) {
      setDisputeErr("Describe what was wrong with the result.");
      return;
    }
    setDisputeErr(null);
    try {
      await createDispute.mutateAsync({ matchId: id, reason: disputeReason.trim(), category: "RESULT" });
      setDisputeDone(true);
    } catch (e) {
      setDisputeErr(apiErrorMessage(e, "Couldn't submit the dispute."));
    }
  };

  return (
    <div>
      <Link
        href={base ? `${base}/matches` : "/match"}
        style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, textDecoration: "none" }}
      >
        ◂ MATCHES
      </Link>

      {mq.isLoading ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Loading match…</StateNote>
        </div>
      ) : !m ? (
        <div style={{ marginTop: 20 }}>
          <StateNote tone="error">Couldn't load this match.</StateNote>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: 14,
              paddingBottom: 24,
              borderBottom: `1px solid ${SQ.hairline}`,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: SQ.red,
                }}
              >
                {m.game?.name ?? "Match"} · {m.format ?? ""}
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: "clamp(34px,5vw,60px)",
                  lineHeight: 0.92,
                  letterSpacing: "-.03em",
                  marginTop: 12,
                }}
              >
                {m.game?.name?.toUpperCase() ?? "MATCH"}
              </div>
              <div
                style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute, marginTop: 14 }}
              >
                {[m.arena, shortDate(m.scheduledAt), m.format].filter(Boolean).join(" · ")}
              </div>
            </div>
            {(() => {
              const label = matchStatusLabel(m.status);
              const [stColor, stBorder] = matchStatusColors(
                label as Parameters<typeof matchStatusColors>[0],
              );
              return (
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                    color: stColor,
                    border: `1px solid ${stBorder}`,
                    padding: "8px 14px",
                    borderRadius: 4,
                  }}
                >
                  {label}
                </div>
              );
            })()}
          </div>

          {/* Fans can flag an unfair/incorrect result on a completed fixture. */}
          {m.status === "COMPLETED" && isAuthenticated ? (
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setDisputeReason("");
                  setDisputeErr(null);
                  setDisputeDone(false);
                  setDisputeOpen(true);
                }}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10.5,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: SQ.faint,
                  background: "transparent",
                  border: `1px solid ${SQ.inputBorder}`,
                  padding: "8px 14px",
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                Dispute result
              </button>
            </div>
          ) : null}

          {/* live match room (participant-only; hidden for spectators/non-participants) */}
          {m.status === "LIVE" ? <MatchRoomPanel matchId={id} /> : null}

          {/* participants */}
          {m.participants.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
              {m.participants.map((p) => (
                <Link
                  key={p.franchiseId}
                  href={`${base}/franchise/${p.franchiseId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1px solid ${SQ.hairline}`,
                    background: SQ.panel,
                    textDecoration: "none",
                    color: SQ.ink,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                  {p.tag ? (
                    <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>{p.tag}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}

          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              margin: "34px 0 14px",
            }}
          >
            Match Leaderboard
          </div>

          {!m.hasResults ? (
            <StateNote>Results are pending — check back after the match.</StateNote>
          ) : lbQ.isLoading ? (
            <StateNote>Loading results…</StateNote>
          ) : (lbQ.data ?? []).length === 0 ? (
            <StateNote>No results recorded.</StateNote>
          ) : (
            <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
              <div style={{ minWidth: 560 }}>
                <div
                  style={{
                    display: "flex",
                    padding: "14px 18px",
                    borderBottom: `1px solid ${SQ.hairline}`,
                    ...headCell,
                  }}
                >
                  <div style={{ width: 44 }}>#</div>
                  <div style={{ flex: 1 }}>FRANCHISE</div>
                  <div style={{ width: 80, textAlign: "right" }}>KILLS</div>
                  <div style={{ width: 90, textAlign: "right" }}>PLACE PTS</div>
                  <div style={{ width: 80, textAlign: "right" }}>TOTAL</div>
                </div>
                {(lbQ.data ?? []).map((r, i) => {
                  const accent = rankAccent(r.rank === 1);
                  const rowStyle = {
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderBottom: `1px solid ${SQ.hairlineSoft}`,
                    background: accent.rowBg,
                    textDecoration: "none",
                    color: SQ.ink,
                  } as const;
                  const inner = (
                    <>
                      <div style={{ width: 44, fontFamily: FONT.display, fontSize: 17, color: accent.color }}>
                        {String(r.rank).padStart(2, "0")}
                      </div>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                        {r.franchiseName}
                        {r.franchiseTag ? (
                          <span
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 10,
                              color: SQ.mute,
                              fontWeight: 400,
                              marginLeft: 6,
                            }}
                          >
                            {r.franchiseTag}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ width: 80, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>
                        {r.kills}
                      </div>
                      <div style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>
                        +{r.placePts}
                      </div>
                      <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}>
                        {r.total}
                      </div>
                    </>
                  );
                  // FFA leaderboard rows have no franchise (franchiseId null) — render a plain row.
                  return r.franchiseId ? (
                    <Link key={r.franchiseId} href={`${base}/franchise/${r.franchiseId}`} style={rowStyle}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={r.franchiseName ?? `row-${i}`} style={rowStyle}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rounds.length > 0 ? (
            <>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  margin: "34px 0 14px",
                }}
              >
                Per-Round Results
              </div>
              {rounds.map((rd) => (
                <div key={rd.roundNumber} style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: ".14em",
                      color: SQ.ember,
                      marginBottom: 8,
                    }}
                  >
                    ROUND {rd.roundNumber}
                    {rd.mapName ? ` · ${rd.mapName}` : ""}
                    {rd.mode ? ` · ${rd.mode}` : ""}
                  </div>
                  <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
                    <div style={{ minWidth: 520 }}>
                      <div
                        style={{
                          display: "flex",
                          padding: "12px 16px",
                          borderBottom: `1px solid ${SQ.hairline}`,
                          ...headCell,
                        }}
                      >
                        <div style={{ width: 36 }}>#</div>
                        <div style={{ flex: 1 }}>FRANCHISE</div>
                        <div style={{ width: 70, textAlign: "right" }}>KILLS</div>
                        <div style={{ width: 90, textAlign: "right" }}>SURVIVAL</div>
                        <div style={{ width: 90, textAlign: "right" }}>PLACE PTS</div>
                      </div>
                      {rd.rows.map((x) => (
                        <div
                          key={x.franchiseId}
                          style={{ borderBottom: `1px solid ${SQ.hairlineSoft}` }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "11px 16px",
                            }}
                          >
                            <div
                              style={{
                                width: 36,
                                fontFamily: FONT.display,
                                fontSize: 15,
                                color: x.rank === 1 ? SQ.red : SQ.steel,
                              }}
                            >
                              {x.rank}
                            </div>
                            <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                              {x.franchiseName}
                              {x.franchiseTag ? (
                                <span
                                  style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginLeft: 6 }}
                                >
                                  {x.franchiseTag}
                                </span>
                              ) : null}
                            </div>
                            <div
                              style={{ width: 70, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}
                            >
                              {x.kills}
                            </div>
                            <div
                              style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}
                            >
                              {Math.round(x.survivalSeconds / 60)}m
                            </div>
                            <div
                              style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}
                            >
                              +{x.placePts}
                            </div>
                          </div>
                          {x.players && x.players.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                padding: "0 16px 12px 52px",
                              }}
                            >
                              {x.players.map((pl) => (
                                <span
                                  key={pl.playerId}
                                  style={{
                                    fontFamily: FONT.mono,
                                    fontSize: 10.5,
                                    color: SQ.mute,
                                    border: `1px solid ${SQ.hairline}`,
                                    borderRadius: 5,
                                    padding: "3px 7px",
                                  }}
                                >
                                  {pl.gamerTag} · {pl.kills}k
                                  {pl.survivalSeconds > 0 ? ` · ${Math.round(pl.survivalSeconds / 60)}m` : ""}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </>
      )}

      <ConfirmModal
        open={disputeOpen}
        title={disputeDone ? "Dispute submitted" : "Dispute result"}
        tone="default"
        confirmLabel={disputeDone ? "Done" : "Submit dispute"}
        busy={createDispute.isPending}
        onConfirm={disputeDone ? () => setDisputeOpen(false) : submitDispute}
        onClose={() => setDisputeOpen(false)}
        message={
          disputeDone ? (
            "Thanks — the league has been notified and will review this result. You'll get a notification when it's resolved."
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span>Tell the league what was wrong with this result. An admin will review it.</span>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="e.g. our kills were recorded under the wrong team…"
                style={{
                  width: "100%",
                  minHeight: 90,
                  background: SQ.inset,
                  border: `1px solid ${SQ.field}`,
                  borderRadius: 5,
                  padding: "10px 12px",
                  fontSize: 13.5,
                  color: SQ.ink,
                  fontFamily: FONT.sans,
                  resize: "vertical",
                }}
              />
              {disputeErr ? (
                <span style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember }}>{disputeErr}</span>
              ) : null}
            </div>
          )
        }
      />
    </div>
  );
}
