"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { useAuth } from "@/lib/auth/context";
import {
  useMyRegistrations,
  useMyInvites,
  useInviteTeammate,
  useRespondInvite,
  usePlayers,
  useCancelRegistration,
  useHideRegistration,
  useLeaveSquad,
} from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/api/client";
import { shortDate } from "@/lib/adapters/league";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import type { InviteView, RegistrationView } from "@/lib/api/types";
import { matchHref } from "@/lib/routes";

const sectionTitle = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  margin: "0 0 14px",
} as const;

const chip = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".04em",
  color: SQ.faint,
  border: `1px solid ${SQ.field}`,
  padding: "5px 9px",
  borderRadius: 5,
} as const;

function statusColor(status: string) {
  if (status === "ACCEPTED" || status === "APPROVED" || status === "ACTIVE") return SQ.green;
  if (status === "REJECTED") return SQ.ember;
  // A pending invite voided at lock (EXPIRED), a withdrawn sign-up (WITHDRAWN — a neutral,
  // non-punitive void), or a locked/closed registration — all read as inert, never punitive red.
  if (status === "EXPIRED" || status === "LOCKED" || status === "WITHDRAWN") return SQ.mute;
  return SQ.amber;
}

// Roster-member colouring for the "who's already on this squad" list: ACCEPTED green, PENDING amber,
// REJECTED / EXPIRED muted.
function memberColor(status: string) {
  if (status === "ACCEPTED") return SQ.green;
  if (status === "PENDING") return SQ.amber;
  return SQ.mute;
}

export function MyRegistrationsScreen() {
  const { isAuthenticated, hydrated } = useAuth();
  const regsQ = useMyRegistrations(isAuthenticated);
  const invitesQ = useMyInvites(isAuthenticated);
  const respond = useRespondInvite();

  if (hydrated && !isAuthenticated) {
    return (
      <div>
        <Header />
        <StateNote>
          <Link href="/login" style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}>
            Sign in
          </Link>{" "}
          to manage your squads and invitations.
        </StateNote>
      </div>
    );
  }

  const regs = regsQ.data ?? [];
  const invites = invitesQ.data ?? [];
  const pendingInvites = invites.filter((i) => i.status === "PENDING");
  // Squads you accepted an invite to that are still assembling. Leaving one frees you to accept a
  // different captain's invite — a player may only hold a spot on one forming squad at a time.
  const joinedSquads = invites.filter(
    (i) => i.status === "ACCEPTED" && i.registrationStatus === "FORMING",
  );

  // Group registrations by the match/announcement they're for; non-match "general" sign-ups
  // (season bids, franchise proposals, etc.) get their own section. Backend order is newest-first.
  const matchGroups: { matchId: string; matchSlug?: string; gameName?: string; regs: RegistrationView[] }[] = [];
  const generalRegs: RegistrationView[] = [];
  const groupIndex = new Map<string, number>();
  for (const r of regs) {
    if (r.matchId) {
      let idx = groupIndex.get(r.matchId);
      if (idx === undefined) {
        idx = matchGroups.length;
        groupIndex.set(r.matchId, idx);
        matchGroups.push({ matchId: r.matchId, matchSlug: r.matchSlug, gameName: r.gameName, regs: [] });
      }
      if (!matchGroups[idx].gameName && r.gameName) matchGroups[idx].gameName = r.gameName;
      matchGroups[idx].regs.push(r);
    } else {
      generalRegs.push(r);
    }
  }

  return (
    <div>
      <Header />

      {/* incoming invitations — only PENDING ones need action; accepted/declined
          invites disappear rather than lingering as dead cards. Hide the whole
          section (header included) once nothing is awaiting a response. */}
      {invitesQ.isLoading ? (
        <section style={{ marginTop: 26 }}>
          <div style={sectionTitle}>Invitations to you</div>
          <StateNote>Loading invitations…</StateNote>
        </section>
      ) : pendingInvites.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <div style={sectionTitle}>Invitations to you</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
            {pendingInvites.map((inv) => (
              <div key={inv.id} style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{inv.squadName || "Squad"}</div>
                  <span style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".1em", color: statusColor(inv.status) }}>
                    {inv.status}
                  </span>
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 4 }}>
                  from {inv.captainGamerTag ?? "captain"} · {shortDate(inv.createdAt)}
                </div>
                {inv.message ? (
                  <div style={{ fontSize: 13, color: SQ.faint, marginTop: 8 }}>&ldquo;{inv.message}&rdquo;</div>
                ) : null}
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0" }}>
                  {(inv.games ?? []).map((g) => (
                    <span key={g} style={chip}>{g}</span>
                  ))}
                </div>

                {/* Who's already on this squad — lets the invitee see the roster before accepting. */}
                {inv.members && inv.members.length > 0 ? (
                  <div style={{ margin: "0 0 12px" }}>
                    <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".1em", color: SQ.label, marginBottom: 6 }}>
                      SQUAD SO FAR
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {inv.members.map((m, i) => (
                        <div key={`${m.gamerTag}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <span style={{ flex: 1, fontWeight: m.isCaptain ? 700 : 500 }}>
                            {m.gamerTag}
                            {m.isCaptain ? (
                              <span style={{ fontFamily: FONT.mono, fontSize: 9, color: SQ.ember, marginLeft: 6 }}>CAPTAIN</span>
                            ) : null}
                          </span>
                          <span style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: ".08em", color: memberColor(m.status) }}>
                            {m.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ inviteId: inv.id, accept: true })}
                    style={actionBtn(SQ.green, SQ.sidebar, false, respond.isPending)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ inviteId: inv.id, accept: false })}
                    style={actionBtn("transparent", SQ.ember, true, respond.isPending)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 10 }}>
            {pendingInvites.length} awaiting your response.
          </div>
        </section>
      ) : null}

      {/* squads you've joined — accepted invites for squads still forming. Leaving one frees you
          to accept a different captain's invite. */}
      {joinedSquads.length > 0 ? (
        <section style={{ marginTop: 40 }}>
          <div style={sectionTitle}>Squads you&rsquo;ve joined</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
            {joinedSquads.map((inv) => (
              <JoinedSquadCard key={inv.id} invite={inv} />
            ))}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 10 }}>
            Leave a squad to free yourself to accept another captain&rsquo;s invite.
          </div>
        </section>
      ) : null}

      {/* your registrations */}
      <section style={{ marginTop: 40 }}>
        <div style={sectionTitle}>Your registrations</div>
        {regsQ.isLoading ? (
          <StateNote>Loading your registrations…</StateNote>
        ) : regs.length === 0 ? (
          <StateNote>
            You haven&rsquo;t registered yet. Find an open call on the{" "}
            <Link href="/announcements" style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}>
              announcements
            </Link>{" "}
            page.
          </StateNote>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {matchGroups.map((g) => (
              <div key={g.matchId}>
                <GroupHeader eyebrow="Match" title={g.gameName || "Match sign-up"} hint={`#${g.matchId.slice(0, 8)}`} matchId={g.matchId} matchSlug={g.matchSlug} />
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {g.regs.map((r) => (
                    <RegistrationCard key={r.id} r={r} />
                  ))}
                </div>
              </div>
            ))}
            {generalRegs.length > 0 ? (
              <div>
                <GroupHeader eyebrow="General" title="Season & general sign-ups" />
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {generalRegs.map((r) => (
                    <RegistrationCard key={r.id} r={r} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function RegistrationCard({ r }: { r: RegistrationView }) {
  const invite = useInviteTeammate();
  const playersQ = usePlayers({ limit: 100 });
  const cancel = useCancelRegistration();
  const hide = useHideRegistration();
  const [tag, setTag] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const isSquad = r.type === "SQUAD";
  const isForming = r.status === "FORMING";
  // A live sign-up (still assembling or active) may be withdrawn by its owner — never a locked,
  // finalized, already-withdrawn, or rejected one.
  const canCancel = r.status === "FORMING" || r.status === "ACTIVE";
  // Invites are only allowed while the squad is still assembling (FORMING). It auto-locks a few
  // hours before the match (LOCKED), at which point the invite UI disappears.
  const canInvite = isSquad && isForming;

  // Roster cap (invite cap) from the announcement. A slot is "occupied" by any member who is
  // confirmed (ACCEPTED) or still pending — once those reach the cap the squad is full.
  const teamSize = r.teamSize;
  const occupied = r.members.filter(
    (m) => m.status === "ACCEPTED" || m.status === "PENDING",
  ).length;
  const isFull = teamSize != null && occupied >= teamSize;

  // Live candidate list, mirroring the picker on the register screen: match players by gamer-tag
  // substring and drop anyone already on the roster (the captain + everyone already invited).
  const candidates = useMemo(() => {
    const q = tag.trim().toLowerCase();
    if (!q) return [];
    const takenIds = new Set(r.members.map((m) => m.playerId));
    const takenTags = new Set(r.members.map((m) => m.gamerTag.toLowerCase()));
    return (playersQ.data?.items ?? [])
      .filter((p) => p.gamerTag.toLowerCase().includes(q))
      .filter((p) => !takenIds.has(p.id) && !takenTags.has(p.gamerTag.toLowerCase()))
      .slice(0, 5);
  }, [tag, playersQ.data, r.members]);

  const sendInvite = async (gamerTag: string) => {
    setErr(null);
    if (isFull) return;
    const gt = gamerTag.trim();
    if (!gt) return;
    try {
      await invite.mutateAsync({ id: r.id, body: { gamerTag: gt } });
      setTag("");
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't send the invite."));
    }
  };

  const doCancel = async () => {
    setCancelErr(null);
    try {
      await cancel.mutateAsync(r.id);
      setConfirmCancel(false);
    } catch (e) {
      setCancelErr(apiErrorMessage(e, "Couldn't withdraw the registration."));
    }
  };

  return (
    <div style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {isSquad ? r.squadName || "Squad" : "Solo entry"}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 3 }}>
            {r.type} · {shortDate(r.createdAt)}
          </div>
        </div>
        {isForming ? (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: ".12em",
              color: SQ.amber,
              border: `1px solid ${SQ.amber}`,
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            ● FORMING
          </span>
        ) : (
          <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: statusColor(r.status) }}>
            {r.status}
          </span>
        )}
      </div>

      {(() => {
        // Prefer the derived game for the match; fall back to the picked games list (general calls).
        const games = r.gameName ? [r.gameName] : r.games ?? [];
        return games.length > 0 ? (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0" }}>
            {games.map((g) => (
              <span key={g} style={chip}>{g}</span>
            ))}
          </div>
        ) : null;
      })()}

      {r.reason ? (
        <div style={{ fontSize: 12.5, color: SQ.faint, marginBottom: 12 }}>
          {r.status === "REJECTED" || r.status === "WITHDRAWN" ? "Reason: " : "Note: "}
          {r.reason}
        </div>
      ) : null}

      {isSquad ? (
        <>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: SQ.label, marginBottom: 8 }}>
            {teamSize != null ? `ROSTER · ${r.acceptedCount}/${teamSize}` : `ROSTER · ${r.acceptedCount} CONFIRMED`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 0 }}>
            {r.members.map((m) => (
              <div key={m.playerId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span style={{ flex: 1, fontWeight: m.isCaptain ? 700 : 500 }}>
                  {m.gamerTag}
                  {m.isCaptain ? (
                    <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: SQ.ember, marginLeft: 6 }}>CAPTAIN</span>
                  ) : null}
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".08em", color: statusColor(m.status) }}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>

          {canInvite ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: SQ.label, marginBottom: 8 }}>
                INVITE TEAMMATES
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  disabled={isFull}
                  placeholder={isFull ? "Squad is full" : "Search players to invite (e.g. Vortex)"}
                  style={{
                    flex: 1,
                    minWidth: 200,
                    background: SQ.inset,
                    border: `1px solid ${SQ.inputBorder}`,
                    borderRadius: 5,
                    padding: "9px 12px",
                    fontSize: 13.5,
                    color: SQ.ink,
                    fontFamily: FONT.sans,
                    opacity: isFull ? 0.6 : 1,
                    cursor: isFull ? "not-allowed" : "text",
                  }}
                />
                <button
                  type="button"
                  disabled={invite.isPending || !tag.trim() || isFull}
                  onClick={() => sendInvite(tag)}
                  style={actionBtn(SQ.red, SQ.sidebar, false, invite.isPending || !tag.trim() || isFull)}
                >
                  {invite.isPending ? "Inviting…" : "Invite ▸"}
                </button>
              </div>

              {/* live candidate results — click a row to invite that player */}
              {candidates.length > 0 ? (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {candidates.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={invite.isPending}
                      onClick={() => sendInvite(p.gamerTag)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: 5,
                        border: `1px solid ${SQ.inputBorder}`,
                        background: "transparent",
                        color: SQ.ink,
                        cursor: invite.isPending ? "not-allowed" : "pointer",
                        fontSize: 13.5,
                        opacity: invite.isPending ? 0.6 : 1,
                      }}
                    >
                      <span>{p.gamerTag}</span>
                      <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: SQ.ember }}>
                        + INVITE
                      </span>
                    </button>
                  ))}
                </div>
              ) : tag.trim() && !playersQ.isLoading ? (
                <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 8 }}>
                  No players match &ldquo;{tag.trim()}&rdquo; — you can still invite that exact tag above.
                </div>
              ) : null}

              {err ? (
                <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 8 }}>{err}</div>
              ) : null}
              <div style={{ fontSize: 11.5, color: isFull ? SQ.amber : SQ.mute, marginTop: 8 }}>
                {isFull
                  ? `Squad full — the roster cap is ${teamSize}.`
                  : "If someone declines, just invite a different player here."}
              </div>
            </div>
          ) : null}

        </>
      ) : null}

      {canCancel ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${SQ.hairline}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {isSquad && isForming ? (
            <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5 }}>
              Your squad is registered. Invite teammates before it locks — pending invites are voided at
              lock time.
            </div>
          ) : null}
          <div>
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => {
                setCancelErr(null);
                setConfirmCancel(true);
              }}
              style={actionBtn("transparent", SQ.ember, true, cancel.isPending)}
            >
              Cancel registration
            </button>
          </div>
          {cancelErr ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember }}>{cancelErr}</div>
          ) : null}
        </div>
      ) : null}

      {/* Settled (terminal) registrations can be removed from your own history (soft hide). */}
      {!canCancel
      && ["WITHDRAWN", "REJECTED", "EXPIRED", "LOCKED", "APPROVED"].includes(r.status) ? (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={hide.isPending}
            onClick={() => hide.mutate(r.id)}
            title="Remove this from your history"
            style={{
              fontFamily: FONT.mono,
              fontSize: 10.5,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: SQ.mute,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {hide.isPending ? "Removing…" : "✕ Remove"}
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmCancel}
        tone="destructive"
        title="Withdraw registration?"
        message={
          <>
            This withdraws your {isSquad ? "squad" : "solo"} entry
            {isSquad && r.squadName ? (
              <>
                {" "}
                for <strong>{r.squadName}</strong>
              </>
            ) : null}
            . You can then join another team or re-register.
          </>
        }
        confirmLabel="Withdraw"
        busy={cancel.isPending}
        onConfirm={doCancel}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}

function JoinedSquadCard({ invite }: { invite: InviteView }) {
  const leave = useLeaveSquad();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doLeave = async () => {
    setErr(null);
    try {
      await leave.mutateAsync(invite.id);
      setConfirmLeave(false);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't leave the squad."));
    }
  };

  return (
    <div style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{invite.squadName || "Squad"}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 3 }}>
            captain {invite.captainGamerTag ?? "—"} · joined {shortDate(invite.createdAt)}
          </div>
        </div>
        <span style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".1em", color: SQ.green }}>
          ACCEPTED
        </span>
      </div>

      {invite.games && invite.games.length > 0 ? (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0" }}>
          {invite.games.map((g) => (
            <span key={g} style={chip}>{g}</span>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: 4 }}>
        <button
          type="button"
          disabled={leave.isPending}
          onClick={() => {
            setErr(null);
            setConfirmLeave(true);
          }}
          style={actionBtn("transparent", SQ.ember, true, leave.isPending)}
        >
          Leave squad
        </button>
      </div>
      {err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 8 }}>{err}</div>
      ) : null}

      <ConfirmModal
        open={confirmLeave}
        tone="destructive"
        title="Leave this squad?"
        message={
          <>
            You&rsquo;ll be removed from <strong>{invite.squadName || "this squad"}</strong>. You can then
            accept another captain&rsquo;s invite or register your own team.
          </>
        }
        confirmLabel="Leave squad"
        busy={leave.isPending}
        onConfirm={doLeave}
        onClose={() => setConfirmLeave(false)}
      />
    </div>
  );
}

function Header() {
  return (
    <div>
      <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".22em", textTransform: "uppercase", color: SQ.red }}>
        Your squads
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: "clamp(34px,5vw,56px)", lineHeight: 0.92, letterSpacing: "-.03em", marginTop: 10 }}>
        MY TEAM
      </div>
      <div style={{ fontSize: 13.5, color: SQ.mute, marginTop: 12, lineHeight: 1.5, maxWidth: 560 }}>
        Manage the squads you registered, build your roster by inviting teammates, and respond to invitations from other captains.
      </div>
    </div>
  );
}

function GroupHeader({
  eyebrow,
  title,
  hint,
  matchId,
  matchSlug,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  matchId?: string;
  matchSlug?: string;
}) {
  const hintStyle = {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: ".06em",
    color: SQ.mute,
  } as const;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", margin: "0 0 14px" }}>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: SQ.label,
        }}
      >
        {eyebrow}
      </span>
      <span style={{ fontSize: 15.5, fontWeight: 700, color: SQ.ink }}>{title}</span>
      {hint ? (
        matchId ? (
          <Link href={matchHref(matchSlug ?? matchId)} style={{ ...hintStyle, textDecoration: "none" }}>
            {hint}
          </Link>
        ) : (
          <span style={hintStyle}>{hint}</span>
        )
      ) : null}
    </div>
  );
}

function actionBtn(bg: string, color: string, outline: boolean, disabled: boolean) {
  return {
    flex: outline ? undefined : 1,
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    padding: "10px 16px",
    borderRadius: 5,
    cursor: disabled ? "not-allowed" : "pointer",
    color,
    background: bg,
    border: outline ? `1px solid rgba(232,96,44,.45)` : "none",
    opacity: disabled ? 0.6 : 1,
  };
}
