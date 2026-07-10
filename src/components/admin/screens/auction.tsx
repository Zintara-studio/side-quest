"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import { Modal } from "@/components/sidequest/modal";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import { SearchableSelect } from "@/components/sidequest/searchable-select";
import { apiErrorMessage } from "@/lib/api/client";
import {
  useActiveAuction,
  useAuction,
  useCancelAuction,
  useCreateAuction,
  useUpdateAuction,
  useLockPool,
  useOpenHall,
  useRescheduleAuction,
  useStartAuction,
  usePauseAuction,
  useResumeAuction,
  useFinalizeLot,
  useUnsoldLot,
  useCompleteAuction,
  useNominateLot,
  useReauctionLot,
  useAssignLot,
  useAddAuctionFunds,
  useFranchises,
} from "@/lib/query/hooks";
import type {
  AuctionView,
  AuctionLotView,
  AuctionLotStatus,
  UpdateAuctionRequest,
} from "@/lib/api/types";

/* ---------- shared styles ---------- */

const fieldLabel: CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.label,
  display: "block",
  marginBottom: 6,
};

const formInput: CSSProperties = {
  width: "100%",
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "9px 12px",
  fontSize: 13.5,
  color: SQ.ink,
  fontFamily: FONT.sans,
};

const btnBase: CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  borderRadius: 5,
  padding: "10px 15px",
  cursor: "pointer",
};
const primaryBtn: CSSProperties = { ...btnBase, color: SQ.sidebar, background: SQ.red, border: "none" };
const ghostBtn: CSSProperties = {
  ...btnBase,
  color: SQ.faint,
  background: "transparent",
  border: `1px solid ${SQ.inputBorder}`,
};

const headCell: CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
};

const card: CSSProperties = {
  background: SQ.panel,
  border: `1px solid ${SQ.hairline}`,
  borderRadius: 9,
  padding: 20,
};

const sectionTitle: CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: SQ.dim,
  margin: "26px 0 12px",
};

/* ---------- helpers ---------- */

const coin = (n: number) => `₡${Number(n ?? 0).toLocaleString()}`;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (!Number.isFinite(s)) return "";
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Format an ISO instant for display (medium date + short time), "" when unset/invalid. */
function fmtSchedule(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Convert an ISO instant to a `datetime-local` input value (local wall-clock, minute precision). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** Highest-rated expertise line for a lot (for a compact "Valorant 78" summary), or null. */
function topExpertise(lot: AuctionLotView): { game: string; rating: number } | null {
  if (!lot.expertise || lot.expertise.length === 0) return null;
  return [...lot.expertise].sort((a, b) => b.rating - a.rating)[0];
}

function lotStatusLabel(s: AuctionLotStatus): string {
  switch (s) {
    case "ON_BLOCK":
      return "On block";
    case "SOLD":
      return "Sold";
    case "UNSOLD":
      return "Unsold";
    default:
      return "Queued";
  }
}

/** [text color, border color] for a lot status chip. */
function lotStatusColors(s: AuctionLotStatus): [string, string] {
  switch (s) {
    case "ON_BLOCK":
      return [SQ.ember, "rgba(232,96,44,.45)"];
    case "SOLD":
      return [SQ.green, "rgba(31,157,99,.45)"];
    case "UNSOLD":
      return [SQ.mute, SQ.inputBorder];
    default: // QUEUED
      return [SQ.blue, "rgba(59,111,212,.45)"];
  }
}

function StatusChip({ status }: { status: AuctionLotStatus }) {
  const [c, b] = lotStatusColors(status);
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 9.5,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: c,
        border: `1px solid ${b}`,
        padding: "3px 8px",
        borderRadius: 9,
        whiteSpace: "nowrap",
      }}
    >
      {lotStatusLabel(status)}
    </span>
  );
}

/* ===================================================================== */
/* SCREEN ROOT                                                            */
/* ===================================================================== */

export function AuctionScreen() {
  const activeQ = useActiveAuction();
  // Persist the current auction id from the active poll. It survives completion
  // (active -> null) so the just-finished results stay on screen until the admin
  // explicitly starts a new one via onReset.
  const [boardId, setBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (activeQ.data) setBoardId(activeQ.data.id);
  }, [activeQ.data]);

  return (
    <div>
      <ScreenHeader eyebrow="Player auction" title="AUCTION" />

      <div style={{ marginTop: 24 }}>
        {boardId ? (
          <AuctionBoard id={boardId} onReset={() => setBoardId(null)} />
        ) : activeQ.isLoading ? (
          <StateNote>Loading auction…</StateNote>
        ) : activeQ.isError ? (
          <StateNote tone="error">Couldn&apos;t load the auction (admin sign-in required).</StateNote>
        ) : (
          <CreateAuctionForm onCreated={(id) => setBoardId(id)} />
        )}
      </div>
    </div>
  );
}

/* ===================================================================== */
/* CREATE (no auction yet)                                                */
/* ===================================================================== */

const RAISE_DEFAULT = "10,50,100,200,500";

function parseIncrements(text: string): number[] {
  return text
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function CreateAuctionForm({ onCreated }: { onCreated: (id: string) => void }) {
  const franchisesQ = useFranchises({ active: true, limit: 100 });
  const create = useCreateAuction();
  const franchises = franchisesQ.data?.items ?? [];

  const [title, setTitle] = useState("");
  const [basePrice, setBasePrice] = useState("100");
  const [bidTimer, setBidTimer] = useState("30");
  const [antiSnipe, setAntiSnipe] = useState("10");
  const [raise, setRaise] = useState(RAISE_DEFAULT);
  const [defaultBudget, setDefaultBudget] = useState("1000");
  const [scheduledAt, setScheduledAt] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) => setPicked((p) => ({ ...p, [id]: !p[id] }));
  const participantIds = Object.keys(picked).filter((k) => picked[k]);

  const submit = async () => {
    setErr(null);
    const increments = parseIncrements(raise);
    if (!title.trim()) return setErr("Give the auction a title.");
    if (!(Number(basePrice) > 0)) return setErr("Base price must be greater than zero.");
    if (!(Number(bidTimer) > 0)) return setErr("Bid timer must be greater than zero.");
    if (increments.length === 0) return setErr("Add at least one raise increment (comma-separated).");
    if (participantIds.length === 0) return setErr("Pick at least one participating franchise.");
    try {
      const view = await create.mutateAsync({
        title: title.trim(),
        basePrice: Number(basePrice),
        bidTimerSeconds: Number(bidTimer),
        antiSnipeSeconds: Number(antiSnipe) || 0,
        raiseIncrements: increments,
        defaultBudget: Number(defaultBudget) || 0,
        participantFranchiseIds: participantIds,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      });
      onCreated(view.id);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't create the auction (admin sign-in required)."));
    }
  };

  return (
    <div style={card}>
      <div style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: "-.02em", marginBottom: 6 }}>
        Configure a new auction
      </div>
      <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 18 }}>
        The lot pool is auto-pulled from the current AUCTION-registration entrants — no need to pick
        players here.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <label style={{ gridColumn: "1 / -1" }}>
          <span style={fieldLabel}>TITLE</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Season 4 Player Auction"
            style={formInput}
          />
        </label>
        <label>
          <span style={fieldLabel}>BASE PRICE</span>
          <input type="number" min={1} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} style={formInput} />
        </label>
        <label>
          <span style={fieldLabel}>DEFAULT BUDGET</span>
          <input
            type="number"
            min={0}
            value={defaultBudget}
            onChange={(e) => setDefaultBudget(e.target.value)}
            style={formInput}
          />
        </label>
        <label>
          <span style={fieldLabel}>BID TIMER (SEC)</span>
          <input type="number" min={1} value={bidTimer} onChange={(e) => setBidTimer(e.target.value)} style={formInput} />
        </label>
        <label>
          <span style={fieldLabel}>ANTI-SNIPE (SEC)</span>
          <input type="number" min={0} value={antiSnipe} onChange={(e) => setAntiSnipe(e.target.value)} style={formInput} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          <span style={fieldLabel}>SCHEDULED TIME (OPTIONAL)</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            style={formInput}
          />
          <span style={{ ...fieldLabel, marginTop: 6, marginBottom: 0, color: SQ.mute, letterSpacing: ".04em" }}>
            When the hall is expected to open — {scheduledAt ? fmtSchedule(new Date(scheduledAt).toISOString()) : "leave blank for an ad-hoc auction"}
          </span>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          <span style={fieldLabel}>RAISE INCREMENTS</span>
          <input value={raise} onChange={(e) => setRaise(e.target.value)} placeholder={RAISE_DEFAULT} style={formInput} />
          <span style={{ ...fieldLabel, marginTop: 6, marginBottom: 0, color: SQ.mute, letterSpacing: ".04em" }}>
            Comma-separated bid steps → {parseIncrements(raise).map(coin).join(", ") || "—"}
          </span>
        </label>
      </div>

      <div style={{ ...fieldLabel, marginTop: 20 }}>
        PARTICIPATING FRANCHISES {participantIds.length ? `· ${participantIds.length} selected` : ""}
      </div>
      {franchisesQ.isLoading ? (
        <StateNote>Loading franchises…</StateNote>
      ) : franchises.length === 0 ? (
        <StateNote tone="muted">No franchises to enrol.</StateNote>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {franchises.map((f) => {
            const on = !!picked[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                title={f.name}
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
      )}

      {err ? (
        <div style={{ marginTop: 16, fontFamily: FONT.mono, fontSize: 12, color: SQ.ember }}>{err}</div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={submit}
          disabled={create.isPending}
          style={{ ...primaryBtn, opacity: create.isPending ? 0.6 : 1, cursor: create.isPending ? "not-allowed" : "pointer" }}
        >
          {create.isPending ? "Creating…" : "Create auction ▸"}
        </button>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* BOARD ROUTER                                                           */
/* ===================================================================== */

function AuctionBoard({ id, onReset }: { id: string; onReset: () => void }) {
  const { data: a, isLoading, isError } = useAuction(id);

  if (isLoading && !a) return <StateNote>Loading auction…</StateNote>;
  if (!a) return <StateNote tone={isError ? "error" : "muted"}>Couldn&apos;t load the auction.</StateNote>;

  if (a.status === "DRAFT") return <DraftView a={a} />;
  if (a.status === "LOBBY") return <LobbyView a={a} />;
  if (a.status === "COMPLETED") return <CompletedView a={a} onReset={onReset} />;
  if (a.status === "CANCELLED") {
    return (
      <div style={card}>
        <div style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: "-.02em" }}>{a.title}</div>
        <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".12em", color: SQ.mute, marginTop: 6 }}>
          CANCELLED · POOL REGISTRATIONS CARRY OVER TO THE NEXT AUCTION
        </div>
        <button type="button" onClick={onReset} style={{ ...ghostBtn, marginTop: 16 }}>
          Set up a new auction ▸
        </button>
      </div>
    );
  }
  return <LiveBoard a={a} />;
}

/* ---------- config summary (shared by DRAFT + LOBBY) ---------- */

function ConfigStats({ a, queuedCount }: { a: AuctionView; queuedCount: number }) {
  const scheduled = fmtSchedule(a.scheduledAt);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginTop: 18 }}>
      <Stat label="BASE PRICE" value={coin(a.basePrice)} />
      <Stat label="BID TIMER" value={`${a.bidTimerSeconds}s`} />
      <Stat label="ANTI-SNIPE" value={`${a.antiSnipeSeconds}s`} />
      <Stat label="RAISES" value={a.raiseIncrements.map(coin).join(" · ")} />
      <Stat label="FRANCHISES" value={String(a.franchises.length)} />
      <Stat label="LOT POOL" value={String(queuedCount)} />
      {scheduled ? <Stat label="SCHEDULED" value={scheduled} /> : null}
    </div>
  );
}

/* ---------- edit settings (shared by DRAFT + LOBBY) ---------- */

/**
 * Collapsible "Edit settings" panel for a pre-LIVE auction. Reuses the create-form field/chip
 * styling and only sends fields the admin actually changed (blank-guarded), so a no-op save
 * doesn't needlessly reset participant purses or replace the roster.
 */
function EditSettingsPanel({ a }: { a: AuctionView }) {
  const franchisesQ = useFranchises({ active: true, limit: 100 });
  const update = useUpdateAuction();
  const franchises = franchisesQ.data?.items ?? [];

  const [open, setOpen] = useState(false);

  // Baseline: participants share a common default budget at creation; infer it from a franchise.
  const currentBudget = a.franchises[0]?.budget;

  const [basePrice, setBasePrice] = useState(String(a.basePrice));
  const [bidTimer, setBidTimer] = useState(String(a.bidTimerSeconds));
  const [antiSnipe, setAntiSnipe] = useState(String(a.antiSnipeSeconds));
  const [raise, setRaise] = useState(a.raiseIncrements.join(","));
  const [defaultBudget, setDefaultBudget] = useState(currentBudget != null ? String(currentBudget) : "");
  const [intermission, setIntermission] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(a.scheduledAt));
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(a.franchises.map((f) => [f.franchiseId, true])),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (id: string) => setPicked((p) => ({ ...p, [id]: !p[id] }));
  const participantIds = Object.keys(picked).filter((k) => picked[k]);

  const submit = async () => {
    setMsg(null);
    const body: UpdateAuctionRequest = {};

    const bp = Number(basePrice);
    if (basePrice.trim() && Number.isFinite(bp) && bp > 0 && bp !== a.basePrice) body.basePrice = bp;

    const bt = Number(bidTimer);
    if (bidTimer.trim() && Number.isFinite(bt) && bt > 0 && bt !== a.bidTimerSeconds) body.bidTimerSeconds = bt;

    const as = Number(antiSnipe);
    if (antiSnipe.trim() && Number.isFinite(as) && as >= 0 && as !== a.antiSnipeSeconds) body.antiSnipeSeconds = as;

    const inc = parseIncrements(raise);
    if (inc.length > 0 && JSON.stringify(inc) !== JSON.stringify(a.raiseIncrements)) body.raiseIncrements = inc;

    const db = Number(defaultBudget);
    if (defaultBudget.trim() && Number.isFinite(db) && db >= 0 && db !== currentBudget) body.defaultBudget = db;

    const im = Number(intermission);
    if (intermission.trim() && Number.isFinite(im) && im >= 0) body.intermissionSeconds = im;

    if (scheduledAt && scheduledAt !== toLocalInput(a.scheduledAt))
      body.scheduledAt = new Date(scheduledAt).toISOString();

    const currentParticipants = a.franchises.map((f) => f.franchiseId);
    const sameParticipants =
      participantIds.length === currentParticipants.length &&
      [...participantIds].sort().join(",") === [...currentParticipants].sort().join(",");
    if (participantIds.length > 0 && !sameParticipants) body.participantFranchiseIds = participantIds;

    if (Object.keys(body).length === 0) {
      setMsg({ ok: false, text: "No changes to save." });
      return;
    }
    try {
      await update.mutateAsync({ id: a.id, body });
      setMsg({ ok: true, text: "Settings updated." });
    } catch (e) {
      setMsg({ ok: false, text: apiErrorMessage(e, "Couldn't update the auction.") });
    }
  };

  return (
    <div style={{ ...card, marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: SQ.faint,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        Edit settings {open ? "▴" : "▾"}
      </button>

      {open ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 16 }}>
            Adjust the configuration while the auction is still in draft/lobby. Only changed fields are
            saved — changing the default budget resets every participant&apos;s purse, and changing the
            selection replaces the participating franchises.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            <label>
              <span style={fieldLabel}>BASE PRICE</span>
              <input type="number" min={1} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} style={formInput} />
            </label>
            <label>
              <span style={fieldLabel}>DEFAULT BUDGET</span>
              <input type="number" min={0} value={defaultBudget} onChange={(e) => setDefaultBudget(e.target.value)} style={formInput} />
            </label>
            <label>
              <span style={fieldLabel}>BID TIMER (SEC)</span>
              <input type="number" min={1} value={bidTimer} onChange={(e) => setBidTimer(e.target.value)} style={formInput} />
            </label>
            <label>
              <span style={fieldLabel}>ANTI-SNIPE (SEC)</span>
              <input type="number" min={0} value={antiSnipe} onChange={(e) => setAntiSnipe(e.target.value)} style={formInput} />
            </label>
            <label>
              <span style={fieldLabel}>INTERMISSION (SEC)</span>
              <input
                type="number"
                min={0}
                value={intermission}
                onChange={(e) => setIntermission(e.target.value)}
                placeholder="unchanged"
                style={formInput}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={fieldLabel}>SCHEDULED TIME (OPTIONAL)</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={formInput}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={fieldLabel}>RAISE INCREMENTS</span>
              <input value={raise} onChange={(e) => setRaise(e.target.value)} placeholder={RAISE_DEFAULT} style={formInput} />
              <span style={{ ...fieldLabel, marginTop: 6, marginBottom: 0, color: SQ.mute, letterSpacing: ".04em" }}>
                Comma-separated bid steps → {parseIncrements(raise).map(coin).join(", ") || "—"}
              </span>
            </label>
          </div>

          <div style={{ ...fieldLabel, marginTop: 20 }}>
            PARTICIPATING FRANCHISES {participantIds.length ? `· ${participantIds.length} selected` : ""}
          </div>
          {franchisesQ.isLoading ? (
            <StateNote>Loading franchises…</StateNote>
          ) : franchises.length === 0 ? (
            <StateNote tone="muted">No franchises to enrol.</StateNote>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {franchises.map((f) => {
                const on = !!picked[f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle(f.id)}
                    title={f.name}
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
          )}

          {msg ? (
            <div style={{ marginTop: 16, fontFamily: FONT.mono, fontSize: 12, color: msg.ok ? SQ.green : SQ.ember }}>
              {msg.text}
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={submit}
              disabled={update.isPending}
              style={{ ...primaryBtn, opacity: update.isPending ? 0.6 : 1, cursor: update.isPending ? "not-allowed" : "pointer" }}
            >
              {update.isPending ? "Saving…" : "Save settings ▸"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- DRAFT ---------- */

/**
 * Call off a DRAFT/LOBBY auction (with confirm). Without this a stray draft stays the site-wide
 * "active" auction forever — banner, lobby and admin CTA included. Pool entries carry over.
 */
function CancelAuctionButton({ a, onErr }: { a: AuctionView; onErr: (m: string) => void }) {
  const cancel = useCancelAuction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={cancel.isPending}
        style={{
          ...ghostBtn,
          marginTop: 10,
          color: SQ.ember,
          border: "1px solid rgba(232,96,44,.45)",
          opacity: cancel.isPending ? 0.6 : 1,
        }}
      >
        {cancel.isPending ? "Cancelling…" : "Cancel auction"}
      </button>
      <ConfirmModal
        open={confirmOpen}
        tone="destructive"
        title="Cancel auction?"
        message={`Call off “${a.title}”? Pool registrations stay live and feed the next auction; participating franchises are notified. This can’t be undone.`}
        confirmLabel="Cancel auction"
        busy={cancel.isPending}
        onConfirm={async () => {
          try {
            await cancel.mutateAsync(a.id);
          } catch (e) {
            onErr(apiErrorMessage(e, "Couldn't cancel the auction."));
          } finally {
            setConfirmOpen(false);
          }
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

function DraftView({ a }: { a: AuctionView }) {
  const openHall = useOpenHall();
  const lockPool = useLockPool();
  const [err, setErr] = useState<string | null>(null);

  const onOpenHall = async () => {
    setErr(null);
    try {
      await openHall.mutateAsync(a.id);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't open the hall."));
    }
  };

  const onLockPool = async () => {
    setErr(null);
    try {
      await lockPool.mutateAsync(a.id);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't lock the pool."));
    }
  };

  const queued = a.lots.filter((l) => l.status === "QUEUED");

  return (
    <div>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: "-.02em" }}>{a.title}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".12em", color: a.poolLocked ? SQ.green : SQ.amber, marginTop: 6 }}>
            DRAFT · {a.poolLocked ? "POOL LOCKED" : "POOL OPEN · REGISTRATION LIVE"}
          </div>
          <ConfigStats a={a} queuedCount={queued.length} />
        </div>
        <div>
          {!a.poolLocked ? (
            <>
              <button
                type="button"
                onClick={onLockPool}
                disabled={lockPool.isPending}
                style={{ ...primaryBtn, padding: "14px 22px", fontSize: 12, opacity: lockPool.isPending ? 0.6 : 1 }}
              >
                {lockPool.isPending ? "Locking…" : "Lock pool ▸"}
              </button>
              <div style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".04em", color: SQ.mute, maxWidth: 240, lineHeight: 1.5 }}>
                Freezes the player pool, closes auction registration and auto-closes the open registration
                call (same as closing it from Announcements). Do this once everyone has registered — the
                hall can&rsquo;t open until the pool is locked.
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenHall}
                disabled={openHall.isPending}
                style={{ ...primaryBtn, padding: "14px 22px", fontSize: 12, opacity: openHall.isPending ? 0.6 : 1 }}
              >
                {openHall.isPending ? "Opening…" : "Open hall ▸"}
              </button>
              <div style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".04em", color: SQ.mute, maxWidth: 240, lineHeight: 1.5 }}>
                Pool locked ✓ — opens the lobby and builds the auction board so franchises can join before bidding.
              </div>
            </>
          )}
          <CancelAuctionButton a={a} onErr={setErr} />
          {err ? (
            <div style={{ marginTop: 12, fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, maxWidth: 220 }}>{err}</div>
          ) : null}
        </div>
      </div>

      <EditSettingsPanel a={a} />

      <div style={sectionTitle}>Registered pool · {queued.length}</div>
      <PoolPreview lots={a.lots} />

      <div style={sectionTitle}>Franchises</div>
      <FranchiseTable franchises={a.franchises} />
    </div>
  );
}

/* ===================================================================== */
/* LOBBY (hall open, franchises joining, not yet bidding)                 */
/* ===================================================================== */

function LobbyView({ a }: { a: AuctionView }) {
  const start = useStartAuction();
  const reschedule = useRescheduleAuction();
  const [err, setErr] = useState<string | null>(null);
  const [when, setWhen] = useState(() => toLocalInput(a.scheduledAt));

  const queued = a.lots.filter((l) => l.status === "QUEUED");
  const joinedCount = a.franchises.filter((f) => f.joined).length;

  const onStart = async () => {
    setErr(null);
    try {
      await start.mutateAsync(a.id);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't start the auction."));
    }
  };

  const onReschedule = async () => {
    setErr(null);
    if (!when) return setErr("Pick a new scheduled time.");
    try {
      await reschedule.mutateAsync({ id: a.id, scheduledAt: new Date(when).toISOString() });
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't reschedule the auction."));
    }
  };

  return (
    <div>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: "-.02em" }}>{a.title}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".12em", color: SQ.blue, marginTop: 6 }}>
            LOBBY · HALL OPEN · {joinedCount} OF {a.franchises.length} JOINED
          </div>
          <ConfigStats a={a} queuedCount={queued.length} />
        </div>
        <div>
          <button
            type="button"
            onClick={onStart}
            disabled={start.isPending}
            style={{ ...primaryBtn, padding: "14px 22px", fontSize: 12, opacity: start.isPending ? 0.6 : 1 }}
          >
            {start.isPending ? "Starting…" : "Start auction ▸"}
          </button>
          <CancelAuctionButton a={a} onErr={setErr} />
          {err ? (
            <div style={{ marginTop: 12, fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, maxWidth: 220 }}>{err}</div>
          ) : null}
        </div>
      </div>

      {/* reschedule */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...fieldLabel, marginBottom: 10 }}>
          RESCHEDULE {a.scheduledAt ? `· CURRENTLY ${fmtSchedule(a.scheduledAt).toUpperCase()}` : "· NOT SCHEDULED"}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            style={{ ...formInput, width: "auto", flex: "1 1 220px" }}
          />
          <button
            type="button"
            onClick={onReschedule}
            disabled={reschedule.isPending}
            style={{ ...ghostBtn, opacity: reschedule.isPending ? 0.6 : 1 }}
          >
            {reschedule.isPending ? "Saving…" : "Reschedule"}
          </button>
        </div>
      </div>

      <EditSettingsPanel a={a} />

      <div style={sectionTitle}>Presence · {joinedCount} of {a.franchises.length} joined</div>
      <LobbyFranchiseTable franchises={a.franchises} />

      <div style={sectionTitle}>Registered pool · {queued.length}</div>
      <PoolPreview lots={a.lots} />
    </div>
  );
}

/* ---------- lobby franchise presence table ---------- */

function LobbyFranchiseTable({ franchises }: { franchises: AuctionView["franchises"] }) {
  if (franchises.length === 0) return <StateNote tone="muted">No participating franchises.</StateNote>;
  return (
    <TableScroll minWidth={520}>
      <div style={{ display: "flex", padding: "12px 16px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
        <div style={{ width: 90 }}>TAG</div>
        <div style={{ flex: 1 }}>FRANCHISE</div>
        <div style={{ width: 120, textAlign: "right" }}>PRESENCE</div>
      </div>
      {franchises.map((f) => (
        <div
          key={f.franchiseId}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: `1px solid ${SQ.hairlineSoft}`,
          }}
        >
          <div style={{ width: 90, fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: SQ.ink }}>{f.tag}</div>
          <div style={{ flex: 1, fontSize: 13, color: SQ.faint, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {f.name}
          </div>
          <div style={{ width: 120, textAlign: "right" }}>
            <PresenceBadge joined={f.joined} />
          </div>
        </div>
      ))}
    </TableScroll>
  );
}

function PresenceBadge({ joined }: { joined: boolean }) {
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 9.5,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: joined ? SQ.green : SQ.mute,
        border: `1px solid ${joined ? "rgba(31,157,99,.45)" : SQ.inputBorder}`,
        padding: "3px 9px",
        borderRadius: 9,
        whiteSpace: "nowrap",
      }}
    >
      {joined ? "● Joined" : "Waiting"}
    </span>
  );
}

/* ---------- registered-pool preview (DRAFT + LOBBY) ---------- */

function PoolPreview({ lots }: { lots: AuctionLotView[] }) {
  const queued = lots.filter((l) => l.status === "QUEUED").sort((x, y) => x.lotOrder - y.lotOrder);
  if (queued.length === 0) return <StateNote tone="muted">No players registered yet.</StateNote>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {queued.map((l) => (
        <PoolPreviewRow key={l.id} lot={l} />
      ))}
    </div>
  );
}

function PoolPreviewRow({ lot }: { lot: AuctionLotView }) {
  const top = topExpertise(lot);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 7,
        background: SQ.inset,
      }}
    >
      <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, width: 34 }}>#{lot.lotOrder}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: SQ.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lot.gamerTag}
        </div>
        {lot.games.length > 0 ? (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
            {lot.games.map((g) => (
              <span
                key={g}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  letterSpacing: ".06em",
                  color: SQ.faint,
                  border: `1px solid ${SQ.inputBorder}`,
                  padding: "2px 7px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {g}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {top ? (
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.blue, whiteSpace: "nowrap" }}>
          {top.game} {top.rating}
        </span>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".12em", color: SQ.label }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: SQ.ink, marginTop: 4, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

/* ===================================================================== */
/* LIVE / PAUSED BOARD                                                    */
/* ===================================================================== */

function LiveBoard({ a }: { a: AuctionView }) {
  const paused = a.status === "PAUSED";
  const pause = usePauseAuction();
  const resume = useResumeAuction();
  const finalize = useFinalizeLot();
  const unsold = useUnsoldLot();
  const reauction = useReauctionLot();

  const [err, setErr] = useState<string | null>(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [modal, setModal] = useState<null | "assign" | "funds" | "nominate">(null);

  // Server-clock skew, recomputed each poll from the fresh serverTime.
  const skew = useMemo(() => new Date(a.serverTime).getTime() - Date.now(), [a.serverTime]);

  const lot = a.currentLot;
  const queuedLots = a.lots.filter((l) => l.status === "QUEUED");
  // Brief post-sale intermission: a lot just sold and the room waits for the next nomination.
  const inIntermission =
    !!a.intermissionUntil && new Date(a.intermissionUntil).getTime() > Date.now() + skew;
  const justSold = inIntermission
    ? a.lots.filter((l) => l.status === "SOLD").sort((x, y) => y.lotOrder - x.lotOrder)[0] ?? null
    : null;
  // The auction no longer auto-completes: with nothing on the block and nothing queued, prompt Complete.
  const allDone = !lot && queuedLots.length === 0;
  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(apiErrorMessage(e, fallback));
    }
  };

  const anyPending =
    pause.isPending || resume.isPending || finalize.isPending || unsold.isPending || reauction.isPending;

  return (
    <div>
      {/* status banner */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ fontFamily: FONT.display, fontSize: 20, letterSpacing: "-.02em" }}>{a.title}</div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: ".14em",
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 9,
            color: paused ? SQ.amber : SQ.sidebar,
            background: paused ? "transparent" : SQ.red,
            border: paused ? `1px solid rgba(181,131,26,.5)` : "none",
          }}
        >
          {paused ? "PAUSED" : "● LIVE"}
        </span>
      </div>

      {/* just-sold intermission banner */}
      {justSold ? (
        <div
          style={{
            ...card,
            marginBottom: 16,
            borderColor: "rgba(31,157,99,.4)",
            background: "linear-gradient(180deg,rgba(31,157,99,.09),transparent)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".16em", fontWeight: 700, color: SQ.green }}>
            ● SOLD
          </span>
          <div style={{ fontSize: 16, color: SQ.ink }}>
            <span style={{ fontWeight: 700 }}>{justSold.gamerTag}</span>
            <span style={{ color: SQ.mute }}> → </span>
            <span style={{ fontFamily: FONT.mono, fontWeight: 700, color: SQ.ember }}>{justSold.soldToTag ?? "—"}</span>
            <span style={{ color: SQ.mute }}> for </span>
            <span style={{ fontFamily: FONT.mono, fontWeight: 700 }}>{coin(justSold.soldPrice)}</span>
          </div>
          <span style={{ marginLeft: "auto", fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute }}>
            Next lot coming up…
          </span>
        </div>
      ) : null}

      {/* current lot card */}
      <div
        style={{
          ...card,
          borderColor: lot ? "rgba(232,96,44,.35)" : SQ.hairline,
          background: lot ? "linear-gradient(180deg,rgba(232,96,44,.06),transparent)" : SQ.panel,
        }}
      >
        {lot ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".16em", color: SQ.ember }}>
                ON THE BLOCK · LOT #{lot.lotOrder}
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: "clamp(28px,4vw,40px)", letterSpacing: "-.02em", marginTop: 6 }}>
                {lot.gamerTag}
              </div>
              {lot.realName ? (
                <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".08em", color: SQ.mute, marginTop: 4 }}>
                  {lot.realName}
                </div>
              ) : null}
              <div style={{ marginTop: 12, display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".12em", color: SQ.label }}>CURRENT BID</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: SQ.ink, marginTop: 3 }}>
                    {lot.currentBidderTag ? coin(lot.currentBid) : "—"}
                  </div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.faint, marginTop: 2 }}>
                    {lot.currentBidderTag ? `${lot.currentBidderTag} leads` : "no bids yet"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".12em", color: SQ.label }}>MIN NEXT BID</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: SQ.ink, marginTop: 3 }}>{coin(lot.minNextBid)}</div>
                </div>
              </div>
            </div>
            <LotCountdown deadline={lot.bidDeadline} skew={skew} paused={paused} />
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".16em", color: SQ.mute }}>
                {allDone ? "ALL LOTS DONE" : "THE BLOCK IS EMPTY"}
              </div>
              <div style={{ fontSize: 15, color: SQ.faint, marginTop: 6 }}>
                {allDone
                  ? "Every player has been through the block — re-auction unsold lots below, or complete the auction."
                  : "Nominate the next player to open bidding."}
              </div>
            </div>
            {allDone ? null : (
              <button type="button" onClick={() => setModal("nominate")} style={primaryBtn}>
                Nominate a lot ▸
              </button>
            )}
          </div>
        )}
      </div>

      {/* admin control row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {paused ? (
          <button
            type="button"
            onClick={() => run(() => resume.mutateAsync(a.id), "Couldn't resume.")}
            disabled={anyPending}
            style={primaryBtn}
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(() => pause.mutateAsync(a.id), "Couldn't pause.")}
            disabled={anyPending}
            style={ghostBtn}
          >
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={() => run(() => finalize.mutateAsync(a.id), "Couldn't finalize this lot.")}
          disabled={anyPending || !lot}
          style={{ ...ghostBtn, opacity: !lot ? 0.4 : 1, cursor: !lot ? "not-allowed" : "pointer" }}
          title={lot ? "Sell to the top bidder (or mark unsold if there are no bids)" : "No lot on the block"}
        >
          Finalize lot
        </button>
        <button
          type="button"
          onClick={() => run(() => unsold.mutateAsync(a.id), "Couldn't mark this lot unsold.")}
          disabled={anyPending || !lot}
          style={{ ...ghostBtn, opacity: !lot ? 0.4 : 1, cursor: !lot ? "not-allowed" : "pointer" }}
        >
          Mark unsold
        </button>
        <button type="button" onClick={() => setModal("assign")} style={ghostBtn}>
          Assign / takeover
        </button>
        <button type="button" onClick={() => setModal("funds")} style={ghostBtn}>
          Add funds
        </button>
        <button
          type="button"
          onClick={() => setConfirmComplete(true)}
          style={{ ...ghostBtn, color: SQ.ember, borderColor: "rgba(232,96,44,.45)" }}
        >
          Complete auction
        </button>
      </div>
      {err ? (
        <div style={{ marginTop: 12, fontFamily: FONT.mono, fontSize: 12, color: SQ.ember }}>{err}</div>
      ) : null}

      {/* franchises + bid feed */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 20, marginTop: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={sectionTitle}>Franchises</div>
          <FranchiseTable franchises={a.franchises} leaderId={lot?.currentBidderFranchiseId} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={sectionTitle}>Live bids</div>
          <BidFeed bids={a.recentBids} />
        </div>
      </div>

      {/* lot pool */}
      <div style={sectionTitle}>Lot pool</div>
      <LotPool a={a} onReauction={(lotId) => run(() => reauction.mutateAsync({ id: a.id, lotId }), "Couldn't re-auction.")} reauctionPending={reauction.isPending} />

      {/* modals */}
      {confirmComplete ? (
        <CompleteModal a={a} onClose={() => setConfirmComplete(false)} />
      ) : null}
      {modal === "assign" ? <AssignModal a={a} onClose={() => setModal(null)} /> : null}
      {modal === "funds" ? <FundsModal a={a} onClose={() => setModal(null)} /> : null}
      {modal === "nominate" ? <NominateModal a={a} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

/* ---------- countdown ---------- */

function LotCountdown({ deadline, skew, paused }: { deadline?: string; skew: number; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (paused || !deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused, deadline]);

  // Re-sync the local clock whenever a fresh poll lands (new skew / new deadline).
  useEffect(() => {
    setNow(Date.now());
  }, [skew, deadline]);

  let label: string;
  let color: string = SQ.ink;
  if (paused) {
    label = "PAUSED";
    color = SQ.amber;
  } else if (!deadline) {
    label = "—";
    color = SQ.mute;
  } else {
    const remaining = new Date(deadline).getTime() - (now + skew);
    const secs = Math.max(0, Math.ceil(remaining / 1000));
    const mm = Math.floor(secs / 60);
    const ss = secs % 60;
    label = mm > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : `${secs}s`;
    color = secs <= 5 ? SQ.red : secs <= 10 ? SQ.amber : SQ.ink;
  }

  return (
    <div style={{ textAlign: "center", minWidth: 120 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: ".14em", color: SQ.label }}>TIME LEFT</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 40, fontWeight: 700, color, lineHeight: 1.05, marginTop: 4 }}>{label}</div>
    </div>
  );
}

/* ---------- franchises table ---------- */

function FranchiseTable({
  franchises,
  leaderId,
}: {
  franchises: AuctionView["franchises"];
  leaderId?: string;
}) {
  if (franchises.length === 0) return <StateNote tone="muted">No participating franchises.</StateNote>;
  return (
    <TableScroll minWidth={560}>
      <div style={{ display: "flex", padding: "12px 16px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
        <div style={{ width: 90 }}>TAG</div>
        <div style={{ flex: 1 }}>FRANCHISE</div>
        <div style={{ width: 200, textAlign: "right" }}>BALANCE / BUDGET</div>
        <div style={{ width: 90, textAlign: "right" }}>ACQUIRED</div>
      </div>
      {franchises.map((f) => {
        const leads = leaderId && f.franchiseId === leaderId;
        return (
          <div
            key={f.franchiseId}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: `1px solid ${SQ.hairlineSoft}`,
              background: leads ? "linear-gradient(90deg,rgba(232,96,44,.12),transparent)" : "transparent",
            }}
          >
            <div style={{ width: 90, fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: leads ? SQ.ember : SQ.ink }}>
              {f.tag}
            </div>
            <div style={{ flex: 1, fontSize: 13, color: SQ.faint, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.name}
            </div>
            <div style={{ width: 200, textAlign: "right", fontFamily: FONT.mono, fontSize: 12.5 }}>
              <span style={{ color: SQ.ink, fontWeight: 600 }}>{coin(f.balance)}</span>
              <span style={{ color: SQ.mute }}> / {coin(f.budget)}</span>
            </div>
            <div style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 12.5, color: SQ.faint }}>
              {f.acquiredCount}
            </div>
          </div>
        );
      })}
    </TableScroll>
  );
}

/* ---------- bid feed ---------- */

function BidFeed({ bids }: { bids: AuctionView["recentBids"] }) {
  if (bids.length === 0) return <StateNote tone="muted">No bids yet.</StateNote>;
  return (
    <div style={{ ...card, padding: 0, maxHeight: 360, overflowY: "auto" }}>
      {bids.map((b, i) => (
        <div
          key={`${b.at}-${i}`}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            padding: "11px 14px",
            borderBottom: i === bids.length - 1 ? "none" : `1px solid ${SQ.hairlineSoft}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: SQ.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontFamily: FONT.mono, fontWeight: 700, color: SQ.ember }}>{b.franchiseTag}</span>{" "}
              <span style={{ color: SQ.mute }}>on</span> {b.playerGamerTag}
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginTop: 2 }}>{relTime(b.at)}</div>
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 700, color: SQ.ink }}>{coin(b.amount)}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- lot pool ---------- */

const POOL_ORDER: AuctionLotStatus[] = ["ON_BLOCK", "QUEUED", "SOLD", "UNSOLD"];

function LotPool({
  a,
  onReauction,
  reauctionPending,
}: {
  a: AuctionView;
  onReauction: (lotId: string) => void;
  reauctionPending: boolean;
}) {
  const groups = POOL_ORDER.map((status) => ({
    status,
    lots: a.lots
      .filter((l) => l.status === status)
      .sort((x, y) => x.lotOrder - y.lotOrder),
  })).filter((g) => g.lots.length > 0);

  if (groups.length === 0) return <StateNote tone="muted">No lots in this auction.</StateNote>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map((g) => (
        <div key={g.status}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.dim, marginBottom: 8 }}>
            {lotStatusLabel(g.status).toUpperCase()} · {g.lots.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.lots.map((l) => (
              <LotRow key={l.id} lot={l} onReauction={onReauction} reauctionPending={reauctionPending} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LotRow({
  lot,
  onReauction,
  reauctionPending,
}: {
  lot: AuctionLotView;
  onReauction: (lotId: string) => void;
  reauctionPending: boolean;
}) {
  const canReauction = lot.status === "SOLD" || lot.status === "UNSOLD";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 7,
        background: SQ.inset,
      }}
    >
      <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, width: 34 }}>#{lot.lotOrder}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: SQ.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lot.gamerTag}
        </div>
        {lot.status === "SOLD" ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.green, marginTop: 2 }}>
            {lot.soldToTag ?? "—"} · {coin(lot.soldPrice)}
          </div>
        ) : lot.status === "ON_BLOCK" ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.faint, marginTop: 2 }}>
            {lot.currentBidderTag ? `${lot.currentBidderTag} · ${coin(lot.currentBid)}` : `opening · ${coin(lot.minNextBid)}`}
          </div>
        ) : null}
      </div>
      <StatusChip status={lot.status} />
      {canReauction ? (
        <button
          type="button"
          onClick={() => onReauction(lot.id)}
          disabled={reauctionPending}
          style={{ ...ghostBtn, padding: "6px 11px", fontSize: 9.5, opacity: reauctionPending ? 0.5 : 1 }}
        >
          Re-auction
        </button>
      ) : null}
    </div>
  );
}

/* ===================================================================== */
/* MODALS                                                                 */
/* ===================================================================== */

const modalPrimary: CSSProperties = { ...primaryBtn, width: "100%", padding: "12px 15px" };

function ModalError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div style={{ marginTop: 12, fontFamily: FONT.mono, fontSize: 12, color: SQ.ember }}>{msg}</div>;
}

function CompleteModal({ a, onClose }: { a: AuctionView; onClose: () => void }) {
  const complete = useCompleteAuction();
  const [err, setErr] = useState<string | null>(null);
  const confirm = async () => {
    setErr(null);
    try {
      await complete.mutateAsync(a.id);
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't complete the auction."));
    }
  };
  return (
    <Modal open title="Complete auction" onClose={complete.isPending ? () => {} : onClose}>
      <div style={{ fontSize: 13, color: SQ.faint, lineHeight: 1.55 }}>
        This closes the auction for good. Any lot still on the block or queued will be left unsold and
        no further bids can be placed. This can&apos;t be undone.
      </div>
      <ModalError msg={err} />
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={confirm}
          disabled={complete.isPending}
          style={{ ...primaryBtn, flex: 1, opacity: complete.isPending ? 0.6 : 1 }}
        >
          {complete.isPending ? "Completing…" : "Complete auction"}
        </button>
        <button type="button" onClick={onClose} disabled={complete.isPending} style={{ ...ghostBtn, flex: 1 }}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function NominateModal({ a, onClose }: { a: AuctionView; onClose: () => void }) {
  const nominate = useNominateLot();
  const [lotId, setLotId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const queued = a.lots.filter((l) => l.status === "QUEUED").sort((x, y) => x.lotOrder - y.lotOrder);

  const submit = async () => {
    setErr(null);
    if (!lotId) return setErr("Pick a queued lot.");
    try {
      await nominate.mutateAsync({ id: a.id, lotId });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't nominate this lot."));
    }
  };

  return (
    <Modal open title="Nominate next lot" onClose={onClose}>
      {queued.length === 0 ? (
        <StateNote tone="muted">No queued lots remain.</StateNote>
      ) : (
        <>
          <span style={fieldLabel}>QUEUED LOT</span>
          <SearchableSelect
            value={lotId}
            onChange={setLotId}
            options={queued.map((l) => ({ value: l.id, label: l.gamerTag, hint: `#${l.lotOrder}` }))}
            placeholder="Select a player…"
            searchPlaceholder="Search players…"
          />
          <ModalError msg={err} />
          <button
            type="button"
            onClick={submit}
            disabled={nominate.isPending}
            style={{ ...modalPrimary, marginTop: 18, opacity: nominate.isPending ? 0.6 : 1 }}
          >
            {nominate.isPending ? "Nominating…" : "Put on the block ▸"}
          </button>
        </>
      )}
    </Modal>
  );
}

function AssignModal({ a, onClose }: { a: AuctionView; onClose: () => void }) {
  const assign = useAssignLot();
  const [lotId, setLotId] = useState(a.currentLot?.id ?? "");
  const [franchiseId, setFranchiseId] = useState("");
  const [price, setPrice] = useState(String(a.currentLot?.currentBid || a.basePrice));
  const [err, setErr] = useState<string | null>(null);

  const assignable = a.lots
    .filter((l) => l.status !== "SOLD")
    .sort((x, y) => x.lotOrder - y.lotOrder);

  const submit = async () => {
    setErr(null);
    if (!lotId) return setErr("Pick a lot.");
    if (!franchiseId) return setErr("Pick a franchise.");
    if (!(Number(price) > 0)) return setErr("Enter a price.");
    try {
      await assign.mutateAsync({ id: a.id, body: { lotId, franchiseId, price: Number(price) } });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't assign this lot."));
    }
  };

  return (
    <Modal open title="Assign / takeover" onClose={onClose}>
      <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
        Manually award a lot to a franchise at a set price (admin override).
      </div>
      <span style={fieldLabel}>LOT</span>
      <SearchableSelect
        value={lotId}
        onChange={setLotId}
        options={assignable.map((l) => ({ value: l.id, label: l.gamerTag, hint: lotStatusLabel(l.status) }))}
        placeholder="Select a lot…"
        searchPlaceholder="Search players…"
      />
      <div style={{ height: 12 }} />
      <span style={fieldLabel}>FRANCHISE</span>
      <SearchableSelect
        value={franchiseId}
        onChange={setFranchiseId}
        options={a.franchises.map((f) => ({ value: f.franchiseId, label: f.tag, hint: coin(f.balance) }))}
        placeholder="Select a franchise…"
        searchPlaceholder="Search franchises…"
      />
      <div style={{ height: 12 }} />
      <label>
        <span style={fieldLabel}>PRICE</span>
        <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} style={formInput} />
      </label>
      <ModalError msg={err} />
      <button
        type="button"
        onClick={submit}
        disabled={assign.isPending}
        style={{ ...modalPrimary, marginTop: 18, opacity: assign.isPending ? 0.6 : 1 }}
      >
        {assign.isPending ? "Assigning…" : "Assign lot ▸"}
      </button>
    </Modal>
  );
}

function FundsModal({ a, onClose }: { a: AuctionView; onClose: () => void }) {
  const funds = useAddAuctionFunds();
  const [franchiseId, setFranchiseId] = useState("");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!franchiseId) return setErr("Pick a franchise.");
    if (!Number.isFinite(Number(amount)) || Number(amount) === 0) return setErr("Enter an amount (can be negative to deduct).");
    try {
      await funds.mutateAsync({ id: a.id, body: { franchiseId, amount: Number(amount) } });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't adjust funds."));
    }
  };

  return (
    <Modal open title="Add funds" onClose={onClose}>
      <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
        Top up (or deduct, with a negative amount) a franchise&apos;s remaining balance.
      </div>
      <span style={fieldLabel}>FRANCHISE</span>
      <SearchableSelect
        value={franchiseId}
        onChange={setFranchiseId}
        options={a.franchises.map((f) => ({ value: f.franchiseId, label: f.tag, hint: coin(f.balance) }))}
        placeholder="Select a franchise…"
        searchPlaceholder="Search franchises…"
      />
      <div style={{ height: 12 }} />
      <label>
        <span style={fieldLabel}>AMOUNT</span>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 250" style={formInput} />
      </label>
      <ModalError msg={err} />
      <button
        type="button"
        onClick={submit}
        disabled={funds.isPending}
        style={{ ...modalPrimary, marginTop: 18, opacity: funds.isPending ? 0.6 : 1 }}
      >
        {funds.isPending ? "Saving…" : "Adjust balance ▸"}
      </button>
    </Modal>
  );
}

/* ===================================================================== */
/* COMPLETED                                                              */
/* ===================================================================== */

function CompletedView({ a, onReset }: { a: AuctionView; onReset: () => void }) {
  const sold = a.lots.filter((l) => l.status === "SOLD").sort((x, y) => y.soldPrice - x.soldPrice);
  const unsold = a.lots.filter((l) => l.status === "UNSOLD").sort((x, y) => x.lotOrder - y.lotOrder);
  const totalSpend = sold.reduce((sum, l) => sum + (l.soldPrice || 0), 0);

  return (
    <div>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: "-.02em" }}>{a.title}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".12em", color: SQ.green, marginTop: 6 }}>
            COMPLETED
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 16 }}>
            <Stat label="SOLD" value={String(sold.length)} />
            <Stat label="UNSOLD" value={String(unsold.length)} />
            <Stat label="TOTAL SPEND" value={coin(totalSpend)} />
          </div>
        </div>
        <button type="button" onClick={onReset} style={ghostBtn}>
          Start a new auction ▸
        </button>
      </div>

      <div style={sectionTitle}>Final rosters</div>
      <FranchiseTable franchises={a.franchises} />

      <div style={sectionTitle}>Sold lots</div>
      {sold.length === 0 ? (
        <StateNote tone="muted">No players were sold.</StateNote>
      ) : (
        <TableScroll minWidth={560}>
          <div style={{ display: "flex", padding: "12px 16px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
            <div style={{ width: 44 }}>LOT</div>
            <div style={{ flex: 1 }}>PLAYER</div>
            <div style={{ width: 140 }}>WON BY</div>
            <div style={{ width: 120, textAlign: "right" }}>PRICE</div>
          </div>
          {sold.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${SQ.hairlineSoft}` }}>
              <div style={{ width: 44, fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>#{l.lotOrder}</div>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: SQ.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.gamerTag}
              </div>
              <div style={{ width: 140, fontFamily: FONT.mono, fontSize: 12, color: SQ.ember }}>{l.soldToTag ?? "—"}</div>
              <div style={{ width: 120, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, fontWeight: 700, color: SQ.ink }}>
                {coin(l.soldPrice)}
              </div>
            </div>
          ))}
        </TableScroll>
      )}

      {unsold.length > 0 ? (
        <>
          <div style={sectionTitle}>Went unsold</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {unsold.map((l) => (
              <span
                key={l.id}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11.5,
                  color: SQ.faint,
                  border: `1px solid ${SQ.inputBorder}`,
                  padding: "7px 11px",
                  borderRadius: 6,
                }}
              >
                {l.gamerTag}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
