"use client";

import { useState } from "react";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { Toggle } from "../toggle";
import { StateNote } from "@/components/sidequest/state-note";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import { useGames, useUpdateGame, useCurrentSeason } from "@/lib/query/hooks";
import { useAuth } from "@/lib/auth/context";
import type { GameSummary, GameType } from "@/lib/api/types";

const statLabel = {
  fontFamily: FONT.mono,
  fontSize: 9.5,
  letterSpacing: ".1em",
  color: SQ.label,
} as const;

const statValue = {
  fontFamily: FONT.mono,
  fontSize: 12,
  marginTop: 3,
} as const;

const typeBadge = {
  fontFamily: FONT.mono,
  fontSize: 9.5,
  letterSpacing: ".08em",
  padding: "3px 7px",
  borderRadius: 9,
  whiteSpace: "nowrap",
  flex: "0 0 auto",
} as const;

const typeSelect = {
  marginTop: 4,
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "6px 8px",
  fontFamily: FONT.mono,
  fontSize: 11.5,
  color: SQ.ink,
} as const;

/** Friendly genre labels shown in the type badge + the game-type <select>. */
const GAME_TYPE_LABEL: Record<GameType, string> = {
  BATTLE_ROYALE: "Battle Royale",
  TACTICAL: "Tactical",
  SPORTS: "Sports",
  FIGHTING: "Fighting",
  PARTY: "Party·FFA",
};

/** [text, border] badge colors per genre — mirrors the status-badge idiom in tokens.ts. */
const GAME_TYPE_COLORS: Record<GameType, [string, string]> = {
  BATTLE_ROYALE: [SQ.ember, "rgba(232,96,44,.45)"],
  TACTICAL: [SQ.blue, "rgba(59,111,212,.45)"],
  SPORTS: [SQ.green, "rgba(31,157,99,.45)"],
  FIGHTING: [SQ.amber, "rgba(181,131,26,.5)"],
  PARTY: [SQ.mute, SQ.inputBorder],
};

/** A controlled scoring input — edits stage into the card's draft; saving is explicit. */
function ScoreField({
  label,
  value,
  onChange,
  width,
  busy,
  numeric,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  width: number;
  busy?: boolean;
  numeric?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={statLabel}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input
          type={numeric ? "number" : "text"}
          min={numeric ? 0 : undefined}
          value={value}
          disabled={busy}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width,
            background: SQ.inset,
            border: `1px solid ${SQ.inputBorder}`,
            borderRadius: 5,
            padding: "6px 9px",
            fontFamily: FONT.mono,
            fontSize: 12,
            color: SQ.ink,
            opacity: busy ? 0.5 : 1,
          }}
        />
        {hint ? <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: SQ.mute }}>{hint}</span> : null}
      </div>
    </label>
  );
}

/** Normalize scoring drafts the way the server will (ints clamped ≥ 0; ladder trimmed). */
const toInt = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

function GameCard({ g, seasonActive }: { g: GameSummary; seasonActive: boolean }) {
  const { isSuperAdmin } = useAuth();
  const updateGame = useUpdateGame();
  const [typeColor, typeBorder] = GAME_TYPE_COLORS[g.gameType];

  // Scoring is staged in a draft and saved explicitly (with confirmation) — never on blur.
  const [draft, setDraft] = useState({
    pointsPerKill: String(g.pointsPerKill),
    standingsWeight: String(g.standingsWeight),
    placementPoints: g.placementPoints,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const next = {
    pointsPerKill: toInt(draft.pointsPerKill),
    standingsWeight: toInt(draft.standingsWeight),
    placementPoints: draft.placementPoints.trim(),
  };
  const dirty =
    next.pointsPerKill !== g.pointsPerKill ||
    next.standingsWeight !== g.standingsWeight ||
    next.placementPoints !== g.placementPoints;

  const resetDraft = () =>
    setDraft({
      pointsPerKill: String(g.pointsPerKill),
      standingsWeight: String(g.standingsWeight),
      placementPoints: g.placementPoints,
    });

  const saveScoring = () =>
    updateGame.mutate(
      { id: g.id, body: next },
      {
        onSuccess: (detail) => {
          // Re-sync the draft to the server-normalized values (e.g. ladder whitespace stripped).
          setDraft({
            pointsPerKill: String(detail.pointsPerKill),
            standingsWeight: String(detail.standingsWeight),
            placementPoints: detail.placementPoints,
          });
          setConfirmOpen(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
        onError: () => setConfirmOpen(false),
      },
    );

  const ladderLabel = (v: string) => (v ? `"${v}"` : "kills only");

  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 9,
        padding: "18px 20px",
        opacity: g.enabled ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 18, letterSpacing: "-.02em" }}>
            {g.name}
          </div>
          {/* Standings weight rides next to the name — the one scoring number that changes how much
              this title counts toward the franchise table. */}
          <span
            title="Standings weight — how much this title counts toward franchise standings"
            style={{
              ...typeBadge,
              fontSize: 11,
              fontWeight: 700,
              color: g.standingsWeight !== 100 ? SQ.ember : SQ.faint,
              border: `1px solid ${g.standingsWeight !== 100 ? "rgba(232,96,44,.5)" : SQ.inputBorder}`,
            }}
          >
            ×{(g.standingsWeight / 100).toFixed(2)}
          </span>
          <span style={{ ...typeBadge, color: typeColor, border: `1px solid ${typeBorder}` }}>
            {GAME_TYPE_LABEL[g.gameType]}
          </span>
        </div>
        <Toggle
          on={g.enabled}
          disabled={updateGame.isPending || seasonActive}
          onToggle={() =>
            seasonActive ? undefined : updateGame.mutate({ id: g.id, body: { enabled: !g.enabled } })
          }
        />
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 14, alignItems: "flex-end" }}>
        <div style={{ minWidth: 0 }}>
          <div style={statLabel}>FORMAT</div>
          <input
            defaultValue={g.format}
            disabled={updateGame.isPending || seasonActive}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              // FORMAT is NOT NULL — refuse blank, and only PATCH when it actually changed.
              if (!v) {
                e.target.value = g.format;
              } else if (!seasonActive && v !== g.format) {
                updateGame.mutate({ id: g.id, body: { format: v } });
              }
            }}
            style={{
              marginTop: 4,
              width: "100%",
              maxWidth: 200,
              background: SQ.inset,
              border: `1px solid ${SQ.inputBorder}`,
              borderRadius: 5,
              padding: "6px 9px",
              fontFamily: FONT.mono,
              fontSize: 12.5,
              color: SQ.ink,
              cursor: updateGame.isPending || seasonActive ? "default" : "text",
              opacity: updateGame.isPending || seasonActive ? 0.5 : 1,
            }}
          />
        </div>
        <div>
          <div style={statLabel}>POPULARITY</div>
          <div style={{ ...statValue, color: SQ.faint }}>{g.popularity}/100</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={statLabel}>VISIBILITY</div>
          <div style={{ ...statValue, color: g.enabled ? SQ.green : SQ.mute }}>
            {g.enabled ? "Live" : "Hidden"}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={statLabel}>GAME TYPE</div>
        <select
          value={g.gameType}
          disabled={updateGame.isPending || seasonActive}
          onChange={(e) =>
            seasonActive
              ? undefined
              : updateGame.mutate({ id: g.id, body: { gameType: e.target.value as GameType } })
          }
          style={{
            ...typeSelect,
            cursor: updateGame.isPending || seasonActive ? "default" : "pointer",
            opacity: updateGame.isPending || seasonActive ? 0.5 : 1,
          }}
        >
          {(Object.keys(GAME_TYPE_LABEL) as GameType[]).map((t) => (
            <option key={t} value={t}>
              {GAME_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Per-game scoring — the DEFAULT that seeds every new match of this title (admins can still
          override a single fixture's scoring at result entry). Tunable even during a season: weight
          re-weights the live table; points/kill + ladder apply to future fixtures. */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${SQ.hairlineFaint}` }}>
        <div style={statLabel}>SCORING · DEFAULT FOR NEW MATCHES</div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <ScoreField
            label="PTS / KILL"
            value={draft.pointsPerKill}
            busy={updateGame.isPending}
            width={64}
            numeric
            onChange={(v) => setDraft((d) => ({ ...d, pointsPerKill: v }))}
          />
          <ScoreField
            label="WEIGHT"
            value={draft.standingsWeight}
            hint={
              isSuperAdmin
                ? `${(toInt(draft.standingsWeight) / 100).toFixed(2)}×`
                : "main admin only"
            }
            // Changing a game's standings weight re-weights the whole table — main-admin-only.
            busy={updateGame.isPending || !isSuperAdmin}
            width={72}
            numeric
            onChange={(v) => setDraft((d) => ({ ...d, standingsWeight: v }))}
          />
          <ScoreField
            label="PLACEMENT LADDER"
            value={draft.placementPoints}
            placeholder="15,12,10,8 · blank = kills only"
            busy={updateGame.isPending}
            width={190}
            onChange={(v) => setDraft((d) => ({ ...d, placementPoints: v }))}
          />
        </div>
        {dirty ? (
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <button
              type="button"
              disabled={updateGame.isPending}
              onClick={() => setConfirmOpen(true)}
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "9px 16px",
                borderRadius: 5,
                cursor: "pointer",
                background: SQ.red,
                color: SQ.sidebar,
                border: "none",
                opacity: updateGame.isPending ? 0.6 : 1,
              }}
            >
              Save scoring
            </button>
            <button
              type="button"
              disabled={updateGame.isPending}
              onClick={resetDraft}
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                padding: "9px 14px",
                borderRadius: 5,
                cursor: "pointer",
                background: "transparent",
                color: SQ.faint,
                border: `1px solid ${SQ.inputBorder}`,
              }}
            >
              Reset
            </button>
            <span style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".08em", color: SQ.amber }}>
              UNSAVED CHANGES
            </span>
          </div>
        ) : saved ? (
          <div
            style={{
              marginTop: 12,
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: ".1em",
              color: SQ.green,
            }}
          >
            SCORING SAVED ✓
          </div>
        ) : null}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Change scoring system"
        message={
          <>
            Apply the new {g.name} scoring?
            <br />
            {next.pointsPerKill !== g.pointsPerKill
              ? `PTS/KILL ${g.pointsPerKill} → ${next.pointsPerKill} · `
              : null}
            {next.standingsWeight !== g.standingsWeight
              ? `WEIGHT ${(g.standingsWeight / 100).toFixed(2)}× → ${(next.standingsWeight / 100).toFixed(2)}× · `
              : null}
            {next.placementPoints !== g.placementPoints
              ? `LADDER ${ladderLabel(g.placementPoints)} → ${ladderLabel(next.placementPoints)}`
              : null}
            <br />
            This becomes the default for every new {g.name} match; a weight change re-weights the live
            standings table immediately.
          </>
        }
        confirmLabel="Change scoring"
        busy={updateGame.isPending}
        onConfirm={saveScoring}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export function GamesScreen() {
  const { data, isLoading, isError } = useGames();
  const seasonQ = useCurrentSeason();
  const seasonActive = !!seasonQ.data;
  const games = data ?? [];

  return (
    <div>
      <ScreenHeader eyebrow="Title settings" title="GAMES" />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "12px 0 24px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        SUPPORTED TITLES{seasonActive ? " · LOCKED WHILE A SEASON IS RUNNING" : " · ENABLE OR HIDE BETWEEN SEASONS"}
        {" · SCORING BELOW IS THE DEFAULT APPLIED TO NEW MATCHES"}
      </div>

      {isLoading ? (
        <StateNote>Loading games…</StateNote>
      ) : games.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load games (admin sign-in required)." : "No games yet."}
        </StateNote>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
            gap: 16,
          }}
        >
          {games.map((g) => (
            <GameCard key={g.id} g={g} seasonActive={seasonActive} />
          ))}
        </div>
      )}
    </div>
  );
}
