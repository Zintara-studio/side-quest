"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { Modal } from "../modal";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import { useMyFranchise, useActiveAuction, useAuction, usePlaceBid } from "@/lib/query/hooks";
import type { AuctionView, AuctionLotView, AuctionFranchiseView } from "@/lib/api/types";

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

/** Auction credits — neutral thousands-separated integer, no currency symbol. */
const money = (n: number) => n.toLocaleString("en-US");

// ---- entry point / gating --------------------------------------------------

export function AuctionBidScreen() {
  const { isAuthenticated, hydrated } = useAuth();
  const mineQ = useMyFranchise(isAuthenticated);
  const activeQ = useActiveAuction(isAuthenticated);
  // Full board for the active auction; polls fast only while LIVE. Falls back to the light
  // active-auction payload until the detailed board lands.
  const boardQ = useAuction(activeQ.data?.id);

  if (hydrated && !isAuthenticated) {
    return (
      <div>
        <Header />
        <StateNote>
          <Link href="/login" style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}>
            Sign in
          </Link>{" "}
          to join the bidding room for your franchise.
        </StateNote>
      </div>
    );
  }

  const auction = boardQ.data ?? activeQ.data ?? null;
  const mine = mineQ.data ?? null;

  // Still resolving auth / first payloads.
  if (!hydrated || activeQ.isLoading || mineQ.isLoading) {
    return (
      <div>
        <Header />
        <StateNote>Loading the auction…</StateNote>
      </div>
    );
  }

  if (!auction || auction.status === "COMPLETED") {
    return (
      <div>
        <Header />
        <StateNote>
          There&rsquo;s no live auction right now. When the league opens the player auction it&rsquo;ll
          appear here for you to bid.
        </StateNote>
      </div>
    );
  }

  if (!mine) {
    return (
      <div>
        <Header />
        <StateNote>
          You don&rsquo;t own or manage a franchise, so there&rsquo;s nothing to bid with. Manage your
          franchise on the{" "}
          <Link href="/my/franchise" style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}>
            My Franchise
          </Link>{" "}
          page.
        </StateNote>
      </div>
    );
  }

  const myFranchiseId = mine.franchise.id;
  const myAF = auction.franchises.find((f) => f.franchiseId === myFranchiseId) ?? null;
  const canBid = mine.myRole === "OWNER" || mine.myRole === "MANAGER";

  if (!myAF) {
    return (
      <div>
        <Header />
        <StateNote>Your franchise isn&rsquo;t part of this auction.</StateNote>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <BidRoom auction={auction} myAF={myAF} myFranchiseId={myFranchiseId} canBid={canBid} />
    </div>
  );
}

// ---- the live bidding room -------------------------------------------------

function BidRoom({
  auction,
  myAF,
  myFranchiseId,
  canBid,
}: {
  auction: AuctionView;
  myAF: AuctionFranchiseView;
  myFranchiseId: string;
  canBid: boolean;
}) {
  const placeBid = usePlaceBid();
  const [bidErr, setBidErr] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const currentLot = auction.currentLot;
  const iAmTop = !!currentLot && currentLot.currentBidderFranchiseId === myFranchiseId;
  const minNext = currentLot?.minNextBid ?? 0;

  // A new player on the block (or a status flip) clears any stale bid error.
  useEffect(() => {
    setBidErr(null);
  }, [currentLot?.id, auction.status]);

  // Why bidding is blocked right now, in priority order (null == you can bid).
  const bidBlockReason: string | null = !canBid
    ? "Only your franchise owner or manager can bid."
    : auction.status === "PAUSED"
      ? "The auction is paused."
      : auction.status !== "LIVE"
        ? "The auction is not live."
        : !currentLot
          ? "No player is on the block right now."
          : iAmTop
            ? "You are the top bidder — sit tight."
            : myAF.balance < minNext
              ? "Insufficient balance for the next bid."
              : null;

  const submitBid = async (amount: number) => {
    if (!currentLot) return;
    setBidErr(null);
    try {
      await placeBid.mutateAsync({ id: auction.id, body: { lotId: currentLot.id, amount } });
      setCustomOpen(false);
    } catch (e) {
      setBidErr(apiErrorMessage(e, "Couldn't place that bid."));
    }
  };

  const acquired = useMemo(
    () =>
      auction.lots
        .filter((l) => l.soldToFranchiseId === myFranchiseId)
        .sort((a, b) => a.lotOrder - b.lotOrder),
    [auction.lots, myFranchiseId],
  );

  const spent = myAF.budget - myAF.balance;
  const budgetPct = myAF.budget > 0 ? Math.max(0, Math.min(100, (myAF.balance / myAF.budget) * 100)) : 0;

  return (
    <div style={{ marginTop: 26 }}>
      {/* my franchise wallet header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 20,
          justifyContent: "space-between",
          padding: "18px 20px",
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".16em", color: SQ.label }}>
            YOUR FRANCHISE
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: "clamp(26px,4vw,40px)", lineHeight: 0.95, marginTop: 6 }}>
            {myAF.name}
            {myAF.tag ? <span style={{ color: SQ.mute }}> · {myAF.tag}</span> : null}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute, marginTop: 8 }}>
            {myAF.acquiredCount} acquired · {money(spent)} spent
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 180 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".16em", color: SQ.label }}>
            REMAINING BALANCE
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: "clamp(30px,5vw,48px)", color: SQ.green, lineHeight: 0.95, marginTop: 4 }}>
            {money(myAF.balance)}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 4 }}>
            of {money(myAF.budget)} budget
          </div>
          <div style={{ marginTop: 8, height: 4, borderRadius: 3, background: SQ.track, overflow: "hidden" }}>
            <div style={{ width: `${budgetPct}%`, height: "100%", background: SQ.green }} />
          </div>
        </div>
      </div>

      {/* status + auction title strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "22px 0 14px" }}>
        <StatusPill status={auction.status} />
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{auction.title}</div>
      </div>

      {/* current lot / on-the-block card */}
      {currentLot ? (
        <CurrentLotCard
          auction={auction}
          lot={currentLot}
          iAmTop={iAmTop}
          canBid={canBid}
          balance={myAF.balance}
          blockReason={bidBlockReason}
          pending={placeBid.isPending}
          bidErr={bidErr}
          onBid={submitBid}
          onCustom={() => setCustomOpen(true)}
        />
      ) : (
        <StateNote>
          No player is on the block right now. Bidding opens the moment the auctioneer nominates the next
          player.
        </StateNote>
      )}

      {/* my acquired players */}
      <section style={{ marginTop: 40 }}>
        <div style={sectionTitle}>My acquired players</div>
        {acquired.length === 0 ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute }}>
            You haven&rsquo;t won any players yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {acquired.map((l) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderTop: `1px solid ${SQ.hairlineCell}`,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{l.gamerTag}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 13, color: SQ.green }}>{money(l.soldPrice)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* compact recent bids feed */}
      {auction.recentBids.length > 0 ? (
        <section style={{ marginTop: 34 }}>
          <div style={sectionTitle}>Recent bids</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {auction.recentBids.slice(0, 8).map((b, i) => {
              const mine = b.franchiseTag === myAF.tag;
              return (
                <div
                  key={`${b.lotId}-${b.at}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : `1px solid ${SQ.hairlineCell}`,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: SQ.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, color: mine ? SQ.ember : SQ.ink }}>{b.franchiseTag}</span>
                    <span style={{ color: SQ.mute }}> on </span>
                    {b.playerGamerTag}
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontSize: 12.5, color: SQ.ink }}>{money(b.amount)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <CustomBidModal
        open={customOpen}
        minNext={minNext}
        balance={myAF.balance}
        pending={placeBid.isPending}
        err={bidErr}
        onSubmit={submitBid}
        onClose={() => setCustomOpen(false)}
      />
    </div>
  );
}

// ---- current lot card + raise controls -------------------------------------

function CurrentLotCard({
  auction,
  lot,
  iAmTop,
  canBid,
  balance,
  blockReason,
  pending,
  bidErr,
  onBid,
  onCustom,
}: {
  auction: AuctionView;
  lot: AuctionLotView;
  iAmTop: boolean;
  canBid: boolean;
  balance: number;
  blockReason: string | null;
  pending: boolean;
  bidErr: string | null;
  onBid: (amount: number) => void;
  onCustom: () => void;
}) {
  const remaining = useCountdown(auction.serverTime, lot.bidDeadline, auction.status === "LIVE");
  const showRaises = canBid && auction.status === "LIVE";

  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px solid ${iAmTop ? SQ.green : SQ.hairline}`,
        borderRadius: 12,
        padding: 22,
        boxShadow: iAmTop ? `0 0 0 1px ${SQ.green} inset` : undefined,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".16em", color: SQ.ember }}>
            ON THE BLOCK
          </div>
          <div style={{ fontFamily: FONT.display, fontSize: "clamp(30px,5vw,52px)", lineHeight: 0.95, marginTop: 8 }}>
            {lot.gamerTag}
          </div>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".1em", color: SQ.label }}>
              CURRENT BID
            </span>
            <span style={{ fontFamily: FONT.display, fontSize: 26, color: lot.currentBid > 0 ? SQ.ink : SQ.mute }}>
              {lot.currentBid > 0 ? money(lot.currentBid) : "—"}
            </span>
            {lot.currentBidderTag ? (
              <span style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.mute }}>
                by {lot.currentBidderTag}
              </span>
            ) : (
              <span style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.mute }}>no bids yet</span>
            )}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute, marginTop: 6 }}>
            Next bid must reach {money(lot.minNextBid)}
          </div>
        </div>

        {/* countdown clock */}
        <div style={{ textAlign: "center", minWidth: 96 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".16em", color: SQ.label }}>TIMER</div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 44,
              lineHeight: 1,
              marginTop: 6,
              color: remaining == null ? SQ.mute : remaining <= 5 ? SQ.red : remaining <= 10 ? SQ.amber : SQ.ink,
            }}
          >
            {auction.status === "PAUSED" ? "PAUSED" : remaining == null ? "—" : `${remaining}s`}
          </div>
        </div>
      </div>

      {iAmTop ? (
        <div
          style={{
            marginTop: 16,
            fontFamily: FONT.mono,
            fontSize: 11.5,
            letterSpacing: ".12em",
            color: SQ.green,
            border: `1px solid ${SQ.green}`,
            borderRadius: 6,
            padding: "8px 12px",
            textAlign: "center",
          }}
        >
          ★ YOU ARE TOP BID
        </div>
      ) : null}

      {/* raise controls */}
      {showRaises ? (
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${SQ.hairlineSoft}` }}>
          <div style={subLabel}>PLACE A BID</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {auction.raiseIncrements.map((inc) => {
              const amount = Math.max(lot.minNextBid, lot.currentBid + inc);
              const tooRich = amount > balance;
              const disabled = blockReason != null || tooRich || pending;
              return (
                <button
                  key={inc}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBid(amount)}
                  title={tooRich ? "Over your remaining balance" : undefined}
                  style={raiseBtn(disabled)}
                >
                  <span style={{ fontSize: 9.5, color: SQ.mute, letterSpacing: ".1em" }}>+{money(inc)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{money(amount)}</span>
                </button>
              );
            })}
            <button
              type="button"
              disabled={blockReason != null || pending}
              onClick={onCustom}
              style={raiseBtn(blockReason != null || pending, true)}
            >
              <span style={{ fontSize: 9.5, color: SQ.mute, letterSpacing: ".1em" }}>CUSTOM</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Enter amount</span>
            </button>
          </div>
          {blockReason ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.amber, marginTop: 12 }}>{blockReason}</div>
          ) : null}
          {bidErr ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 8 }}>{bidErr}</div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${SQ.hairlineSoft}` }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.amber }}>
            {blockReason ?? "Bidding isn't open right now."}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- custom bid modal ------------------------------------------------------

function CustomBidModal({
  open,
  minNext,
  balance,
  pending,
  err,
  onSubmit,
  onClose,
}: {
  open: boolean;
  minNext: number;
  balance: number;
  pending: boolean;
  err: string | null;
  onSubmit: (amount: number) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRaw(String(minNext));
      setLocalErr(null);
    }
  }, [open, minNext]);

  const submit = () => {
    setLocalErr(null);
    const amount = Number(raw.trim());
    if (!raw.trim() || !Number.isFinite(amount) || !Number.isInteger(amount)) {
      setLocalErr("Enter a whole number.");
      return;
    }
    if (amount < minNext) {
      setLocalErr(`Bid must be at least ${money(minNext)}.`);
      return;
    }
    if (amount > balance) {
      setLocalErr(`That's over your remaining balance of ${money(balance)}.`);
      return;
    }
    onSubmit(amount);
  };

  return (
    <Modal open={open} title="Custom bid" onClose={onClose}>
      <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
        Enter any amount from {money(minNext)} up to your remaining balance of {money(balance)}.
      </div>
      <div style={subLabel}>BID AMOUNT</div>
      <input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        inputMode="numeric"
        autoFocus
        placeholder={String(minNext)}
        style={{
          width: "100%",
          background: SQ.inset,
          border: `1px solid ${SQ.inputBorder}`,
          borderRadius: 5,
          padding: "11px 13px",
          fontSize: 16,
          fontFamily: FONT.mono,
          color: SQ.ink,
        }}
      />
      {localErr ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 10 }}>{localErr}</div>
      ) : err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 10 }}>{err}</div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onClose} disabled={pending} style={ghostBtn(pending)}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={pending} style={solidBtn(pending)}>
          {pending ? "Placing…" : "Place bid ▸"}
        </button>
      </div>
    </Modal>
  );
}

// ---- countdown hook --------------------------------------------------------

/**
 * Smooth 1s countdown to a server-authoritative deadline. Clock skew is estimated once per poll
 * from the auction's serverTime vs local now (recomputed whenever serverTime changes), so the
 * client never drifts from the server sweep. Returns whole seconds remaining, or null when there's
 * no deadline. Never finalizes — the UI just reflects polled status.
 */
function useCountdown(serverTime: string, deadline: string | undefined, active: boolean): number | null {
  const skew = useMemo(() => new Date(serverTime).getTime() - Date.now(), [serverTime]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Only tick while the auction is actually live — a paused board must not keep counting down
    // toward a frozen deadline.
    if (!deadline || !active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline, active]);

  if (!deadline || !active) return null;
  const ms = new Date(deadline).getTime() - (now + skew);
  return Math.max(0, Math.ceil(ms / 1000));
}

// ---- bits ------------------------------------------------------------------

function StatusPill({ status }: { status: AuctionView["status"] }) {
  const color = status === "LIVE" ? SQ.red : status === "PAUSED" ? SQ.amber : SQ.mute;
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 9.5,
        letterSpacing: ".14em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: "4px 11px",
        whiteSpace: "nowrap",
      }}
    >
      ● {status}
    </span>
  );
}

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
        Bidding room
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
        PLAYER AUCTION
      </div>
      <div style={{ fontSize: 13.5, color: SQ.mute, marginTop: 12, lineHeight: 1.5, maxWidth: 560 }}>
        Watch the block, track your remaining balance, and place raise bids on the player currently up
        for auction. The server clock is authoritative — bid before the timer runs out.
      </div>
    </div>
  );
}

function raiseBtn(disabled: boolean, outline = false) {
  return {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start" as const,
    gap: 2,
    minWidth: 96,
    fontFamily: FONT.mono,
    padding: "10px 14px",
    borderRadius: 7,
    cursor: disabled ? "not-allowed" : "pointer",
    color: SQ.ink,
    background: outline ? "transparent" : SQ.inset,
    border: `1px solid ${outline ? SQ.ember : SQ.inputBorder}`,
    opacity: disabled ? 0.45 : 1,
  };
}

function ghostBtn(disabled: boolean) {
  return {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    padding: "10px 16px",
    borderRadius: 5,
    cursor: disabled ? "not-allowed" : "pointer",
    color: SQ.faint,
    background: "transparent",
    border: `1px solid ${SQ.inputBorder}`,
    opacity: disabled ? 0.6 : 1,
  };
}

function solidBtn(disabled: boolean) {
  return {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    padding: "10px 16px",
    borderRadius: 5,
    cursor: disabled ? "not-allowed" : "pointer",
    color: SQ.sidebar,
    background: SQ.red,
    border: "none",
    opacity: disabled ? 0.6 : 1,
  };
}
