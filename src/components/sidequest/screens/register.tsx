"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import {
  useAnnouncement,
  useApplyRegistration,
  useGames,
  useInviteTeammate,
  usePlayers,
} from "@/lib/query/hooks";
import type { RegistrationType } from "@/lib/api/types";

const fieldLabel = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".16em",
  color: SQ.label,
} as const;

const card = {
  background: SQ.panel,
  border: `1px solid ${SQ.hairline}`,
  borderRadius: 8,
  padding: 26,
} as const;

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 26,
  marginTop: 24,
  alignItems: "start",
} as const;

const inputStyle = {
  width: "100%",
  background: SQ.inset,
  border: `1px solid ${SQ.field}`,
  borderRadius: 5,
  padding: "12px 14px",
  fontSize: 14,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

export function RegisterScreen({ announcementId }: { announcementId?: string }) {
  const { isAuthenticated, hydrated, user, playerId } = useAuth();
  const ann = useAnnouncement(announcementId);
  const gamesQ = useGames(true);
  const playersQ = usePlayers({ limit: 100 });
  const apply = useApplyRegistration();
  const invite = useInviteTeammate();

  // Registration mode is fixed by the announcement: season = solo (PLAYER); free-for-all calls
  // may be PLAYER or SQUAD, as the organizer chose. No user-facing toggle.
  const mode: RegistrationType = ann.data?.registrationType ?? "PLAYER";

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [squadName, setSquadName] = useState("");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [teammates, setTeammates] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Prefill name from the signed-in user and preselect the announcement's game.
  useEffect(() => {
    if (user?.name) setName((n) => n || user.name);
  }, [user]);
  useEffect(() => {
    const g = ann.data?.gameName;
    if (g) setSelectedGames((cur) => (cur.length ? cur : [g]));
  }, [ann.data]);

  const allGames = (gamesQ.data ?? []).map((g) => g.name);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (playersQ.data?.items ?? [])
      .filter((p) => p.gamerTag.toLowerCase().includes(q))
      .filter((p) => !teammates.includes(p.gamerTag) && p.id !== playerId)
      .slice(0, 5);
  }, [search, playersQ.data, teammates, playerId]);

  const toggleGame = (g: string) =>
    setSelectedGames((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedGames.length === 0) {
      setError("Select at least one game.");
      return;
    }
    if (mode !== "PLAYER" && !squadName.trim()) {
      setError(mode === "FRANCHISE" ? "Enter a franchise name." : "Enter a squad name.");
      return;
    }
    const contact = [whatsapp && `WhatsApp: ${whatsapp}`, email && `Email: ${email}`]
      .filter(Boolean)
      .join(" · ");
    try {
      const reg = await apply.mutateAsync({
        type: mode,
        squadName: mode !== "PLAYER" ? squadName || undefined : undefined,
        games: selectedGames,
        contact: contact || undefined,
        matchId: ann.data?.matchId || undefined,
      });
      // Fire invites for any teammates added during sign-up (best-effort — manage the rest on My Team).
      if (mode === "SQUAD" && teammates.length) {
        await Promise.all(
          teammates.map((t) =>
            invite.mutateAsync({ id: reg.id, body: { gamerTag: t } }).catch(() => null),
          ),
        );
      }
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit registration."));
    }
  };

  // ---- gates ----
  if (hydrated && !isAuthenticated) {
    return (
      <div>
        <LeagueTitle eyebrow="Registration" title="REGISTER TO PLAY" />
        <div style={{ marginTop: 22 }}>
          <StateNote>
            You need a Side Quest account to register.{" "}
            <Link
              href={`/login?next=${encodeURIComponent(
                announcementId ? `/register?announcement=${announcementId}` : "/register",
              )}`}
              style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}
            >
              Sign in ▸
            </Link>
          </StateNote>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <LeagueTitle eyebrow="Registration" title="REGISTER TO PLAY" />
        <div style={{ ...card, marginTop: 24, maxWidth: 560 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".16em",
              color: SQ.green,
            }}
          >
            ✓ SUBMITTED
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>
            Registration submitted
          </div>
          <p style={{ fontSize: 14, color: SQ.faint, lineHeight: 1.6, marginTop: 10 }}>
            The organizers will review your {mode === "SQUAD" ? "squad" : "player"} registration
            {ann.data ? ` for “${ann.data.title}”` : ""}. You'll get a notification when it's
            reviewed.
            {mode === "SQUAD"
              ? " Manage your roster and invite teammates from My Team."
              : ""}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <Link
              href={mode === "SQUAD" ? "/my/registrations" : "/notifications"}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.league,
                background: SQ.red,
                padding: "11px 16px",
                borderRadius: 5,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {mode === "SQUAD" ? "Manage your team ▸" : "View notifications ▸"}
            </Link>
            <Link
              href="/announcements"
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.faint,
                border: `1px solid ${SQ.inputBorder}`,
                padding: "11px 16px",
                borderRadius: 5,
                textDecoration: "none",
              }}
            >
              Back to announcements
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LeagueTitle eyebrow="Season 04 registration" title="REGISTER TO PLAY" />

      {/* what you're registering for */}
      <div
        style={{
          marginTop: 18,
          padding: "14px 18px",
          borderRadius: 8,
          border: `1px solid ${SQ.hairline}`,
          background: SQ.panel,
          fontSize: 13.5,
          color: SQ.faint,
        }}
      >
        {ann.data ? (
          <>
            <span style={{ color: SQ.mute, fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".12em" }}>
              REGISTERING FOR
            </span>{" "}
            <span style={{ color: SQ.ink, fontWeight: 600 }}>{ann.data.title}</span>
            {ann.data.gameName ? (
              <span style={{ color: SQ.ember }}> · {ann.data.gameName}</span>
            ) : null}
          </>
        ) : (
          "General season registration — pick the games you want to compete in."
        )}
      </div>

      <div
        style={{
          margin: "18px 0 4px",
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: ".12em",
          color: SQ.mute,
        }}
      >
        {mode === "SQUAD"
          ? "SQUAD · TEAM REGISTRATION"
          : mode === "FRANCHISE"
            ? "FRANCHISE · TEAM BID"
            : "SOLO PLAYER REGISTRATION"}
      </div>

      <form onSubmit={onSubmit}>
        <div style={grid}>
          {/* left: identity + games */}
          <div style={card}>
            <div style={{ ...fieldLabel, marginBottom: 8 }}>PLAYER NAME</div>
            <input
              className="sq-field"
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />

            {mode !== "PLAYER" ? (
              <>
                <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>
                  {mode === "FRANCHISE" ? "FRANCHISE NAME" : "SQUAD NAME"}
                </div>
                <input
                  className="sq-field"
                  style={inputStyle}
                  value={squadName}
                  onChange={(e) => setSquadName(e.target.value)}
                  placeholder={mode === "FRANCHISE" ? "e.g. Nova Esports" : "e.g. Phantom Five"}
                />
              </>
            ) : null}

            <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>CONTACT</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <input
                className="sq-field"
                style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp no."
              />
              <input
                className="sq-field"
                type="email"
                style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
              />
            </div>

            <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>YOUR GAMES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {allGames.length === 0 ? (
                <span style={{ fontSize: 13, color: SQ.mute }}>Loading games…</span>
              ) : (
                allGames.map((g) => {
                  const on = selectedGames.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGame(g)}
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 11,
                        letterSpacing: ".06em",
                        padding: "9px 13px",
                        borderRadius: 5,
                        border: `1px solid ${on ? SQ.red : SQ.inputBorder}`,
                        color: on ? SQ.league : SQ.faint,
                        background: on ? SQ.red : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      {g}
                    </button>
                  );
                })
              )}
            </div>

            {error ? (
              <div
                style={{
                  margin: "18px 0 0",
                  padding: "10px 12px",
                  borderRadius: 5,
                  background: "rgba(232,96,44,.10)",
                  border: `1px solid ${SQ.red}`,
                  color: SQ.ember,
                  fontSize: 12.5,
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={apply.isPending}
              style={{
                cursor: apply.isPending ? "not-allowed" : "pointer",
                marginTop: 22,
                width: "100%",
                fontFamily: FONT.mono,
                fontSize: 12,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: SQ.league,
                background: SQ.red,
                padding: 14,
                borderRadius: 5,
                border: "none",
                opacity: apply.isPending ? 0.6 : 1,
              }}
            >
              {apply.isPending ? "Submitting…" : "Submit registration ▸"}
            </button>
          </div>

          {/* right: squad building (FFA) or info */}
          <div style={card}>
            {mode === "SQUAD" ? (
              <>
                <div style={{ ...fieldLabel, marginBottom: 12 }}>
                  BUILD YOUR SQUAD · INVITE TEAMMATES
                </div>
                <input
                  className="sq-field"
                  style={inputStyle}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players on Side Quest…"
                />
                {searchResults.length > 0 ? (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setTeammates((t) => [...t, p.gamerTag]);
                          setSearch("");
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: 5,
                          border: `1px solid ${SQ.inputBorder}`,
                          background: "transparent",
                          color: SQ.ink,
                          cursor: "pointer",
                          fontSize: 13.5,
                        }}
                      >
                        <span>{p.gamerTag}</span>
                        <span
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10,
                            letterSpacing: ".1em",
                            color: SQ.ember,
                          }}
                        >
                          + INVITE
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {teammates.length === 0 ? (
                    <span style={{ fontSize: 13, color: SQ.mute }}>No teammates added yet.</span>
                  ) : (
                    teammates.map((t) => (
                      <span
                        key={t}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          fontFamily: FONT.mono,
                          fontSize: 11,
                          padding: "7px 10px",
                          borderRadius: 5,
                          border: `1px solid rgba(31,157,99,.45)`,
                          color: SQ.green,
                        }}
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => setTeammates((arr) => arr.filter((x) => x !== t))}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: SQ.mute,
                            cursor: "pointer",
                            fontSize: 13,
                            lineHeight: 1,
                          }}
                          aria-label={`Remove ${t}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <p style={{ margin: "14px 0 0", fontSize: 12.5, lineHeight: 1.6, color: SQ.mute }}>
                  Search players already on Side Quest and add them to your squad — Unstop-style. We'll
                  notify them to confirm their spot.
                </p>
              </>
            ) : (
              <>
                <div style={{ ...fieldLabel, marginBottom: 12 }}>HOW REGISTRATION WORKS</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: SQ.faint }}>
                  {mode === "FRANCHISE"
                    ? "Propose your franchise name and the games it will compete in. League admins review franchise bids before the season starts and form the franchises at their discretion."
                    : "Submit the games you want to compete in and how to reach you. League admins review registrations and you'll get a notification when yours is reviewed."}
                </p>
                <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.6, color: SQ.mute }}>
                  The registration mode is set by the organizer on the announcement you came from.
                </p>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
