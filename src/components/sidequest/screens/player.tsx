"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { Modal } from "../modal";
import { Avatar } from "../avatar";
import { ProfileEditor } from "./profile-editor";
import {
  usePlayer,
  usePlayerMatches,
  usePlayerUsernames,
  useCreateDispute,
  useMyDisputes,
} from "@/lib/query/hooks";
import { useAuth } from "@/lib/auth/context";
import { apiErrorMessage } from "@/lib/api/client";
import { shortDate } from "@/lib/adapters/league";
import type { DisputeCategory } from "@/lib/api/types";

const sectionLabel = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  marginBottom: 14,
} as const;

const tile = {
  padding: "18px 22px",
  borderRight: `1px solid ${SQ.hairlineCell}`,
  borderBottom: `1px solid ${SQ.hairlineCell}`,
} as const;
const tileLabel = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label } as const;
const tileValue = { fontFamily: FONT.display, fontSize: 30, letterSpacing: "-.02em", marginTop: 5 } as const;

// Discreet owner-only "report / appeal" affordances.
const ghostAction = {
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: "8px 12px",
  borderRadius: 5,
  cursor: "pointer",
  color: SQ.mute,
  background: "transparent",
  border: `1px solid ${SQ.inputBorder}`,
} as const;

const modalBtn = {
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: "9px 14px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

const modalLabel = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: SQ.label,
  marginBottom: 10,
} as const;

const disputeChip = {
  fontFamily: FONT.mono,
  fontSize: 9.5,
  letterSpacing: ".1em",
  padding: "4px 8px",
  borderRadius: 9,
} as const;

/** [text color, border color] for a dispute category chip. */
function categoryColors(c: DisputeCategory): [string, string] {
  switch (c) {
    case "APPEAL":
      return [SQ.blue, "rgba(59,111,212,.45)"];
    case "GENERAL":
      return [SQ.slate, SQ.inputBorder];
    default: // RESULT
      return [SQ.ember, "rgba(232,96,44,.45)"];
  }
}

function disputeStatusColor(s: string): string {
  const u = s.toUpperCase();
  if (u === "RESOLVED" || u === "APPROVED" || u === "ACCEPTED") return SQ.green;
  if (u === "DISMISSED" || u === "REJECTED") return SQ.ember;
  return SQ.amber; // OPEN / pending
}

function segBtn(selected: boolean) {
  return {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    padding: "7px 12px",
    borderRadius: 5,
    cursor: "pointer",
    color: selected ? SQ.ember : SQ.mute,
    background: "transparent",
    border: `1px solid ${selected ? "rgba(232,96,44,.45)" : SQ.inputBorder}`,
  };
}

export function PlayerScreen({ id, base = "" }: { id?: string; base?: string }) {
  // Own-profile detection: only the signed-in owner sees the discreet report/appeal tools. When no id is
  // supplied (the /player route), a signed-in user sees their own profile.
  const { playerId, isAdmin } = useAuth();
  const effectiveId = id ?? playerId ?? undefined;

  const pq = usePlayer(effectiveId);
  const matchesQ = usePlayerMatches(effectiveId);
  const usernamesQ = usePlayerUsernames(effectiveId);
  const p = pq.data;

  const isOwner = !!effectiveId && !!playerId && playerId === effectiveId;
  const canEdit = !!p && (isOwner || isAdmin);
  const [editing, setEditing] = useState(false);
  const myDisputesQ = useMyDisputes(isOwner);
  const createDispute = useCreateDispute();

  const statusUpper = (p?.status ?? "").toUpperCase();
  const canAppeal = isOwner && (statusUpper === "FLAGGED" || statusUpper === "SUSPENDED");

  const [modalOpen, setModalOpen] = useState(false);
  const [appealMode, setAppealMode] = useState(false);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<DisputeCategory>("GENERAL");
  const [err, setErr] = useState<string | null>(null);

  const openReport = () => {
    setAppealMode(false);
    setCategory("GENERAL");
    setReason("");
    setErr(null);
    setModalOpen(true);
  };
  const openAppeal = () => {
    setAppealMode(true);
    setCategory("APPEAL");
    setReason("");
    setErr(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (createDispute.isPending) return;
    setModalOpen(false);
    setReason("");
    setErr(null);
  };
  const submitDispute = async () => {
    const r = reason.trim();
    if (!r) {
      setErr("Please describe the issue.");
      return;
    }
    try {
      // matchId omitted → a match-less appeal / general report (backend stores null).
      await createDispute.mutateAsync({ reason: r, category });
      setModalOpen(false);
      setReason("");
      setErr(null);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't submit. Please try again."));
    }
  };

  return (
    <div>
      <Link
        href={`${base}/players`}
        style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, textDecoration: "none" }}
      >
        ◂ PLAYERS
      </Link>

      {!effectiveId ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Select a player from the directory.</StateNote>
        </div>
      ) : pq.isLoading ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Loading player…</StateNote>
        </div>
      ) : !p ? (
        <div style={{ marginTop: 20 }}>
          <StateNote tone="error">Couldn't load this player.</StateNote>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 22,
              alignItems: "center",
              marginTop: 16,
              paddingBottom: 26,
              borderBottom: `1px solid ${SQ.hairline}`,
            }}
          >
            <Avatar url={p.avatarUrl} alt={p.gamerTag} size={96} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".16em", color: SQ.red }}>
                {p.franchise ? `${p.franchise.tag} · ` : ""}
                {p.status}
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: "clamp(38px,5.5vw,60px)",
                  lineHeight: 0.92,
                  letterSpacing: "-.03em",
                  marginTop: 8,
                }}
              >
                {p.gamerTag}
              </div>
              <div
                style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute, marginTop: 10 }}
              >
                {p.user?.name ?? p.gamerTag}
                {p.region ? ` · ${p.region}` : ""}
              </div>
              {p.realName || p.phone || p.contactEmail ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    fontSize: 12.5,
                    color: SQ.faint,
                  }}
                >
                  {p.realName ? <span>{p.realName}</span> : null}
                  {p.phone ? <span>☎ {p.phone}</span> : null}
                  {p.contactEmail ? <span>✉ {p.contactEmail}</span> : null}
                </div>
              ) : null}
              {p.bio ? (
                <div style={{ fontSize: 13.5, color: SQ.faint, marginTop: 10, lineHeight: 1.6, maxWidth: 560 }}>
                  {p.bio}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: SQ.league,
                    background: SQ.red,
                    border: "none",
                    padding: "11px 16px",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  Edit profile
                </button>
              ) : null}
              {p.franchise ? (
                <Link
                  href={`${base}/franchise/${p.franchise.id}`}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: SQ.ink,
                    border: `1px solid ${SQ.inputBorder}`,
                    padding: "11px 16px",
                    borderRadius: 5,
                    textDecoration: "none",
                  }}
                >
                  View franchise ▸
                </Link>
              ) : null}
            </div>
          </div>

          {editing && p ? <ProfileEditor player={p} onClose={() => setEditing(false)} /> : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 8,
              overflow: "hidden",
              marginTop: 26,
            }}
          >
            <div style={tile}>
              <div style={tileLabel}>POINTS</div>
              <div style={tileValue}>{p.points}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>MATCHES</div>
              <div style={tileValue}>{(matchesQ.data ?? []).length}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>GAMES</div>
              <div style={tileValue}>{p.proficiencies.length}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>STATUS</div>
              <div style={{ ...tileValue, fontSize: 22, marginTop: 9 }}>{p.status}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
              gap: 28,
              marginTop: 30,
            }}
          >
            {/* usernames + proficiencies */}
            <div>
              <div style={sectionLabel}>Games</div>
              {(() => {
                // One row per game: join the visibility-filtered handles (/usernames) with the
                // proficiency stats (from the profile DTO) by gameId — the same union the editor does,
                // so a game shows its handle + PUBLIC/PRIVATE chip AND its rating/rank/K-D/level in one
                // consistent element (previously two disjoint blocks that dropped rank/K-D/level).
                const handleByGame = new Map((usernamesQ.data ?? []).map((u) => [u.gameId, u]));
                const nameByGame = new Map<string, string>();
                p.proficiencies.forEach((pr) => nameByGame.set(pr.gameId, pr.gameName));
                (usernamesQ.data ?? []).forEach((u) => nameByGame.set(u.gameId, u.gameName));
                const ids = [
                  ...new Set<string>([
                    ...p.proficiencies.map((pr) => pr.gameId),
                    ...(usernamesQ.data ?? []).map((u) => u.gameId),
                  ]),
                ];
                if (ids.length === 0) return <StateNote>No games listed.</StateNote>;
                return ids.map((gameId) => {
                  const prof = p.proficiencies.find((pr) => pr.gameId === gameId);
                  const handle = handleByGame.get(gameId);
                  const gameName = nameByGame.get(gameId) ?? gameId;
                  const stats: { label: string; value: string }[] = [];
                  if (prof) {
                    stats.push({ label: "RATING", value: String(prof.rating) });
                    if (prof.rankTier) stats.push({ label: "RANK", value: prof.rankTier });
                    if (prof.kd != null) stats.push({ label: "K/D", value: String(prof.kd) });
                    if (prof.accountLevel != null) stats.push({ label: "LVL", value: String(prof.accountLevel) });
                  }
                  return (
                    <div
                      key={gameId}
                      style={{ padding: "13px 0", borderTop: `1px solid ${SQ.hairlineCell}` }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {handle?.handle ? handle.handle : <span style={{ color: SQ.mute }}>—</span>}
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
                            {gameName}
                          </div>
                        </div>
                        {handle ? (
                          <div
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 10,
                              letterSpacing: ".1em",
                              color: handle.isPublic ? SQ.green : SQ.mute,
                              border: `1px solid ${handle.isPublic ? "rgba(31,157,99,.45)" : SQ.inputBorder}`,
                              padding: "5px 9px",
                              borderRadius: 4,
                              flex: "0 0 auto",
                            }}
                          >
                            {handle.isPublic ? "PUBLIC" : "PRIVATE"}
                          </div>
                        ) : null}
                      </div>
                      {stats.length > 0 ? (
                        <div
                          style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 9 }}
                        >
                          {stats.map((s) => (
                            <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span
                                style={{
                                  fontFamily: FONT.mono,
                                  fontSize: 10,
                                  letterSpacing: ".1em",
                                  color: SQ.label,
                                }}
                              >
                                {s.label}
                              </span>
                              <span style={{ fontFamily: FONT.display, fontSize: 16 }}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>

            {/* past matches */}
            <div>
              <div style={sectionLabel}>Match History</div>
              {matchesQ.isLoading ? (
                <StateNote>Loading matches…</StateNote>
              ) : (matchesQ.data ?? []).length === 0 ? (
                <StateNote>No matches yet.</StateNote>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 340 }}>
                    {(matchesQ.data ?? []).map((m) => (
                      <Link
                        key={m.matchId}
                        href={`${base}/match/${m.matchId}`}
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
                        <div style={{ fontFamily: FONT.display, fontSize: 18 }}>
                          {m.franchiseRank != null ? `#${m.franchiseRank}` : "—"}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isOwner ? (
            <div style={{ marginTop: 34, paddingTop: 26, borderTop: `1px solid ${SQ.hairline}` }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div style={{ ...sectionLabel, marginBottom: 0 }}>My disputes &amp; appeals</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={openReport} style={ghostAction}>
                    Report an issue
                  </button>
                  {canAppeal ? (
                    <button
                      type="button"
                      onClick={openAppeal}
                      style={{ ...ghostAction, color: SQ.ember, border: "1px solid rgba(232,96,44,.45)" }}
                    >
                      Appeal account status
                    </button>
                  ) : null}
                </div>
              </div>
              {myDisputesQ.isLoading ? (
                <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute }}>Loading…</div>
              ) : (myDisputesQ.data ?? []).length === 0 ? (
                <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute }}>
                  You haven&rsquo;t raised anything yet.
                </div>
              ) : (
                <div>
                  {(myDisputesQ.data ?? []).map((d) => {
                    const [catColor, catBorder] = categoryColors(d.category);
                    return (
                      <div
                        key={d.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                          padding: "12px 0",
                          borderTop: `1px solid ${SQ.hairlineCell}`,
                        }}
                      >
                        <span style={{ ...disputeChip, color: catColor, border: `1px solid ${catBorder}` }}>
                          {d.category}
                        </span>
                        <span
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10,
                            letterSpacing: ".1em",
                            color: disputeStatusColor(d.status),
                          }}
                        >
                          {d.status}
                        </span>
                        <span
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10.5,
                            color: SQ.mute,
                            marginLeft: "auto",
                          }}
                        >
                          {shortDate(d.createdAt)}
                        </span>
                        {d.reason ? (
                          <div style={{ flexBasis: "100%", fontSize: 12.5, color: SQ.faint, lineHeight: 1.5 }}>
                            {d.reason}
                          </div>
                        ) : null}
                        {d.resolution ? (
                          <div style={{ flexBasis: "100%", fontSize: 12, color: SQ.mute, marginTop: 2 }}>
                            Resolution: {d.resolution}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <Modal
            open={modalOpen}
            title={appealMode ? "Appeal account status" : "Report an issue"}
            onClose={closeModal}
          >
            {appealMode ? (
              <div style={{ fontSize: 13, color: SQ.faint, marginBottom: 14, lineHeight: 1.6 }}>
                Tell the organisers why your <strong>{p?.status}</strong> status should be reviewed. They&rsquo;ll
                follow up on your account.
              </div>
            ) : (
              <>
                <div style={modalLabel}>Category</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(["GENERAL", "APPEAL"] as DisputeCategory[]).map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(c)} style={segBtn(category === c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={modalLabel}>{appealMode ? "Your appeal" : "What's going on?"}</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder={appealMode ? "Explain your case…" : "Describe the issue…"}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: SQ.inset,
                border: `1px solid ${SQ.inputBorder}`,
                borderRadius: 5,
                padding: "11px 12px",
                fontSize: 13.5,
                lineHeight: 1.5,
                color: SQ.ink,
                fontFamily: FONT.sans,
                resize: "vertical",
              }}
            />
            {err ? (
              <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 10 }}>{err}</div>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                disabled={createDispute.isPending || !reason.trim()}
                onClick={submitDispute}
                style={{
                  ...modalBtn,
                  color: SQ.league,
                  background: SQ.red,
                  border: "none",
                  opacity: createDispute.isPending || !reason.trim() ? 0.6 : 1,
                }}
              >
                {createDispute.isPending ? "Submitting…" : appealMode ? "Submit appeal" : "Submit report"}
              </button>
              <button
                type="button"
                disabled={createDispute.isPending}
                onClick={closeModal}
                style={{
                  ...modalBtn,
                  color: SQ.faint,
                  background: "transparent",
                  border: `1px solid ${SQ.inputBorder}`,
                  opacity: createDispute.isPending ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
