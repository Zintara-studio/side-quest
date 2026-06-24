"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { useAuth } from "@/lib/auth/context";
import {
  useMyRegistrations,
  useMyInvites,
  useInviteTeammate,
  useRespondInvite,
} from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/api/client";
import { shortDate } from "@/lib/adapters/league";
import type { RegistrationView } from "@/lib/api/types";

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
  if (status === "ACCEPTED" || status === "APPROVED") return SQ.green;
  if (status === "REJECTED") return SQ.ember;
  return SQ.amber;
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

  return (
    <div>
      <Header />

      {/* incoming invitations */}
      <section style={{ marginTop: 26 }}>
        <div style={sectionTitle}>Invitations to you</div>
        {invitesQ.isLoading ? (
          <StateNote>Loading invitations…</StateNote>
        ) : invites.length === 0 ? (
          <StateNote>No squad invitations yet.</StateNote>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
            {invites.map((inv) => (
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
                {inv.status === "PENDING" ? (
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
                ) : null}
              </div>
            ))}
          </div>
        )}
        {pendingInvites.length > 0 ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 10 }}>
            {pendingInvites.length} awaiting your response.
          </div>
        ) : null}
      </section>

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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {regs.map((r) => (
              <RegistrationCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RegistrationCard({ r }: { r: RegistrationView }) {
  const invite = useInviteTeammate();
  const [tag, setTag] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const isSquad = r.type === "SQUAD";
  const canInvite = isSquad && r.status === "PENDING";

  const sendInvite = async () => {
    setErr(null);
    if (!tag.trim()) return;
    try {
      await invite.mutateAsync({ id: r.id, body: { gamerTag: tag.trim() } });
      setTag("");
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't send the invite."));
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
        <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: statusColor(r.status) }}>
          {r.status}
        </span>
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0" }}>
        {(r.games ?? []).map((g) => (
          <span key={g} style={chip}>{g}</span>
        ))}
      </div>

      {r.reason ? (
        <div style={{ fontSize: 12.5, color: SQ.faint, marginBottom: 12 }}>
          {r.status === "REJECTED" ? "Reason: " : "Note: "}
          {r.reason}
        </div>
      ) : null}

      {isSquad ? (
        <>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: SQ.label, marginBottom: 8 }}>
            ROSTER · {r.acceptedCount} CONFIRMED
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canInvite ? 14 : 0 }}>
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
            <div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Invite by gamer tag (e.g. Vortex)"
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
                  }}
                />
                <button
                  type="button"
                  disabled={invite.isPending || !tag.trim()}
                  onClick={sendInvite}
                  style={actionBtn(SQ.red, SQ.sidebar, false, invite.isPending || !tag.trim())}
                >
                  {invite.isPending ? "Inviting…" : "Invite ▸"}
                </button>
              </div>
              {err ? (
                <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 8 }}>{err}</div>
              ) : null}
              <div style={{ fontSize: 11.5, color: SQ.mute, marginTop: 8 }}>
                If someone declines, just invite a different player here.
              </div>
            </div>
          ) : null}
        </>
      ) : null}
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
