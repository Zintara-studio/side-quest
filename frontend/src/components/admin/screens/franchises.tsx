"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import { SearchableSelect } from "@/components/sidequest/searchable-select";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import {
  useFranchises,
  useFranchise,
  useCreateFranchise,
  useDiscardFranchise,
  useRestoreFranchise,
  useSetFranchiseOwner,
  useSetFranchiseManager,
  useRegistrations,
  useEligibleOwners,
  useCreateFranchiseFromProposal,
  useRejectRegistration,
} from "@/lib/query/hooks";
import type { RegistrationView } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/client";
import { shortDate } from "@/lib/adapters/league";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const formInput = {
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "9px 12px",
  fontSize: 13.5,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

const smallBtn = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  padding: "7px 11px",
  borderRadius: 5,
  cursor: "pointer",
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

const cardBtn = {
  flex: 1,
  textAlign: "center",
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: 10,
  borderRadius: 5,
  cursor: "pointer",
} as const;

export function FranchisesScreen() {
  const { data, isLoading, isError } = useFranchises({});
  const franchises = data?.items ?? [];
  const create = useCreateFranchise();

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);

  const submitCreate = async () => {
    setErr(null);
    if (!name.trim() || !tag.trim()) {
      setErr("Enter a name and a tag.");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), tag: tag.trim().toUpperCase() });
      setName("");
      setTag("");
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't create the franchise."));
    }
  };

  return (
    <div>
      <ScreenHeader eyebrow="Teams & rosters" title="FRANCHISES" />

      {/* create a franchise directly */}
      <div
        style={{
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 9,
          padding: 18,
          margin: "18px 0 24px",
        }}
      >
        <div style={{ ...headCell, marginBottom: 10 }}>CREATE A FRANCHISE</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Franchise name" style={{ ...formInput, flex: 1, minWidth: 200 }} />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="TAG" style={{ ...formInput, width: 120 }} />
          <button
            type="button"
            onClick={submitCreate}
            disabled={create.isPending}
            style={{
              ...smallBtn,
              fontSize: 11,
              fontWeight: 700,
              color: SQ.sidebar,
              background: SQ.red,
              border: "none",
              padding: "11px 18px",
            }}
          >
            {create.isPending ? "Creating…" : "Create ▸"}
          </button>
        </div>
        {err ? <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember, marginTop: 8 }}>{err}</div> : null}
      </div>

      {/* pending FRANCHISE proposals — keep (create franchise) / discard (reject) */}
      <ProposalsPanel />

      {isLoading ? (
        <StateNote>Loading franchises…</StateNote>
      ) : franchises.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load franchises (admin sign-in required)." : "No franchises yet."}
        </StateNote>
      ) : (
        <TableScroll minWidth={760}>
          <div style={{ display: "flex", padding: "14px 18px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
            <div style={{ width: 44 }}>#</div>
            <div style={{ flex: 1 }}>FRANCHISE</div>
            <div style={{ width: 100 }}>STATUS</div>
            <div style={{ width: 80, textAlign: "center" }}>PLAYERS</div>
            <div style={{ width: 70, textAlign: "right" }}>PTS</div>
            <div style={{ width: 170, textAlign: "right" }}>MANAGE</div>
          </div>

          {franchises.map((f) => (
            <div key={f.id} style={{ borderBottom: `1px solid ${SQ.hairlineSoft}` }}>
              <div style={{ display: "flex", alignItems: "center", padding: "14px 18px" }}>
                <div style={{ width: 44, fontFamily: FONT.display, fontSize: 16, color: f.rank === 1 ? SQ.red : SQ.steel }}>
                  {String(f.rank).padStart(2, "0")}
                </div>
                <Link href={`/admin/franchise/${f.id}`} style={{ flex: 1, fontWeight: 700, fontSize: 14.5, textDecoration: "none", color: SQ.ink }}>
                  {f.name}
                  {f.tag ? <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, fontWeight: 400, marginLeft: 6 }}>{f.tag}</span> : null}
                </Link>
                <div style={{ width: 100 }}>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: ".1em",
                      color: f.active ? SQ.green : SQ.mute,
                      border: `1px solid ${f.active ? "rgba(31,157,99,.45)" : SQ.inputBorder}`,
                      padding: "4px 9px",
                      borderRadius: 9,
                    }}
                  >
                    {f.active ? "ACTIVE" : "DISCARDED"}
                  </span>
                </div>
                <div style={{ width: 80, textAlign: "center", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>{f.rosterSize}</div>
                <div style={{ width: 70, textAlign: "right", fontFamily: FONT.display, fontSize: 16 }}>{f.points}</div>
                <div style={{ width: 170, textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => setManaging(managing === f.id ? null : f.id)}
                    style={{ ...smallBtn, color: managing === f.id ? SQ.sidebar : SQ.faint, background: managing === f.id ? SQ.red : "transparent", border: `1px solid ${managing === f.id ? SQ.red : SQ.inputBorder}` }}
                  >
                    {managing === f.id ? "Close" : "Manage"}
                  </button>
                </div>
              </div>
              {managing === f.id ? <ManagePanel franchiseId={f.id} /> : null}
            </div>
          ))}
        </TableScroll>
      )}
    </div>
  );
}

/** Pending FRANCHISE-type registrations, each promotable into a real franchise or discardable. */
function ProposalsPanel() {
  const { data, isLoading } = useRegistrations({ status: "PENDING", type: "FRANCHISE", limit: 50 });
  const items = data?.items ?? [];

  // Nothing to show once the queue is empty — keep the screen quiet.
  if (!isLoading && items.length === 0) return null;

  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 9,
        padding: 18,
        margin: "0 0 24px",
      }}
    >
      <div style={{ ...headCell, marginBottom: 4 }}>FRANCHISE PROPOSALS · {items.length} PENDING</div>
      <div style={{ fontSize: 11.5, color: SQ.mute, marginBottom: 14 }}>
        Keep a proposal to create the franchise (the applicant becomes its owner), or discard it to reject the registration.
      </div>
      {isLoading ? (
        <StateNote>Loading proposals…</StateNote>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
          {items.map((r) => (
            <ProposalCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({ r }: { r: RegistrationView }) {
  const keep = useCreateFranchiseFromProposal();
  const discard = useRejectRegistration();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const busy = keep.isPending || discard.isPending;

  const onKeep = async () => {
    setMsg(null);
    try {
      const fr = await keep.mutateAsync(r.id);
      setMsg({ tone: "ok", text: `Created “${fr.name}”. ${r.player?.gamerTag ?? "The applicant"} is now owner.` });
    } catch (e) {
      setMsg({ tone: "err", text: apiErrorMessage(e, "Couldn't create the franchise from this proposal.") });
    }
  };

  const doDiscard = async () => {
    setMsg(null);
    try {
      await discard.mutateAsync({ id: r.id, reason: "Franchise proposal discarded." });
    } catch (e) {
      setMsg({ tone: "err", text: apiErrorMessage(e, "Couldn't discard this proposal.") });
    } finally {
      setConfirmDiscard(false);
    }
  };

  const title = r.squadName?.trim() || "Franchise proposal";
  const meta = [r.contact, shortDate(r.createdAt)].filter(Boolean).join(" · ");

  return (
    <div style={{ background: SQ.inset, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {title}
            {r.franchiseTag ? (
              <span style={{ color: SQ.mute, fontWeight: 400, fontFamily: FONT.mono, fontSize: 12 }}>
                {" "}· {r.franchiseTag}
              </span>
            ) : null}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".08em", color: SQ.mute, marginTop: 3 }}>
            PROPOSED BY {(r.player?.gamerTag ?? "—").toUpperCase()}
            {r.franchiseTag ? " · TAG REQUESTED" : ""}
          </div>
        </div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: ".1em",
            color: SQ.amber,
            border: "1px solid rgba(181,131,26,.5)",
            padding: "4px 8px",
            borderRadius: 9,
            flex: "0 0 auto",
          }}
        >
          {r.status}
        </span>
      </div>

      {(r.games ?? []).length > 0 ? (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "13px 0" }}>
          {r.games.map((g) => (
            <span key={g} style={chip}>
              {g}
            </span>
          ))}
        </div>
      ) : null}

      {r.reason?.trim() ? (
        <div style={{ margin: "0 0 13px" }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: SQ.label, marginBottom: 6 }}>NOTE</div>
          <div style={{ fontSize: 13, color: SQ.faint, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.reason}</div>
        </div>
      ) : null}

      {meta ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".06em", color: SQ.mute, marginBottom: 13 }}>{meta}</div>
      ) : null}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          disabled={busy}
          onClick={onKeep}
          style={{ ...cardBtn, color: SQ.sidebar, background: SQ.green, border: "none", opacity: busy ? 0.6 : 1 }}
        >
          {keep.isPending ? "Creating…" : "Keep ▸"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmDiscard(true)}
          style={{ ...cardBtn, color: SQ.ember, background: "transparent", border: "1px solid rgba(232,96,44,.45)", opacity: busy ? 0.6 : 1 }}
        >
          {discard.isPending ? "Discarding…" : "Discard"}
        </button>
      </div>

      {msg ? (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11.5,
            lineHeight: 1.5,
            marginTop: 10,
            color: msg.tone === "ok" ? SQ.green : SQ.ember,
          }}
        >
          {msg.text}
        </div>
      ) : null}

      <ConfirmModal
        open={confirmDiscard}
        title="Discard proposal"
        tone="destructive"
        message={`Discard the franchise proposal “${title}”? The registration will be rejected and the applicant notified.`}
        confirmLabel="Discard proposal"
        busy={discard.isPending}
        onConfirm={doDiscard}
        onClose={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

function ManagePanel({ franchiseId }: { franchiseId: string }) {
  const detailQ = useFranchise(franchiseId);
  const eligibleQ = useEligibleOwners(franchiseId);
  const setOwner = useSetFranchiseOwner();
  const setManager = useSetFranchiseManager();
  const discard = useDiscardFranchise();
  const restore = useRestoreFranchise();
  const [lifecycleMsg, setLifecycleMsg] = useState<string | null>(null);
  const [confirmDiscardFr, setConfirmDiscardFr] = useState(false);
  const d = detailQ.data;

  const doDiscardFranchise = async () => {
    setLifecycleMsg(null);
    try {
      await discard.mutateAsync(franchiseId);
    } catch (e) {
      setLifecycleMsg(apiErrorMessage(e, "Couldn't discard this franchise."));
    } finally {
      setConfirmDiscardFr(false);
    }
  };
  const eligible = eligibleQ.data ?? [];

  const [ownerMsg, setOwnerMsg] = useState<string | null>(null);
  const [managerMsg, setManagerMsg] = useState<string | null>(null);

  const rowLabel = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label } as const;

  const baseOptions = eligible.map((p) => ({ value: p.playerId, label: p.gamerTag }));
  // Keep the currently-seated person selectable even if the eligible list is still loading.
  const withCurrent = (person: { playerId: string; gamerTag: string } | null | undefined) =>
    person && !baseOptions.some((o) => o.value === person.playerId)
      ? [{ value: person.playerId, label: person.gamerTag }, ...baseOptions]
      : baseOptions;

  const ownerOptions = withCurrent(d?.owner);
  const managerOptions = withCurrent(d?.manager);

  const changeOwner = async (playerId: string) => {
    if (!playerId || playerId === d?.owner?.playerId) return;
    setOwnerMsg(null);
    try {
      await setOwner.mutateAsync({ id: franchiseId, playerId });
    } catch (e) {
      setOwnerMsg(apiErrorMessage(e, "Couldn't set the owner."));
    }
  };

  const changeManager = async (playerId: string) => {
    if (!playerId || playerId === d?.manager?.playerId) return;
    setManagerMsg(null);
    try {
      await setManager.mutateAsync({ id: franchiseId, playerId });
    } catch (e) {
      setManagerMsg(apiErrorMessage(e, "Couldn't set the manager."));
    }
  };

  const noEligible = !eligibleQ.isLoading && ownerOptions.length === 0;

  return (
    <div style={{ padding: "0 18px 18px 62px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
        <div style={{ width: 240 }}>
          <div style={{ ...rowLabel, marginBottom: 6 }}>OWNER</div>
          <SearchableSelect
            value={d?.owner?.playerId ?? ""}
            onChange={changeOwner}
            options={ownerOptions}
            placeholder={eligibleQ.isLoading ? "Loading…" : "Set owner…"}
            searchPlaceholder="Search players…"
            disabled={setOwner.isPending || ownerOptions.length === 0}
          />
          {ownerMsg ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.5, color: SQ.ember, marginTop: 6 }}>{ownerMsg}</div>
          ) : null}
        </div>

        <div style={{ width: 240 }}>
          <div style={{ ...rowLabel, marginBottom: 6 }}>MANAGER</div>
          <SearchableSelect
            value={d?.manager?.playerId ?? ""}
            onChange={changeManager}
            options={managerOptions}
            placeholder={eligibleQ.isLoading ? "Loading…" : "Set manager…"}
            searchPlaceholder="Search players…"
            disabled={setManager.isPending || managerOptions.length === 0}
          />
          {managerMsg ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.5, color: SQ.ember, marginTop: 6 }}>{managerMsg}</div>
          ) : null}
        </div>

        <div style={{ alignSelf: "flex-start" }}>
          <div style={{ ...rowLabel, marginBottom: 6, visibility: "hidden" }}>—</div>
          {d?.active !== false ? (
            <button
              type="button"
              disabled={discard.isPending}
              onClick={() => setConfirmDiscardFr(true)}
              style={{ ...smallBtn, color: SQ.ember, background: "transparent", border: "1px solid rgba(232,96,44,.45)" }}
            >
              {discard.isPending ? "Discarding…" : "Discard franchise"}
            </button>
          ) : (
            <button
              type="button"
              disabled={restore.isPending}
              onClick={async () => {
                setLifecycleMsg(null);
                try {
                  await restore.mutateAsync(franchiseId);
                } catch (e) {
                  setLifecycleMsg(apiErrorMessage(e, "Couldn't restore this franchise."));
                }
              }}
              style={{ ...smallBtn, color: SQ.green, background: "transparent", border: "1px solid rgba(74,158,106,.5)" }}
            >
              {restore.isPending ? "Restoring…" : "Restore franchise"}
            </button>
          )}
          {lifecycleMsg ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.5, color: SQ.ember, marginTop: 6, maxWidth: 220 }}>{lifecycleMsg}</div>
          ) : null}
        </div>
      </div>

      {noEligible ? (
        <div style={{ fontSize: 12, color: SQ.mute, marginTop: 12 }}>
          No eligible players to assign — only verified players who are unassigned or already on this franchise can be an owner or manager.
        </div>
      ) : null}

      <ConfirmModal
        open={confirmDiscardFr}
        title="Discard franchise"
        tone="destructive"
        message={`Discard ${d?.name ?? "this franchise"}? It stops competing (history is kept) and its owner, manager and roster are released as free agents. Only allowed between seasons.`}
        confirmLabel="Discard franchise"
        busy={discard.isPending}
        onConfirm={doDiscardFranchise}
        onClose={() => setConfirmDiscardFr(false)}
      />
    </div>
  );
}
