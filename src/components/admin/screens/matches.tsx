"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SQ, FONT, matchStatusColors } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import { SearchableSelect } from "@/components/sidequest/searchable-select";
import { useMatches, useGames, useFranchises, useCreateMatch, useMatchLineups } from "@/lib/query/hooks";
import { Modal } from "@/components/sidequest/modal";
import { LineupEditor } from "@/components/sidequest/lineup-editor";
import type { MatchSummary } from "@/lib/api/types";
import { shortDate } from "@/lib/adapters/league";

// datetime-local wants a local "YYYY-MM-DDTHH:mm" string (not a UTC ISO string).
function localDateTimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const fieldLabel = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.label,
  display: "block",
  marginBottom: 6,
} as const;

const formInput = {
  width: "100%",
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "9px 12px",
  fontSize: 13.5,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

function CreateMatchPanel({ onClose }: { onClose: () => void }) {
  const gamesQ = useGames();
  const franchisesQ = useFranchises({ active: true, limit: 50 });
  const createMatch = useCreateMatch();
  const games = gamesQ.data ?? [];
  const franchises = franchisesQ.data?.items ?? [];

  const [gameId, setGameId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [arena, setArena] = useState("");
  const [format, setFormat] = useState("");
  const [matchType, setMatchType] = useState<"FRANCHISE" | "FFA">("FRANCHISE");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  const minDateTime = localDateTimeValue(new Date());

  const toggle = (id: string) => setPicked((p) => ({ ...p, [id]: !p[id] }));

  const submit = async () => {
    setErr(null);
    if (!gameId || !scheduledAt) {
      setErr("Pick a game and a date/time.");
      return;
    }
    if (new Date(scheduledAt).getTime() < Date.now()) {
      setErr("A match cannot be scheduled in the past");
      return;
    }
    try {
      await createMatch.mutateAsync({
        gameId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        matchType,
        arena: arena || undefined,
        format: format || undefined,
        participantFranchiseIds:
          matchType === "FFA" ? [] : Object.keys(picked).filter((k) => picked[k]),
      });
      onClose();
    } catch {
      setErr("Couldn't create the match (admin sign-in required).");
    }
  };

  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 9,
        padding: 20,
        margin: "20px 0 4px",
      }}
    >
      <div style={{ fontFamily: FONT.display, fontSize: 20, letterSpacing: "-.02em", marginBottom: 16 }}>
        New fixture
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <div>
          <span style={fieldLabel}>GAME</span>
          <SearchableSelect
            value={gameId}
            onChange={setGameId}
            options={games.map((g) => ({ value: g.id, label: g.name }))}
            placeholder="Select a game…"
            searchPlaceholder="Search games…"
          />
        </div>
        <label>
          <span style={fieldLabel}>DATE &amp; TIME</span>
          <input
            type="datetime-local"
            min={minDateTime}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            style={formInput}
          />
          <span style={{ ...fieldLabel, marginTop: 6, marginBottom: 0, color: SQ.mute, letterSpacing: ".04em" }}>
            Must be in the future.
          </span>
        </label>
        <label>
          <span style={fieldLabel}>MATCH LABEL / STAGE</span>
          <input value={arena} onChange={(e) => setArena(e.target.value)} placeholder="e.g. Semifinal · Group A" style={formInput} />
          <span style={{ ...fieldLabel, marginTop: 6, marginBottom: 0, color: SQ.mute, letterSpacing: ".04em" }}>
            Optional matchup / stage label shown on the fixture.
          </span>
        </label>
        <label>
          <span style={fieldLabel}>FORMAT</span>
          <input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="e.g. 3 rounds / Bo3" style={formInput} />
        </label>
        <label>
          <span style={fieldLabel}>TYPE</span>
          <select value={matchType} onChange={(e) => setMatchType(e.target.value as "FRANCHISE" | "FFA")} style={{ ...formInput, cursor: "pointer" }}>
            <option value="FRANCHISE">Franchise match</option>
            <option value="FFA">Free-for-all (FFA)</option>
          </select>
        </label>
      </div>

      {matchType === "FRANCHISE" ? (
        <>
          <div style={{ ...fieldLabel, marginTop: 16 }}>PARTICIPATING FRANCHISES</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {franchises.map((f) => {
              const on = !!picked[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".06em",
                    padding: "8px 12px",
                    borderRadius: 5,
                    border: `1px solid ${on ? SQ.red : SQ.inputBorder}`,
                    color: on ? SQ.sidebar : SQ.faint,
                    background: on ? SQ.red : "transparent",
                    cursor: "pointer",
                  }}
                >
                  {f.tag}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ ...fieldLabel, marginTop: 16, color: SQ.mute, letterSpacing: ".06em" }}>
          FFA players come from approved registrations — open a registration call from Announcements.
        </div>
      )}

      {err ? (
        <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: 12, color: SQ.ember }}>{err}</div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={submit}
          disabled={createMatch.isPending}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: SQ.sidebar,
            background: SQ.red,
            border: "none",
            padding: "12px 18px",
            borderRadius: 5,
            cursor: createMatch.isPending ? "not-allowed" : "pointer",
            opacity: createMatch.isPending ? 0.6 : 1,
          }}
        >
          {createMatch.isPending ? "Creating…" : "Create match ▸"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: SQ.faint,
            background: "transparent",
            border: `1px solid ${SQ.inputBorder}`,
            padding: "12px 18px",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Admin lineup control: lists a FRANCHISE match's participating franchises (with their current
// fielded-lineup count) and opens the shared LineupEditor for one at a time. Admins have no
// owner/manager restriction — the backend authorizes admins for any franchise's lineup.
function LineupsModal({ match, onClose }: { match: MatchSummary; onClose: () => void }) {
  const lineupsQ = useMatchLineups(match.id);
  const [editorFranchiseId, setEditorFranchiseId] = useState<string | null>(null);
  const franchises = lineupsQ.data ?? [];
  const editor = franchises.find((f) => f.franchiseId === editorFranchiseId) ?? null;
  const title = match.participantTags.length
    ? match.participantTags.join(" vs ")
    : match.game?.name ?? "Match";

  return (
    <>
      <Modal open title={`Lineups · ${title}`} onClose={onClose}>
        <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
          Set which roster players each franchise is fielding for this fixture. Empty = the whole
          roster plays.
        </div>

        {lineupsQ.isLoading ? (
          <StateNote>Loading lineups…</StateNote>
        ) : lineupsQ.isError ? (
          <StateNote tone="error">Couldn't load lineups (admin sign-in required).</StateNote>
        ) : franchises.length === 0 ? (
          <StateNote tone="muted">No participating franchises to field.</StateNote>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {franchises.map((f) => {
              const count = f.lineup.length;
              return (
                <div
                  key={f.franchiseId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    border: `1px solid ${SQ.hairline}`,
                    borderRadius: 7,
                    background: SQ.inset,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, letterSpacing: ".04em", color: SQ.ink }}>
                      {f.franchiseTag}
                    </span>
                    <div style={{ fontSize: 12, color: SQ.mute, marginTop: 2 }}>{f.franchiseName}</div>
                  </div>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10.5,
                      letterSpacing: ".08em",
                      color: count ? SQ.faint : SQ.mute,
                    }}
                  >
                    {count ? `${count} selected` : "full roster"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditorFranchiseId(f.franchiseId)}
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: SQ.faint,
                      background: "transparent",
                      border: `1px solid ${SQ.inputBorder}`,
                      padding: "7px 12px",
                      borderRadius: 5,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {editor ? (
        <LineupEditor
          open
          matchId={match.id}
          franchiseId={editor.franchiseId}
          franchiseTag={editor.franchiseTag}
          onClose={() => setEditorFranchiseId(null)}
        />
      ) : null}
    </>
  );
}

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const FILTERS = ["All", "SCHEDULED", "LIVE", "AWAITING_RESULT", "COMPLETED"] as const;

function statusLabel(s: string) {
  if (s === "AWAITING_RESULT") return "Awaiting result";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function MatchesScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  // Debounce the search box so typing fires one request after a pause, not one per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [sort, setSort] = useState("-scheduledAt");
  const [creating, setCreating] = useState(false);
  const [lineupsMatch, setLineupsMatch] = useState<MatchSummary | null>(null);
  // Search / sort are server-side (the matches endpoint filters by game/arena/format/franchise + sorts).
  const { data, isLoading, isError } = useMatches({
    limit: 50,
    status: filter === "All" ? undefined : filter,
    q: debouncedSearch.trim() || undefined,
    sort,
  });
  const matches = data?.items ?? [];

  return (
    <div>
      <ScreenHeader
        eyebrow="Fixtures & results"
        title="MATCHES"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setCreating((c) => !c)}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.sidebar,
                background: SQ.red,
                padding: "11px 16px",
                borderRadius: 5,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              {creating ? "Close" : "+ Create match"}
            </button>
            <Link
              href="/admin/matches/result"
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.faint,
                background: "transparent",
                border: `1px solid ${SQ.inputBorder}`,
                padding: "11px 16px",
                borderRadius: 5,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Enter result
            </Link>
          </div>
        }
      />

      {creating ? <CreateMatchPanel onClose={() => setCreating(false)} /> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "22px 0 18px" }}>
        {FILTERS.map((label) => {
          const active = filter === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setFilter(label)}
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
              {label === "AWAITING_RESULT" ? "Awaiting" : statusLabel(label)}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, game, arena, format…"
          style={{
            flex: 1,
            minWidth: 200,
            fontFamily: FONT.mono,
            fontSize: 11.5,
            background: SQ.inset,
            border: `1px solid ${SQ.inputBorder}`,
            borderRadius: 5,
            padding: "9px 12px",
            color: SQ.ink,
          }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11.5,
            background: SQ.inset,
            border: `1px solid ${SQ.inputBorder}`,
            borderRadius: 5,
            padding: "9px 12px",
            color: SQ.ink,
            cursor: "pointer",
          }}
        >
          <option value="-scheduledAt">Newest first</option>
          <option value="scheduledAt">Oldest first</option>
          <option value="status">By status</option>
          <option value="game">By game</option>
        </select>
      </div>

      {isLoading ? (
        <StateNote>Loading matches…</StateNote>
      ) : matches.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load matches (admin sign-in required)." : "No matches in this filter."}
        </StateNote>
      ) : (
        <TableScroll minWidth={950}>
          <div
            style={{
              display: "flex",
              padding: "14px 18px",
              borderBottom: `1px solid ${SQ.hairline}`,
              ...headCell,
            }}
          >
            <div style={{ flex: 1.4 }}>MATCH</div>
            <div style={{ width: 110 }}>GAME</div>
            <div style={{ width: 120 }}>SCHEDULE</div>
            <div style={{ width: 130 }}>STATUS</div>
            <div style={{ width: 300, textAlign: "right" }}>ACTION</div>
          </div>

          {matches.map((m) => {
            const label = statusLabel(m.status);
            const [stColor, stBorder] = matchStatusColors(label as Parameters<typeof matchStatusColors>[0]);
            const done = m.status === "COMPLETED";
            const isFranchise = m.matchType === "FRANCHISE" || m.participantTags.length > 0;
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "15px 18px",
                  borderBottom: `1px solid ${SQ.hairlineSoft}`,
                }}
              >
                <div style={{ flex: 1.4 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.game?.name ?? "Match"}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginTop: 2 }}>
                    {m.participantTags.length ? m.participantTags.join(" vs ") : m.arena ?? "—"}
                  </div>
                </div>
                <div style={{ width: 110, fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>
                  {m.game?.name ?? "—"}
                </div>
                <div style={{ width: 120, fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>
                  {shortDate(m.scheduledAt)}
                </div>
                <div style={{ width: 130 }}>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      color: stColor,
                      border: `1px solid ${stBorder}`,
                      padding: "4px 9px",
                      borderRadius: 9,
                    }}
                  >
                    {label}
                  </span>
                </div>
                <div
                  style={{
                    width: 300,
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  <Link
                    href={`/admin/matches/result?match=${m.id}`}
                    style={
                      done
                        ? {
                            fontFamily: FONT.mono,
                            fontSize: 10.5,
                            letterSpacing: ".1em",
                            textTransform: "uppercase",
                            color: SQ.faint,
                            border: `1px solid ${SQ.inputBorder}`,
                            padding: "8px 12px",
                            borderRadius: 5,
                            textDecoration: "none",
                          }
                        : {
                            fontFamily: FONT.mono,
                            fontSize: 10.5,
                            letterSpacing: ".1em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            color: SQ.sidebar,
                            background: SQ.red,
                            border: "none",
                            padding: "8px 12px",
                            borderRadius: 5,
                            textDecoration: "none",
                          }
                    }
                  >
                    {done ? "Edit result" : "Enter result"}
                  </Link>
                  <Link
                    href={`/admin/match/${m.id}`}
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10.5,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: SQ.faint,
                      border: `1px solid ${SQ.inputBorder}`,
                      padding: "8px 12px",
                      borderRadius: 5,
                      textDecoration: "none",
                    }}
                  >
                    View
                  </Link>
                  {isFranchise ? (
                    <button
                      type="button"
                      onClick={() => setLineupsMatch(m)}
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10.5,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: SQ.faint,
                        background: "transparent",
                        border: `1px solid ${SQ.inputBorder}`,
                        padding: "8px 12px",
                        borderRadius: 5,
                        cursor: "pointer",
                      }}
                    >
                      Lineups
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </TableScroll>
      )}

      {lineupsMatch ? (
        <LineupsModal match={lineupsMatch} onClose={() => setLineupsMatch(null)} />
      ) : null}
    </div>
  );
}
