"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import {
  useAnnouncement,
  useApplyRegistration,
  useCurrentSeason,
  useGames,
  useInviteTeammate,
  useMatch,
  usePlayers,
} from "@/lib/query/hooks";
import type { GameSummary, RegistrationType } from "@/lib/api/types";
import type { SessionUser } from "@/lib/auth/store";

// Registration locks this long before the match starts (backend enforces the same window).
const REG_LOCK_MS = 3 * 60 * 60 * 1000;

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
  const matchQ = useMatch(ann.data?.matchId);
  const gamesQ = useGames(true);
  const playersQ = usePlayers({ limit: 100 });
  const apply = useApplyRegistration();
  const invite = useInviteTeammate();
  const router = useRouter();

  // Registration mode is fixed by the announcement: season = solo (PLAYER); free-for-all calls
  // may be PLAYER or SQUAD, as the organizer chose. No user-facing toggle.
  const mode: RegistrationType = ann.data?.registrationType ?? "PLAYER";

  const season = useCurrentSeason().data;

  // An announcement-tied sign-up derives its game from the announcement (or its linked match) — no
  // manual picker. When the announcement resolves no game (e.g. a general "registrations are live"
  // post with no game and no match), we fall back to the manual picker so the sign-up still works.
  const derivedGame = ann.data?.gameName ?? matchQ.data?.game?.name ?? null;
  const showGamePicker = !derivedGame;

  // Client-side mirror of the backend time-lock: submissions close 3h before the match starts.
  const registrationLocked = useMemo(() => {
    const at = matchQ.data?.scheduledAt;
    if (!at) return false;
    const t = new Date(at).getTime();
    return !Number.isNaN(t) && Date.now() > t - REG_LOCK_MS;
  }, [matchQ.data]);

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [squadName, setSquadName] = useState("");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [teammates, setTeammates] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [done, setDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Prefill name from the signed-in user.
  useEffect(() => {
    if (user?.name) setName((n) => n || user.name);
  }, [user]);

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
    if (alreadyRegistered || registrationLocked) return;
    // When the game is derived from the announcement/match we skip the picker; otherwise require a pick.
    if (showGamePicker && selectedGames.length === 0) {
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
    // Send the derived game when we have one (the backend still authoritatively derives it from the
    // linked match); otherwise send the user's manual picks. Never send an empty games list.
    const games = derivedGame ? [derivedGame] : selectedGames;
    try {
      const reg = await apply.mutateAsync({
        type: mode,
        squadName: mode !== "PLAYER" ? squadName || undefined : undefined,
        games,
        contact: contact || undefined,
        matchId: ann.data?.matchId || undefined,
        // SQUAD sign-ups carry the announcement's configured roster cap (backend also enforces it).
        teamSize: mode === "SQUAD" ? ann.data?.teamSize ?? undefined : undefined,
      });
      // Fire invites for any teammates added during sign-up (best-effort — manage the rest on My Team).
      if (mode === "SQUAD" && teammates.length) {
        await Promise.all(
          teammates.map((t) =>
            invite.mutateAsync({ id: reg.id, body: { gamerTag: t } }).catch(() => null),
          ),
        );
      }
      if (mode === "SQUAD") {
        // A squad is registered immediately as FORMING (open for invites). Route to My Team so the
        // captain can finish the roster before the registration locks.
        setRedirecting(true);
        router.push("/my/registrations");
        return;
      }
      setDone(true);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const msg = apiErrorMessage(err, "Could not submit registration.");
      if (status === 409) {
        // Duplicate guard — already have a live registration for this match.
        setAlreadyRegistered(true);
        setError(null);
      } else if (status === 400 && /(clos|lock)/i.test(msg)) {
        // Time-lock — locks 3 hours before match time.
        setError("Registration closed — locks 3 hours before match time.");
      } else {
        setError(msg);
      }
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

  // Auction self-registration is a wholly different flow: no match-derived game, no squad name, no
  // 3h match-lock. Branch to its own exhaustive form once auth has resolved.
  if (mode === "AUCTION") {
    return <AuctionRegisterForm user={user} seasonName={season?.name} announcementTitle={ann.data?.title} />;
  }

  if (redirecting) {
    return (
      <div>
        <LeagueTitle eyebrow="Registration" title="REGISTER TO PLAY" />
        <div style={{ ...card, marginTop: 24, maxWidth: 560 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".16em", color: SQ.green }}>
            ✓ SQUAD CREATED
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>Squad registered</div>
          <p style={{ fontSize: 14, color: SQ.faint, lineHeight: 1.6, marginTop: 10 }}>
            {squadName ? `“${squadName}” ` : "Your squad "}is registered and open for invites. Add your teammates
            on My Team before the registration locks — pending invites are voided at lock time. Taking you there now…
          </p>
          <div style={{ marginTop: 20 }}>
            <Link
              href="/my/registrations"
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
              Go to My Team ▸
            </Link>
          </div>
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
            {mode === "FRANCHISE" ? "✓ SUBMITTED" : "✓ REGISTERED"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>
            {mode === "FRANCHISE" ? "Proposal submitted" : "You're registered"}
          </div>
          <p style={{ fontSize: 14, color: SQ.faint, lineHeight: 1.6, marginTop: 10 }}>
            {mode === "FRANCHISE"
              ? `League admins review franchise proposals${
                  ann.data ? ` for “${ann.data.title}”` : ""
                } before forming the franchises. You'll get a notification when it's reviewed.`
              : `You're signed up${
                  ann.data ? ` for “${ann.data.title}”` : ""
                } — your registration is live. You'll be in the lobby when the match goes live.`}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <Link
              href="/notifications"
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
      <LeagueTitle eyebrow={`${season?.name ?? "League"} registration`} title="REGISTER TO PLAY" />

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

            {!showGamePicker ? (
              <>
                <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>GAME</div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".06em",
                    padding: "9px 13px",
                    borderRadius: 5,
                    border: `1px solid ${SQ.field}`,
                    background: SQ.inset,
                    color: SQ.ink,
                  }}
                >
                  {derivedGame}
                </span>
                <div style={{ marginTop: 8, fontSize: 12, color: SQ.mute, lineHeight: 1.5 }}>
                  The game is fixed by the announcement you&rsquo;re registering for.
                </div>
              </>
            ) : (
              <>
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
              </>
            )}

            {alreadyRegistered ? (
              <div
                style={{
                  margin: "18px 0 0",
                  padding: "12px 14px",
                  borderRadius: 5,
                  background: SQ.inset,
                  border: `1px solid ${SQ.amber}`,
                  color: SQ.ink,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}
              >
                <span style={{ color: SQ.amber, fontWeight: 700 }}>
                  You are already registered for this match.
                </span>{" "}
                <Link
                  href="/my/registrations"
                  style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}
                >
                  View your registrations ▸
                </Link>
              </div>
            ) : registrationLocked ? (
              <div
                style={{
                  margin: "18px 0 0",
                  padding: "12px 14px",
                  borderRadius: 5,
                  background: SQ.inset,
                  border: `1px solid ${SQ.amber}`,
                  color: SQ.amber,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}
              >
                Registration closed — locks 3 hours before match time.
              </div>
            ) : null}

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

            {(() => {
              const disabled = apply.isPending || alreadyRegistered || registrationLocked;
              const label = alreadyRegistered
                ? "Already registered"
                : registrationLocked
                  ? "Registration closed"
                  : apply.isPending
                    ? "Submitting…"
                    : "Submit registration ▸";
              return (
                <button
                  type="submit"
                  disabled={disabled}
                  style={{
                    cursor: disabled ? "not-allowed" : "pointer",
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
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  {label}
                </button>
              );
            })()}
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
                    : "Submit the games you want to compete in and how to reach you. Your registration goes live immediately — you'll be in the lobby when the match starts. Registration locks a few hours before match time."}
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

// ---------------------------------------------------------------------------
// AUCTION self-registration — exhaustive per-game expertise form.
// Fed by an announcement whose registrationType is "AUCTION". Unlike the match/
// squad flows there is no derived game, no squad name and no 3h match-lock: the
// player declares which games they play, how strong they are (0-100) and their
// in-game handle, plus a free-form note for admins. This feeds the auction pool.
// ---------------------------------------------------------------------------

const clampRating = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0);

function AuctionRegisterForm({
  user,
  seasonName,
  announcementTitle,
}: {
  user: SessionUser | null;
  seasonName?: string;
  announcementTitle?: string;
}) {
  const gamesQ = useGames(true);
  const apply = useApplyRegistration();

  const games: GameSummary[] = gamesQ.data ?? [];

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  // Per-game expertise, keyed by gameId. `on` = "I play this"; rating is 0-100; handle is optional.
  const [plays, setPlays] = useState<Record<string, boolean>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [done, setDone] = useState(false);

  // Prefill identity from the signed-in user.
  useEffect(() => {
    if (user?.name) setName((n) => n || user.name);
  }, [user]);
  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email);
  }, [user]);

  const toggleGame = (id: string) =>
    setPlays((cur) => {
      const on = !cur[id];
      // First time a game is switched on, seed a sensible rating so the slider isn't stuck at 0.
      if (on) setRatings((r) => (r[id] == null ? { ...r, [id]: 50 } : r));
      return { ...cur, [id]: on };
    });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (alreadyRegistered) return;

    const chosen = games.filter((g) => plays[g.id]);
    // Require at least one game toggled on with a rating above 0 — no squad, no derived game.
    const rated = chosen.filter((g) => clampRating(ratings[g.id] ?? 0) > 0);
    if (rated.length === 0) {
      setError("Add at least one game you play with a rating above 0.");
      return;
    }

    const contact = [whatsapp && `WhatsApp: ${whatsapp}`, email && `Email: ${email}`]
      .filter(Boolean)
      .join(" · ");

    const proficiencies = chosen.map((g) => ({
      gameId: g.id,
      rating: clampRating(ratings[g.id] ?? 0),
      handle: handles[g.id]?.trim() || undefined,
    }));

    try {
      await apply.mutateAsync({
        type: "AUCTION",
        games: chosen.map((g) => g.name),
        contact: contact || undefined,
        note: note.trim() || undefined,
        proficiencies,
      });
      setDone(true);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const msg = apiErrorMessage(err, "Could not submit registration.");
      if (status === 409) {
        // Duplicate guard — already have a live auction registration.
        setAlreadyRegistered(true);
        setError(null);
      } else {
        setError(msg);
      }
    }
  };

  if (done) {
    return (
      <div>
        <LeagueTitle eyebrow="Auction registration" title="REGISTER TO PLAY" />
        <div style={{ ...card, marginTop: 24, maxWidth: 560 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".16em", color: SQ.green }}>
            ✓ SUBMITTED
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>You're in the auction pool</div>
          <p style={{ fontSize: 14, color: SQ.faint, lineHeight: 1.6, marginTop: 10 }}>
            The organizers will review your auction registration
            {announcementTitle ? ` for “${announcementTitle}”` : ""} and your declared game expertise.
            Franchises draft from this pool when the auction goes live — you'll get a notification when
            you're reviewed.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <Link
              href="/notifications"
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
              View notifications ▸
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

  const chosenCount = games.filter((g) => plays[g.id]).length;

  return (
    <div>
      <LeagueTitle eyebrow={`${seasonName ?? "Pre-season"} auction`} title="REGISTER TO PLAY" />

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
        {announcementTitle ? (
          <>
            <span style={{ color: SQ.mute, fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".12em" }}>
              REGISTERING FOR
            </span>{" "}
            <span style={{ color: SQ.ink, fontWeight: 600 }}>{announcementTitle}</span>
            <span style={{ color: SQ.ember }}> · Player auction</span>
          </>
        ) : (
          "Auction self-registration — declare the games you play and how strong you are so franchises can draft you."
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
        AUCTION · PLAYER POOL REGISTRATION
      </div>

      <form onSubmit={onSubmit}>
        <div style={grid}>
          {/* left: identity + contact + note */}
          <div style={card}>
            <div style={{ ...fieldLabel, marginBottom: 8 }}>PLAYER NAME</div>
            <input
              className="sq-field"
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />

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

            <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>NOTE FOR ORGANIZERS</div>
            <textarea
              className="sq-field"
              style={{ ...inputStyle, minHeight: 100, lineHeight: 1.5, resize: "vertical" }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the auction admins should know — availability, past teams, achievements…"
            />

            {alreadyRegistered ? (
              <div
                style={{
                  margin: "18px 0 0",
                  padding: "12px 14px",
                  borderRadius: 5,
                  background: SQ.inset,
                  border: `1px solid ${SQ.amber}`,
                  color: SQ.ink,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}
              >
                <span style={{ color: SQ.amber, fontWeight: 700 }}>
                  You are already registered for this auction.
                </span>{" "}
                <Link
                  href="/my/registrations"
                  style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}
                >
                  View your registrations ▸
                </Link>
              </div>
            ) : null}

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

            {(() => {
              const disabled = apply.isPending || alreadyRegistered;
              const label = alreadyRegistered
                ? "Already registered"
                : apply.isPending
                  ? "Submitting…"
                  : "Enter the auction ▸";
              return (
                <button
                  type="submit"
                  disabled={disabled}
                  style={{
                    cursor: disabled ? "not-allowed" : "pointer",
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
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  {label}
                </button>
              );
            })()}
          </div>

          {/* right: exhaustive per-game expertise grid */}
          <div style={card}>
            <div style={{ ...fieldLabel, marginBottom: 6 }}>YOUR GAME EXPERTISE</div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.6, color: SQ.mute }}>
              Toggle every game you play, rate yourself 0–100 and drop your in-game handle. Franchises
              use these ratings to value you in the auction.
              {chosenCount > 0 ? (
                <span style={{ color: SQ.green }}> {chosenCount} selected.</span>
              ) : null}
            </p>

            {games.length === 0 ? (
              <span style={{ fontSize: 13, color: SQ.mute }}>Loading games…</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {games.map((g) => {
                  const on = !!plays[g.id];
                  const rating = clampRating(ratings[g.id] ?? 0);
                  return (
                    <div
                      key={g.id}
                      style={{
                        border: `1px solid ${on ? SQ.red : SQ.hairline}`,
                        borderRadius: 6,
                        padding: on ? "12px 14px" : "0",
                        background: on ? SQ.inset : "transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => toggleGame(g.id)}
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
                          {on ? "✓ " : ""}
                          {g.name}
                        </button>
                        {on ? (
                          <span
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 12,
                              color: SQ.ember,
                              marginLeft: "auto",
                              minWidth: 44,
                              textAlign: "right",
                            }}
                          >
                            {rating}
                            <span style={{ color: SQ.mute }}>/100</span>
                          </span>
                        ) : null}
                      </div>

                      {on ? (
                        <>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              marginTop: 12,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: FONT.mono,
                                fontSize: 10,
                                letterSpacing: ".12em",
                                color: SQ.label,
                                width: 58,
                                flex: "0 0 auto",
                              }}
                            >
                              RATING
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={rating}
                              onChange={(e) =>
                                setRatings((r) => ({ ...r, [g.id]: clampRating(Number(e.target.value)) }))
                              }
                              style={{ flex: 1, accentColor: SQ.red, cursor: "pointer" }}
                            />
                            <input
                              className="sq-field"
                              type="number"
                              min={0}
                              max={100}
                              value={rating}
                              onChange={(e) =>
                                setRatings((r) => ({ ...r, [g.id]: clampRating(Number(e.target.value)) }))
                              }
                              style={{ ...inputStyle, width: 72, flex: "0 0 auto", padding: "8px 10px" }}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                            <span
                              style={{
                                fontFamily: FONT.mono,
                                fontSize: 10,
                                letterSpacing: ".12em",
                                color: SQ.label,
                                width: 58,
                                flex: "0 0 auto",
                              }}
                            >
                              HANDLE
                            </span>
                            <input
                              className="sq-field"
                              style={{ ...inputStyle, flex: 1, padding: "8px 10px" }}
                              value={handles[g.id] ?? ""}
                              onChange={(e) =>
                                setHandles((h) => ({ ...h, [g.id]: e.target.value }))
                              }
                              placeholder={`In-game name for ${g.name} (optional)`}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
