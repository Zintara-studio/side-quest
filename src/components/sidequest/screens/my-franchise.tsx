"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { playerHref, matchHref } from "@/lib/routes";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { Modal } from "../modal";
import { Avatar } from "../avatar";
import { SearchableSelect } from "../searchable-select";
import { LineupEditor } from "../lineup-editor";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import {
  useMyFranchise,
  useMyFranchiseInvites,
  useFranchisePendingInvites,
  useRespondFranchiseInvite,
  useCreateFranchiseInvite,
  useEligibleOwners,
  useFranchiseRoster,
  useFranchiseMatches,
  useMatchLineups,
  useCurrentSeason,
  useActiveAuction,
  useUpdateFranchiseBranding,
  useUploadMedia,
  useSetRosterTags,
} from "@/lib/query/hooks";
import { mediaSrc } from "@/lib/api/client";
import { compressImage, IMAGE_PRESETS } from "@/lib/image";
import { shortDate } from "@/lib/adapters/league";
import type {
  FranchiseInviteView,
  FranchiseMineView,
  FranchiseRole,
  RosterMember,
} from "@/lib/api/types";

const sectionTitle = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  margin: "0 0 14px",
} as const;

const subLabel = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  color: SQ.label,
  marginBottom: 8,
} as const;

function statusColor(status: string) {
  if (status === "ACCEPTED" || status === "APPROVED") return SQ.green;
  if (status === "REJECTED") return SQ.ember;
  return SQ.amber;
}

export function MyFranchiseScreen() {
  const { isAuthenticated, hydrated } = useAuth();
  const invitesQ = useMyFranchiseInvites(isAuthenticated);
  const mineQ = useMyFranchise(isAuthenticated);

  if (hydrated && !isAuthenticated) {
    return (
      <div>
        <Header />
        <StateNote>
          <Link href="/login" style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}>
            Sign in
          </Link>{" "}
          to manage your franchise, its lineups and leadership.
        </StateNote>
      </div>
    );
  }

  // Only surface invites still awaiting a response; once accepted/rejected they drop off the list.
  const invites = (invitesQ.data ?? []).filter((inv) => inv.status === "PENDING");
  const mine = mineQ.data ?? null;

  return (
    <div>
      <Header />

      {/* leadership invitations addressed to this user (owner/manager offers) */}
      {invites.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <div style={sectionTitle}>Franchise invitations to you</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
            {invites.map((inv) => (
              <InviteCard key={inv.id} inv={inv} />
            ))}
          </div>
        </section>
      ) : null}

      {/* the franchise this user owns / manages / plays for */}
      <section style={{ marginTop: 40 }}>
        <div style={sectionTitle}>Your franchise</div>
        {!hydrated || mineQ.isLoading ? (
          // Before hydration the query is disabled (data undefined); don't flash the "no franchise"
          // empty state to a signed-in owner while auth rehydrates.
          <StateNote>Loading your franchise…</StateNote>
        ) : !mine ? (
          <StateNote>
            You don&rsquo;t own or manage a franchise yet. Franchises are formed between seasons — watch
            the{" "}
            <Link href="/announcements" style={{ color: SQ.ember, textDecoration: "none" }}>
              announcements
            </Link>{" "}
            for an open franchise call, or enter the player{" "}
            <Link href="/auction" style={{ color: SQ.ember, textDecoration: "none" }}>
              auction
            </Link>{" "}
            to get drafted onto one. Owners can also invite you as a manager.
          </StateNote>
        ) : (
          <FranchisePanel mine={mine} />
        )}
      </section>
    </div>
  );
}

// ---- read-only fielded lineup (so roster players see who they'll play with) -----

function FieldedLineup({ matchId, franchiseId }: { matchId: string; franchiseId: string }) {
  const lineupsQ = useMatchLineups(matchId);
  const mine = (lineupsQ.data ?? []).find((l) => l.franchiseId === franchiseId);
  const players = mine?.lineup ?? [];
  if (lineupsQ.isLoading || players.length === 0) {
    // Nothing set yet (or still loading) — a quiet hint keeps the list uncluttered.
    return (
      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".08em", color: SQ.mute, marginTop: 8 }}>
        {lineupsQ.isLoading ? "" : "Lineup not set yet"}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".12em", color: SQ.label, alignSelf: "center" }}>
        FIELDED
      </span>
      {players.map((p) => (
        <span
          key={p.playerId}
          style={{
            fontFamily: FONT.mono,
            fontSize: 10.5,
            color: SQ.faint,
            background: SQ.inset,
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 999,
            padding: "3px 9px",
          }}
        >
          {p.gamerTag}
        </span>
      ))}
    </div>
  );
}

// ---- incoming leadership invite card ---------------------------------------

function InviteCard({ inv }: { inv: FranchiseInviteView }) {
  const respond = useRespondFranchiseInvite();
  const [err, setErr] = useState<string | null>(null);
  const roleLabel = inv.role === "OWNER" ? "Ownership" : "Manager";
  const isPending = inv.status === "PENDING";

  const act = async (accept: boolean) => {
    setErr(null);
    try {
      await respond.mutateAsync({ inviteId: inv.id, accept });
    } catch (e) {
      setErr(
        apiErrorMessage(e, accept ? "Couldn't accept this invite." : "Couldn't decline this invite."),
      );
    }
  };

  return (
    <div style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: ".12em",
            color: inv.role === "OWNER" ? SQ.red : SQ.amber,
            border: `1px solid ${inv.role === "OWNER" ? SQ.red : SQ.amber}`,
            borderRadius: 999,
            padding: "4px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {roleLabel.toUpperCase()}
        </span>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
          {inv.franchiseName}
          {inv.franchiseTag ? <span style={{ color: SQ.mute }}> · {inv.franchiseTag}</span> : null}
        </div>
        <span style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".1em", color: statusColor(inv.status) }}>
          {inv.status}
        </span>
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 6 }}>
        from {inv.invitedByGamerTag ?? "the owner"} · {shortDate(inv.createdAt)}
      </div>
      {inv.message ? (
        <div style={{ fontSize: 13, color: SQ.faint, marginTop: 8 }}>&ldquo;{inv.message}&rdquo;</div>
      ) : null}
      {isPending ? (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            disabled={respond.isPending}
            onClick={() => act(true)}
            style={actionBtn(SQ.green, SQ.sidebar, false, respond.isPending)}
          >
            Accept
          </button>
          <button
            type="button"
            disabled={respond.isPending}
            onClick={() => act(false)}
            style={actionBtn("transparent", SQ.ember, true, respond.isPending)}
          >
            Decline
          </button>
        </div>
      ) : null}
      {err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 10 }}>{err}</div>
      ) : null}
    </div>
  );
}

// ---- the user's franchise (roster / matches / owner controls) --------------

function FranchisePanel({ mine }: { mine: FranchiseMineView }) {
  const { franchise: f, myRole } = mine;
  const rosterQ = useFranchiseRoster(f.id);
  const matchesQ = useFranchiseMatches(f.id);
  const canManage = myRole === "OWNER" || myRole === "MANAGER";
  const isOwner = myRole === "OWNER";

  // Surface the bidding-room CTA to owners/managers whose franchise is a PARTICIPANT while the hall
  // is open (LOBBY), running (LIVE), or momentarily paused. LOBBY is the crucial case: it's the
  // reliable in-app entry to the room before bidding starts (the notification deep-link 404'd).
  const activeAuction = useActiveAuction().data ?? null;
  // This franchise's seat at the auction table (match by id) — lets us reflect its join state.
  // Guard `franchises` defensively: a malformed/empty payload must never crash this page.
  const myAuctionSeat = activeAuction?.franchises?.find((fr) => fr.franchiseId === f.id) ?? null;
  const auctionOpen =
    canManage &&
    (activeAuction?.status === "LOBBY" ||
      activeAuction?.status === "LIVE" ||
      activeAuction?.status === "PAUSED") &&
    !!myAuctionSeat;
  const auctionLive = activeAuction?.status === "LIVE";
  const auctionSubline =
    activeAuction?.status === "LOBBY"
      ? "Join the hall before bidding starts"
      : activeAuction?.status === "PAUSED"
        ? "Bidding is paused — stay in the room"
        : "Bidding is live — enter the room";

  // Which upcoming match has its lineup editor open (matchId, or null).
  const [lineupMatchId, setLineupMatchId] = useState<string | null>(null);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [tagPlayer, setTagPlayer] = useState<RosterMember | null>(null);
  const bannerSrc = mediaSrc(f.bannerUrl);

  const { upcoming, previous } = useMemo(() => {
    const all = matchesQ.data ?? [];
    return {
      upcoming: all.filter((m) => m.status === "SCHEDULED" || m.status === "LIVE"),
      previous: all.filter((m) => m.status !== "SCHEDULED" && m.status !== "LIVE"),
    };
  }, [matchesQ.data]);

  return (
    <div>
      {/* auction-hall CTA — the reliable in-app entry to the bidding room while the hall is open
          (LOBBY), running (LIVE), or paused, for owners/managers of a participating franchise */}
      {auctionOpen ? (
        <Link
          href="/my/franchise/auction"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            marginBottom: 24,
            padding: "16px 20px",
            borderRadius: 10,
            textDecoration: "none",
            border: `1px solid ${SQ.red}`,
            background: "linear-gradient(90deg,rgba(232,96,44,.16),transparent)",
            color: SQ.ink,
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              letterSpacing: ".14em",
              color: auctionLive ? SQ.red : SQ.amber,
              border: `1px solid ${auctionLive ? SQ.red : SQ.amber}`,
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            ● {activeAuction?.status}
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>
              Auction hall is open — {activeAuction?.title}
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".08em",
                color: SQ.faint,
                marginTop: 5,
              }}
            >
              {auctionSubline}
              {" · "}
              <span style={{ color: myAuctionSeat?.joined ? SQ.green : SQ.amber }}>
                {myAuctionSeat?.joined ? "YOU'VE JOINED" : "JOIN NOW"}
              </span>
            </div>
          </div>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10.5,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: SQ.league,
              background: SQ.red,
              padding: "10px 16px",
              borderRadius: 6,
              whiteSpace: "nowrap",
            }}
          >
            Enter the bidding room ▸
          </span>
        </Link>
      ) : null}

      {/* franchise banner (hero image) */}
      {bannerSrc ? (
        <div
          style={{
            height: 140,
            borderRadius: 10,
            marginBottom: 18,
            backgroundImage: `url(${bannerSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: `1px solid ${SQ.hairline}`,
          }}
        />
      ) : null}

      {/* header: logo, name, tag, points, rank + role pill */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <Avatar url={f.logoUrl} alt={f.name} size={64} radius={10} />
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                fontFamily: FONT.mono,
                fontSize: 12,
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: SQ.red,
              }}
            >
              <span>Rank {String(f.rank).padStart(2, "0")} · {f.points} points</span>
              <span
                style={{
                  fontSize: 9.5,
                  letterSpacing: ".12em",
                  color: SQ.ink,
                  border: `1px solid ${SQ.inputBorder}`,
                  borderRadius: 999,
                  padding: "4px 10px",
                }}
              >
                YOUR ROLE · {myRole}
              </span>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setBrandingOpen(true)}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: ".12em",
                    color: SQ.ember,
                    border: `1px solid ${SQ.inputBorder}`,
                    borderRadius: 999,
                    padding: "4px 10px",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  EDIT BRANDING
                </button>
              ) : null}
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: "clamp(34px,5vw,58px)",
                lineHeight: 0.92,
                letterSpacing: "-.03em",
                marginTop: 10,
              }}
            >
              {f.name}
              {f.tag ? <span style={{ color: SQ.mute }}> — {f.tag}</span> : null}
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: "clamp(44px,7vw,76px)",
            color: SQ.red,
            letterSpacing: "-.03em",
            lineHeight: 0.8,
          }}
        >
          {String(f.rank).padStart(2, "0")}
        </div>
      </div>

      <BrandingModal
        open={brandingOpen}
        franchiseId={f.id}
        currentLogo={f.logoUrl}
        currentBanner={f.bannerUrl}
        onClose={() => setBrandingOpen(false)}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 28,
          marginTop: 30,
        }}
      >
        {/* roster with leadership badges */}
        <div>
          <div style={sectionTitle}>Roster</div>
          {rosterQ.isLoading ? (
            <StateNote>Loading roster…</StateNote>
          ) : (rosterQ.data ?? []).length === 0 ? (
            <StateNote>No players on this roster yet.</StateNote>
          ) : (
            (rosterQ.data ?? []).map((p) => {
              const badges: { label: string; color: string }[] = [];
              if (f.owner?.playerId === p.playerId) badges.push({ label: "OWNER", color: SQ.red });
              if (f.manager?.playerId === p.playerId) badges.push({ label: "MANAGER", color: SQ.amber });
              const tags = p.tags ?? [];
              return (
                <div key={p.playerId} style={{ borderTop: `1px solid ${SQ.hairlineCell}` }}>
                  <Link
                    href={playerHref(p.gamerTag)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 0 8px",
                      textDecoration: "none",
                      color: SQ.ink,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar url={p.avatarUrl} alt={p.gamerTag} size={32} />
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                          {p.gamerTag}
                          {badges.map((b) => (
                            <span
                              key={b.label}
                              style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: ".08em", color: b.color }}
                            >
                              {b.label}
                            </span>
                          ))}
                        </div>
                        <div
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10,
                            letterSpacing: ".1em",
                            color: SQ.mute,
                            marginTop: 2,
                          }}
                        >
                          {p.status}
                          {p.realName ? ` · ${p.realName}` : ""}
                        </div>
                        {/* Contact fields the backend surfaces to franchise leadership only. */}
                        {p.phone || p.contactEmail ? (
                          <div
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 10,
                              letterSpacing: ".04em",
                              color: SQ.faint,
                              marginTop: 3,
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            {p.phone ? <span>☎ {p.phone}</span> : null}
                            {p.contactEmail ? <span>✉ {p.contactEmail}</span> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.dim }}>▸</div>
                  </Link>
                  {/* Franchise-private designation tags (leadership only) + manage control. */}
                  {canManage || tags.length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                        padding: "0 0 12px 44px",
                      }}
                    >
                      {tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 9.5,
                            letterSpacing: ".04em",
                            color: SQ.ember,
                            border: `1px solid rgba(232,96,44,.4)`,
                            borderRadius: 999,
                            padding: "3px 9px",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => setTagPlayer(p)}
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 9.5,
                            letterSpacing: ".08em",
                            color: SQ.mute,
                            background: "transparent",
                            border: `1px dashed ${SQ.inputBorder}`,
                            borderRadius: 999,
                            padding: "3px 9px",
                            cursor: "pointer",
                          }}
                        >
                          {tags.length ? "Edit tags" : "+ Tags"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* matches: upcoming (with lineup control) + previous (results) */}
        <div>
          <div style={sectionTitle}>Matches</div>
          {matchesQ.isLoading ? (
            <StateNote>Loading matches…</StateNote>
          ) : upcoming.length === 0 && previous.length === 0 ? (
            <StateNote>No matches scheduled yet.</StateNote>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {upcoming.length > 0 ? (
                <div>
                  <div style={subLabel}>UPCOMING</div>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: 320 }}>
                      {upcoming.map((m) => (
                        <div key={m.matchId} style={{ borderTop: `1px solid ${SQ.hairlineCell}`, padding: "12px 0" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <Link
                              href={matchHref(m.matchSlug ?? m.matchId)}
                              style={{ textDecoration: "none", color: SQ.ink, flex: 1, minWidth: 0 }}
                            >
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.gameName}</div>
                              <div
                                style={{
                                  fontFamily: FONT.mono,
                                  fontSize: 10,
                                  letterSpacing: ".1em",
                                  color: SQ.mute,
                                  marginTop: 2,
                                }}
                              >
                                {shortDate(m.scheduledAt)} · {m.status}
                              </div>
                            </Link>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => setLineupMatchId(m.matchId)}
                                style={actionBtn("transparent", SQ.ember, true, false)}
                              >
                                Set lineup
                              </button>
                            ) : null}
                          </div>
                          {/* Read-only view of the fielded lineup — so every roster player knows who
                              they'll be playing with, not just the owner/manager. */}
                          <FieldedLineup matchId={m.matchId} franchiseId={f.id} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {previous.length > 0 ? (
                <div>
                  <div style={subLabel}>PREVIOUS</div>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: 320 }}>
                      {previous.map((m) => (
                        <Link
                          key={m.matchId}
                          href={matchHref(m.matchSlug ?? m.matchId)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "13px 0",
                            borderTop: `1px solid ${SQ.hairlineCell}`,
                            textDecoration: "none",
                            color: SQ.ink,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{m.gameName}</div>
                            <div
                              style={{
                                fontFamily: FONT.mono,
                                fontSize: 10,
                                letterSpacing: ".1em",
                                color: SQ.mute,
                                marginTop: 2,
                              }}
                            >
                              {shortDate(m.scheduledAt)} · {m.status}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", display: "flex", gap: 18, alignItems: "center" }}>
                            {m.total != null ? (
                              <div style={{ fontFamily: FONT.mono, fontSize: 13, color: SQ.green }}>+{m.total}</div>
                            ) : null}
                            <div style={{ fontFamily: FONT.display, fontSize: 16, width: 42, textAlign: "right" }}>
                              {m.rank != null ? `#${m.rank}` : "—"}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {isOwner ? <OwnerControls franchiseId={f.id} hasManager={f.manager != null} /> : null}

      {/* lineup editor for a chosen upcoming match (owner/manager) */}
      <LineupEditor
        open={lineupMatchId != null}
        matchId={lineupMatchId ?? ""}
        franchiseId={f.id}
        franchiseTag={f.tag}
        onClose={() => setLineupMatchId(null)}
      />

      {tagPlayer ? (
        <RosterTagsModal franchiseId={f.id} player={tagPlayer} onClose={() => setTagPlayer(null)} />
      ) : null}
    </div>
  );
}

// ---- franchise-private player designation tags (owner/manager) ----------------

function RosterTagsModal({
  franchiseId,
  player,
  onClose,
}: {
  franchiseId: string;
  player: RosterMember;
  onClose: () => void;
}) {
  const save = useSetRosterTags();
  const [tags, setTags] = useState<string[]>(player.tags ?? []);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const addDraft = () => {
    const v = draft.trim();
    if (!v) return;
    if (!tags.some((t) => t.toLowerCase() === v.toLowerCase())) {
      setTags((cur) => [...cur, v.length > 40 ? v.slice(0, 40) : v]);
    }
    setDraft("");
  };

  const submit = async () => {
    setErr(null);
    try {
      await save.mutateAsync({ id: franchiseId, playerId: player.playerId, tags });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't save the tags."));
    }
  };

  return (
    <Modal open title={`Tags · ${player.gamerTag}`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
        Private designations (e.g. &ldquo;Valorant 1&rdquo;, &ldquo;BGMI 2&rdquo;) only your franchise sees —
        a quick way to mark who plays what when setting lineups.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {tags.length === 0 ? (
          <span style={{ fontSize: 12.5, color: SQ.mute }}>No tags yet.</span>
        ) : (
          tags.map((t) => (
            <span
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontFamily: FONT.mono,
                fontSize: 11,
                color: SQ.ember,
                border: `1px solid rgba(232,96,44,.45)`,
                borderRadius: 999,
                padding: "5px 10px",
              }}
            >
              {t}
              <button
                type="button"
                onClick={() => setTags((cur) => cur.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                style={{ background: "transparent", border: "none", color: SQ.mute, cursor: "pointer", fontSize: 13, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="sq-field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="e.g. Valorant 1"
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
        <button type="button" onClick={addDraft} style={actionBtn("transparent", SQ.faint, true, false)}>
          Add
        </button>
      </div>
      {err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 10 }}>{err}</div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onClose} disabled={save.isPending} style={actionBtn("transparent", SQ.faint, true, save.isPending)}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={save.isPending} style={actionBtn(SQ.red, SQ.sidebar, false, save.isPending)}>
          {save.isPending ? "Saving…" : "Save tags"}
        </button>
      </div>
    </Modal>
  );
}

// ---- owner-only leadership controls ----------------------------------------

function OwnerControls({ franchiseId, hasManager }: { franchiseId: string; hasManager: boolean }) {
  const eligibleQ = useEligibleOwners(franchiseId);
  const pendingQ = useFranchisePendingInvites(franchiseId);
  // A truthy current season means we're mid-season; filled leadership slots are locked until it ends.
  const inSeason = Boolean(useCurrentSeason().data);

  const [modal, setModal] = useState<null | "MANAGER" | "OWNER">(null);

  const options = useMemo(
    () => (eligibleQ.data ?? []).map((p) => ({ value: p.playerId, label: p.gamerTag })),
    [eligibleQ.data],
  );

  // Assigning into an empty manager slot is allowed anytime; changing a filled one waits for the off-season.
  const managerLocked = inSeason && hasManager;
  // Ownership transfer swaps a filled slot by definition — always off-season only.
  const ownerLocked = inSeason;

  const pending = pendingQ.data ?? [];

  return (
    <div style={{ marginTop: 36, paddingTop: 28, borderTop: `1px solid ${SQ.hairline}` }}>
      <div style={sectionTitle}>Owner controls</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div>
          <button
            type="button"
            disabled={managerLocked}
            onClick={() => setModal("MANAGER")}
            style={actionBtn(SQ.red, SQ.sidebar, false, managerLocked)}
          >
            Invite a manager
          </button>
          {managerLocked ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, marginTop: 6, maxWidth: 220 }}>
              Manager can only be changed between seasons.
            </div>
          ) : null}
        </div>
        <div>
          <button
            type="button"
            disabled={ownerLocked}
            onClick={() => setModal("OWNER")}
            style={actionBtn("transparent", SQ.ember, true, ownerLocked)}
          >
            Transfer ownership
          </button>
          {ownerLocked ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, marginTop: 6, maxWidth: 220 }}>
              Ownership can only be transferred between seasons.
            </div>
          ) : null}
        </div>
      </div>

      {/* outstanding offers this franchise has sent */}
      <div style={{ marginTop: 22 }}>
        <div style={subLabel}>PENDING INVITES</div>
        {pendingQ.isLoading ? (
          <StateNote>Loading pending invites…</StateNote>
        ) : pending.length === 0 ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute }}>No outstanding invites.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 14px",
                  background: SQ.panel,
                  border: `1px solid ${SQ.hairline}`,
                  borderRadius: 7,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    letterSpacing: ".1em",
                    color: inv.role === "OWNER" ? SQ.red : SQ.amber,
                    border: `1px solid ${inv.role === "OWNER" ? SQ.red : SQ.amber}`,
                    borderRadius: 999,
                    padding: "3px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {inv.role}
                </span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>
                  {inv.invitedPlayerGamerTag ?? "—"}
                </span>
                <span
                  style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".1em", color: statusColor(inv.status) }}
                >
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteModal
        open={modal != null}
        role={(modal ?? "MANAGER") as FranchiseRole}
        franchiseId={franchiseId}
        options={options}
        optionsLoading={eligibleQ.isLoading}
        optionsError={eligibleQ.isError}
        onClose={() => setModal(null)}
      />
    </div>
  );
}

// ---- leadership invite modal (manager assignment / ownership transfer) ------

function InviteModal({
  open,
  role,
  franchiseId,
  options,
  optionsLoading,
  optionsError,
  onClose,
}: {
  open: boolean;
  role: FranchiseRole;
  franchiseId: string;
  options: { value: string; label: string }[];
  optionsLoading: boolean;
  optionsError?: boolean;
  onClose: () => void;
}) {
  const create = useCreateFranchiseInvite();
  const [playerId, setPlayerId] = useState("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Reset the form each time the modal opens (or the role switches).
  useEffect(() => {
    if (open) {
      setPlayerId("");
      setMessage("");
      setErr(null);
    }
  }, [open, role]);

  const title = role === "OWNER" ? "Transfer ownership" : "Invite a manager";

  const submit = async () => {
    setErr(null);
    if (!playerId) {
      setErr("Pick a verified player first.");
      return;
    }
    try {
      await create.mutateAsync({
        id: franchiseId,
        body: { playerId, role, message: message.trim() || undefined },
      });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't send the invite."));
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
        {role === "OWNER"
          ? "Offer full ownership of this franchise to a verified player. They must accept before the transfer takes effect."
          : "Offer the manager role to a verified player. They must accept before it takes effect."}
      </div>

      <div style={subLabel}>PLAYER</div>
      <SearchableSelect
        value={playerId}
        onChange={setPlayerId}
        options={options}
        placeholder={optionsLoading ? "Loading players…" : "Select a verified player…"}
        searchPlaceholder="Search players…"
        disabled={optionsLoading}
      />
      {optionsError ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.red, marginTop: 8 }}>
          Couldn&rsquo;t load eligible players. Try again.
        </div>
      ) : null}

      <div style={{ ...subLabel, marginTop: 16 }}>MESSAGE (OPTIONAL)</div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Add a short note to the invite…"
        rows={3}
        style={{
          width: "100%",
          background: SQ.inset,
          border: `1px solid ${SQ.inputBorder}`,
          borderRadius: 5,
          padding: "9px 12px",
          fontSize: 13.5,
          color: SQ.ink,
          fontFamily: FONT.sans,
          resize: "vertical",
        }}
      />

      {err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 12 }}>{err}</div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={onClose}
          disabled={create.isPending}
          style={actionBtn("transparent", SQ.faint, true, create.isPending)}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={create.isPending}
          style={actionBtn(SQ.red, SQ.sidebar, false, create.isPending)}
        >
          {create.isPending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </Modal>
  );
}

// ---- header ----------------------------------------------------------------

function Header() {
  return (
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
        Your franchise
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: "clamp(34px,5vw,56px)",
          lineHeight: 0.92,
          letterSpacing: "-.03em",
          marginTop: 10,
        }}
      >
        MY FRANCHISE
      </div>
      <div style={{ fontSize: 13.5, color: SQ.mute, marginTop: 12, lineHeight: 1.5, maxWidth: 560 }}>
        Respond to leadership offers, set your fielded lineups for upcoming matches, and — as owner — manage your
        franchise&rsquo;s manager and ownership.
      </div>
    </div>
  );
}

// ---- franchise branding (logo + banner) modal (owner/admin) ----------------

function BrandingModal({
  open,
  franchiseId,
  currentLogo,
  currentBanner,
  onClose,
}: {
  open: boolean;
  franchiseId: string;
  currentLogo?: string;
  currentBanner?: string;
  onClose: () => void;
}) {
  const upload = useUploadMedia();
  const save = useUpdateFranchiseBranding();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(currentLogo);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(currentBanner);
  const [err, setErr] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setLogoUrl(currentLogo);
      setBannerUrl(currentBanner);
      setErr(null);
    }
  }, [open, currentLogo, currentBanner]);

  const pick = async (file: File, kind: "logo" | "banner") => {
    setErr(null);
    setImgBusy(true);
    try {
      // Compress client-side to fit the per-kind cap instead of rejecting large files.
      const dataUrl = await compressImage(file, IMAGE_PRESETS[kind]);
      const res = await upload.mutateAsync({ data: dataUrl, kind });
      if (kind === "logo") setLogoUrl(res.url);
      else setBannerUrl(res.url);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't process that image."));
    } finally {
      setImgBusy(false);
    }
  };

  const submit = async () => {
    setErr(null);
    try {
      await save.mutateAsync({ id: franchiseId, body: { logoUrl: logoUrl ?? "", bannerUrl: bannerUrl ?? "" } });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't save the branding."));
    }
  };

  const bannerPreview = mediaSrc(bannerUrl);

  return (
    <Modal open={open} title="Franchise branding" onClose={save.isPending ? () => {} : onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 520 }}>
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar url={logoUrl} size={64} radius={10} />
          <div style={{ flex: 1 }}>
            <div style={subLabel}>LOGO · auto-compressed</div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={uploadBtn}>
                {imgBusy || upload.isPending ? "Processing…" : logoUrl ? "Change logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: "none" }}
                  disabled={imgBusy || upload.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pick(f, "logo");
                    e.target.value = "";
                  }}
                />
              </label>
              {logoUrl ? (
                <button type="button" onClick={() => setLogoUrl(undefined)} style={ghostBtn}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* banner */}
        <div>
          <div style={subLabel}>BANNER · auto-compressed</div>
          <div
            style={{
              height: 96,
              borderRadius: 8,
              border: `1px solid ${SQ.hairline}`,
              background: bannerPreview ? undefined : SQ.avatarGrad,
              backgroundImage: bannerPreview ? `url(${bannerPreview})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <label style={uploadBtn}>
              {imgBusy || upload.isPending ? "Processing…" : bannerUrl ? "Change banner" : "Upload banner"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: "none" }}
                disabled={imgBusy || upload.isPending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pick(f, "banner");
                  e.target.value = "";
                }}
              />
            </label>
            {bannerUrl ? (
              <button type="button" onClick={() => setBannerUrl(undefined)} style={ghostBtn}>
                Remove
              </button>
            ) : null}
          </div>
        </div>

        {err ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember }}>{err}</div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} disabled={save.isPending} style={actionBtn("transparent", SQ.faint, true, save.isPending)}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={save.isPending} style={actionBtn(SQ.red, SQ.sidebar, false, save.isPending)}>
            {save.isPending ? "Saving…" : "Save branding"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const uploadBtn = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".08em",
  padding: "8px 12px",
  borderRadius: 5,
  cursor: "pointer",
  color: SQ.ink,
  border: `1px solid ${SQ.inputBorder}`,
  background: "transparent",
  display: "inline-block",
} as const;

const ghostBtn = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".08em",
  padding: "8px 12px",
  borderRadius: 5,
  cursor: "pointer",
  color: SQ.mute,
  border: `1px solid ${SQ.inputBorder}`,
  background: "transparent",
} as const;

function actionBtn(bg: string, color: string, outline: boolean, disabled: boolean) {
  return {
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
    border: outline ? `1px solid ${SQ.inputBorder}` : "none",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap" as const,
  };
}
