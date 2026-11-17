"use client";

import { useMemo, useState } from "react";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { Avatar } from "@/components/sidequest/avatar";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import {
  useAdminTeam,
  useAppointAdmin,
  useRevokeAdmin,
  usePlayers,
} from "@/lib/query/hooks";
import { useAuth } from "@/lib/auth/context";
import { apiErrorMessage } from "@/lib/api/client";
import type { TeamMember } from "@/lib/api/types";

const card = {
  background: SQ.panel,
  border: `1px solid ${SQ.hairline}`,
  borderRadius: 10,
  padding: "16px 18px",
} as const;

const label = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: SQ.steel,
  marginBottom: 12,
} as const;

const btn = {
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: "8px 14px",
  borderRadius: 6,
  cursor: "pointer",
  border: "1px solid transparent",
} as const;

function TierBadge({ level }: { level: string }) {
  const main = level === "SUPER_ADMIN";
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 9,
        letterSpacing: ".12em",
        color: main ? SQ.ember : SQ.mute,
        border: `1px solid ${main ? "rgba(232,96,44,.5)" : SQ.inputBorder}`,
        padding: "3px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {main ? "MAIN ADMIN" : "ADMIN"}
    </span>
  );
}

export function TeamScreen() {
  const { isSuperAdmin } = useAuth();
  const teamQ = useAdminTeam(isSuperAdmin);
  const playersQ = usePlayers({ limit: 200 });
  const appoint = useAppointAdmin();
  const revoke = useRevokeAdmin();

  const [search, setSearch] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState<TeamMember | null>(null);
  const [pendingAppoint, setPendingAppoint] = useState<{ id: string; gamerTag: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const admins = useMemo(
    () => (teamQ.data ?? []).filter((m) => m.adminLevel !== "NONE"),
    [teamQ.data],
  );
  const adminPlayerIds = useMemo(
    () => new Set(admins.map((m) => m.playerId).filter(Boolean) as string[]),
    [admins],
  );

  // Appoint picker: players who aren't already admins, filtered by the search box. The full list is
  // shown (scrollable) rather than truncated — the search box narrows it. Alphabetical for scanability.
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (playersQ.data?.items ?? [])
      .filter((p) => !adminPlayerIds.has(p.id))
      .filter((p) => (q ? p.gamerTag.toLowerCase().includes(q) : true))
      .sort((a, b) => a.gamerTag.localeCompare(b.gamerTag));
  }, [playersQ.data, adminPlayerIds, search]);

  if (!isSuperAdmin) {
    return (
      <div>
        <ScreenHeader eyebrow="System" title="ADMINS" />
        <StateNote>Only the main admin can appoint or revoke admins.</StateNote>
      </div>
    );
  }

  const onAppoint = async () => {
    if (!pendingAppoint) return;
    setErr(null);
    try {
      await appoint.mutateAsync(pendingAppoint.id);
      setPendingAppoint(null);
      setSearch("");
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't appoint that player."));
      setPendingAppoint(null);
    }
  };

  const onRevoke = async () => {
    if (!pendingRevoke?.playerId) return;
    setErr(null);
    try {
      await revoke.mutateAsync(pendingRevoke.playerId);
      setPendingRevoke(null);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't revoke that admin."));
      setPendingRevoke(null);
    }
  };

  return (
    <div>
      <ScreenHeader eyebrow="System" title="ADMINS" />
      <div style={{ fontSize: 13, color: SQ.mute, margin: "6px 0 20px" }}>
        You are the main admin. Appoint players to help run the league, or revoke access.
      </div>

      {err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember, marginBottom: 14 }}>{err}</div>
      ) : null}

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        {/* current admins */}
        <div style={card}>
          <div style={label}>Current admins</div>
          {admins.length === 0 ? (
            <StateNote>No admins yet.</StateNote>
          ) : (
            admins.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 0",
                  borderTop: `1px solid ${SQ.hairlineCell}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    {m.name}
                    <TierBadge level={m.adminLevel} />
                  </div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, marginTop: 2 }}>
                    {m.email}
                  </div>
                </div>
                {m.adminLevel === "ADMIN" && m.playerId ? (
                  <button
                    type="button"
                    onClick={() => setPendingRevoke(m)}
                    disabled={revoke.isPending}
                    style={{
                      ...btn,
                      color: SQ.ember,
                      background: "transparent",
                      borderColor: SQ.inputBorder,
                    }}
                  >
                    Revoke
                  </button>
                ) : (
                  <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: SQ.steel }}>YOU</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* appoint */}
        <div style={card}>
          <div style={label}>Appoint an admin</div>
          <input
            className="sq-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players by gamer tag…"
            style={{
              width: "100%",
              background: SQ.inset,
              border: `1px solid ${SQ.inputBorder}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              color: SQ.ink,
              marginBottom: 12,
            }}
          />
          {playersQ.isLoading ? (
            <StateNote>Loading players…</StateNote>
          ) : candidates.length === 0 ? (
            <StateNote>{search ? "No matching players." : "No players to appoint."}</StateNote>
          ) : (
            <>
              <div style={{ maxHeight: 360, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
                {candidates.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderTop: `1px solid ${SQ.hairlineCell}`,
                    }}
                  >
                    <Avatar url={p.avatarUrl} alt={p.gamerTag} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.gamerTag}</div>
                      <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginTop: 1 }}>
                        {p.franchiseName ?? "Free agent"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingAppoint({ id: p.id, gamerTag: p.gamerTag })}
                      disabled={appoint.isPending}
                      style={{ ...btn, color: SQ.sidebar, background: SQ.red }}
                    >
                      Make admin
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.steel, marginTop: 10 }}>
                {candidates.length} {candidates.length === 1 ? "player" : "players"}
                {search ? " matching" : " available"}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!pendingAppoint}
        title="Appoint as admin?"
        message={
          <>
            <strong>{pendingAppoint?.gamerTag}</strong> will gain admin access — they can manage
            matches, registrations, disputes, players, games and announcements. They will{" "}
            <strong>not</strong> be able to run the player auction, manage franchises, or appoint other
            admins — those stay with you, the main admin. You can revoke this at any time.
          </>
        }
        confirmLabel="Make admin"
        busy={appoint.isPending}
        onConfirm={onAppoint}
        onClose={() => setPendingAppoint(null)}
      />

      <ConfirmModal
        open={!!pendingRevoke}
        title="Revoke admin access?"
        message={`${pendingRevoke?.name ?? "This admin"} will lose admin access immediately and return to being a player.`}
        confirmLabel="Revoke"
        tone="destructive"
        busy={revoke.isPending}
        onConfirm={onRevoke}
        onClose={() => setPendingRevoke(null)}
      />
    </div>
  );
}
