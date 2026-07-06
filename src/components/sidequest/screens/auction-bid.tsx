"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { Modal } from "../modal";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import { useMyFranchise, useActiveAuction, useAuction, usePlaceBid, useJoinAuction } from "@/lib/query/hooks";
import type { AuctionView, AuctionLotView, AuctionFranchiseView } from "@/lib/api/types";

const sectionTitle = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  margin: "0 0 14px",
  flexShrink: 0, // stays put as a panel header while its list scrolls beneath
} as const;

const subLabel = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  color: SQ.label,
  marginBottom: 8,
} as const;

const eyebrow = {
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".16em",
  color: SQ.label,
} as const;

/** Auction credits — neutral thousands-separated integer, no currency symbol. */
const money = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => Math.max(0, Math.min(100, n));
const fmtWhen = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

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

  // No auction at all (a just-COMPLETED board still held in cache falls through to the war room's
  // Results view — the active-auction poll drops it on the next reload).
  if (!auction) {
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

  return <BidRoom auction={auction} myAF={myAF} myFranchiseId={myFranchiseId} canBid={canBid} />;
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
  const joinAuction = useJoinAuction();
  const [bidErr, setBidErr] = useState<string | null>(null);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const currentLot = auction.currentLot;
  const iAmTop = !!currentLot && currentLot.currentBidderFranchiseId === myFranchiseId;
  const minNext = currentLot?.minNextBid ?? 0;

  // Brief "SOLD!" intermission after a lot closes — reconcile against server-clock skew the same
  // way the bid countdown does, then hold the celebratory card until it elapses.
  const intermissionLeft = useCountdown(
    auction.serverTime,
    auction.intermissionUntil ?? undefined,
    auction.status === "LIVE",
  );
  const inIntermission = intermissionLeft != null && intermissionLeft > 0;

  // Pre-bid REVIEW WINDOW: when a lot is nominated there's a brief pause (the auction's anti-snipe
  // seconds) where franchises can study the player but can't bid yet. `bidOpensAt` is
  // server-authoritative — reconcile it against serverTime the same way the bid countdown does.
  // Null (or already elapsed) means bidding is open. The 1s tick re-renders this room, so the block
  // lifts on its own the instant the window ends — polling just keeps bidOpensAt honest.
  const reviewLeft = useCountdown(
    auction.serverTime,
    currentLot?.bidOpensAt ?? undefined,
    auction.status === "LIVE",
  );
  const reviewing = reviewLeft != null && reviewLeft > 0;

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
          : reviewing
            ? `Bidding opens in ${reviewLeft}s — review the player`
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

  const onJoin = async () => {
    setJoinErr(null);
    try {
      await joinAuction.mutateAsync(auction.id);
    } catch (e) {
      setJoinErr(apiErrorMessage(e, "Couldn't join the auction."));
    }
  };

  // My won players, oldest first (player + price rows are lot-derived; per-franchise counts in the
  // standings rail come straight off AuctionFranchiseView.acquiredCount).
  const acquired = useMemo(
    () =>
      auction.lots
        .filter((l) => l.soldToFranchiseId === myFranchiseId)
        .sort((a, b) => a.lotOrder - b.lotOrder),
    [auction.lots, myFranchiseId],
  );

  // The most recently sold lot drives the SOLD intermission card.
  const justSold = useMemo(
    () =>
      auction.lots
        .filter((l) => l.status === "SOLD")
        .sort((a, b) => b.lotOrder - a.lotOrder)[0] ?? null,
    [auction.lots],
  );

  const queuedCount = auction.lots.filter((l) => l.status === "QUEUED").length;
  const soldCount = auction.lots.filter((l) => l.status === "SOLD").length;

  // ---- LOBBY / DRAFT: the hall, before bidding opens -----------------------
  if (auction.status === "LOBBY" || auction.status === "DRAFT") {
    return (
      <div>
        <WarStyles />
        <Lobby
          auction={auction}
          myAF={myAF}
          hallOpen={auction.status === "LOBBY"}
          onJoin={onJoin}
          joining={joinAuction.isPending}
          joinErr={joinErr}
        />
      </div>
    );
  }

  // ---- COMPLETED: calm results summary -------------------------------------
  if (auction.status === "COMPLETED") {
    return (
      <div>
        <WarStyles />
        <Results auction={auction} myAF={myAF} myFranchiseId={myFranchiseId} acquired={acquired} />
      </div>
    );
  }

  // ---- LIVE / PAUSED: the war room -----------------------------------------
  return (
    <div>
      <WarStyles />

      {/* top strip: identity + status + remaining */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px 20px",
          marginBottom: 20,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ ...eyebrow, color: SQ.red, letterSpacing: ".22em" }}>LIVE BIDDING ROOM</div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: "clamp(26px,4vw,44px)",
              lineHeight: 0.95,
              letterSpacing: "-.02em",
              marginTop: 8,
            }}
          >
            {auction.title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <StatusPill status={auction.status} />
          <RemainingChips queued={queuedCount} sold={soldCount} />
        </div>
      </div>

      {/* two columns on wide (sticky hero + scrolling rail), stacked on narrow */}
      <div className="sqar-grid">
        <div className="sqar-hero">
          <WalletBar af={myAF} />
          {inIntermission && justSold ? (
            <SoldCard lot={justSold} secondsLeft={intermissionLeft} />
          ) : currentLot ? (
            <HeroLot
              auction={auction}
              lot={currentLot}
              iAmTop={iAmTop}
              canBid={canBid}
              balance={myAF.balance}
              blockReason={bidBlockReason}
              reviewing={reviewing}
              reviewLeft={reviewLeft}
              pending={placeBid.isPending}
              bidErr={bidErr}
              onBid={submitBid}
              onCustom={() => setCustomOpen(true)}
            />
          ) : auction.status === "LIVE" && queuedCount === 0 ? (
            <IdleLot />
          ) : (
            <WaitingLot />
          )}
        </div>

        <aside className="sqar-rail">
          <StandingsRail auction={auction} myFranchiseId={myFranchiseId} />
          <AcquiredPanel acquired={acquired} />
          <RecentBidsPanel auction={auction} myTag={myAF.tag} />
        </aside>
      </div>

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

// ---- LOBBY -----------------------------------------------------------------

function Lobby({
  auction,
  myAF,
  hallOpen,
  onJoin,
  joining,
  joinErr,
}: {
  auction: AuctionView;
  myAF: AuctionFranchiseView;
  hallOpen: boolean;
  onJoin: () => void;
  joining: boolean;
  joinErr: string | null;
}) {
  const joinedCount = auction.franchises.filter((f) => f.joined).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatusPill status={auction.status} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>{auction.title}</div>
      </div>

      <div
        style={{
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 14,
          padding: "clamp(24px,5vw,44px)",
          textAlign: "center",
        }}
      >
        <div style={{ ...eyebrow, color: hallOpen ? SQ.green : SQ.amber, letterSpacing: ".22em" }}>
          {hallOpen ? "THE HALL IS OPEN" : "GET READY"}
        </div>

        {!hallOpen ? (
          <>
            <div style={{ fontFamily: FONT.display, fontSize: "clamp(26px,4vw,40px)", lineHeight: 1, marginTop: 12 }}>
              The room opens soon
            </div>
            <div style={{ fontSize: 13.5, color: SQ.mute, marginTop: 12, maxWidth: 440, marginInline: "auto", lineHeight: 1.5 }}>
              The league hasn&rsquo;t opened the hall yet. Hang tight — you&rsquo;ll be able to join the
              moment doors open.
            </div>
          </>
        ) : myAF.joined ? (
          <>
            <div style={{ fontFamily: FONT.display, fontSize: "clamp(26px,4vw,40px)", lineHeight: 1, marginTop: 12 }}>
              You&rsquo;re in the room
            </div>
            <div style={{ fontSize: 13.5, color: SQ.mute, marginTop: 12, maxWidth: 440, marginInline: "auto", lineHeight: 1.5 }}>
              Waiting for the admin to start the auction. Bidding opens the instant the first player hits
              the block.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: FONT.display, fontSize: "clamp(28px,4.4vw,46px)", lineHeight: 1, marginTop: 12 }}>
              Take your seat
            </div>
            <div style={{ fontSize: 13.5, color: SQ.mute, marginTop: 12, maxWidth: 440, marginInline: "auto", lineHeight: 1.5 }}>
              Join the hall so you&rsquo;re ready to bid the moment the first player is nominated.
            </div>
            <button
              type="button"
              onClick={onJoin}
              disabled={joining}
              className="sqar-cta"
              style={{
                marginTop: 22,
                fontFamily: FONT.mono,
                fontSize: 13,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "14px 30px",
                borderRadius: 8,
                cursor: joining ? "not-allowed" : "pointer",
                color: SQ.league,
                background: SQ.red,
                border: "none",
                opacity: joining ? 0.6 : 1,
              }}
            >
              {joining ? "Joining…" : "Join auction ▸"}
            </button>
            {joinErr ? (
              <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 12 }}>{joinErr}</div>
            ) : null}
          </>
        )}

        {auction.scheduledAt ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute, marginTop: 18 }}>
            Scheduled to open · {fmtWhen(auction.scheduledAt)}
          </div>
        ) : null}
      </div>

      {/* who has joined the hall */}
      <section style={{ marginTop: 28 }}>
        <div style={sectionTitle}>
          In the hall · {joinedCount}/{auction.franchises.length}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {auction.franchises.map((f, i) => (
            <div
              key={f.franchiseId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 0",
                borderTop: i === 0 ? "none" : `1px solid ${SQ.hairlineCell}`,
                opacity: f.joined ? 1 : 0.6,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ fontFamily: FONT.mono, fontSize: 12.5, fontWeight: 700, color: SQ.ink }}>{f.tag}</span>
                <span style={{ fontSize: 13, color: SQ.mute, marginLeft: 10 }}>{f.name}</span>
              </div>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  color: f.joined ? SQ.green : SQ.mute,
                  border: `1px solid ${f.joined ? SQ.green : SQ.inputBorder}`,
                  borderRadius: 999,
                  padding: "3px 10px",
                  whiteSpace: "nowrap",
                }}
              >
                {f.joined ? "● JOINED" : "○ NOT YET"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---- wallet bar (compact, pinned with the hero) ----------------------------

function WalletBar({ af }: { af: AuctionFranchiseView }) {
  const spent = af.budget - af.balance;
  const barPct = af.budget > 0 ? pct((af.balance / af.budget) * 100) : 0;
  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...eyebrow, letterSpacing: ".14em" }}>YOUR WALLET</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {af.name}
            {af.tag ? <span style={{ color: SQ.mute }}> · {af.tag}</span> : null}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT.display, fontSize: "clamp(24px,3.6vw,34px)", color: SQ.green, lineHeight: 0.95 }}>
            {money(af.balance)}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, marginTop: 4 }}>
            of {money(af.budget)} · {money(spent)} spent · {af.acquiredCount} won
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, height: 4, borderRadius: 3, background: SQ.track, overflow: "hidden" }}>
        <div style={{ width: `${barPct}%`, height: "100%", background: SQ.green }} />
      </div>
    </div>
  );
}

// ---- hero lot card + raise controls ----------------------------------------

function HeroLot({
  auction,
  lot,
  iAmTop,
  canBid,
  balance,
  blockReason,
  reviewing,
  reviewLeft,
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
  reviewing: boolean;
  reviewLeft: number | null;
  pending: boolean;
  bidErr: string | null;
  onBid: (amount: number) => void;
  onCustom: () => void;
}) {
  const remaining = useCountdown(auction.serverTime, lot.bidDeadline, auction.status === "LIVE");
  const showRaises = canBid && auction.status === "LIVE";
  // While the review window is open the bid-deadline clock may still tick, but keep it calm (amber,
  // no red final-seconds flash) — nothing is expiring for this franchise to act on until bids open.
  const timerColor: string = reviewing
    ? SQ.amber
    : remaining == null
      ? SQ.mute
      : remaining <= 5
        ? SQ.red
        : remaining <= 10
          ? SQ.amber
          : SQ.ink;
  const urgent = !reviewing && remaining != null && remaining <= 5 && auction.status === "LIVE";

  return (
    <div
      className={iAmTop ? "sqar-lead" : undefined}
      style={{
        background: SQ.panel,
        border: `1px solid ${iAmTop ? SQ.green : SQ.hairline}`,
        borderRadius: 14,
        padding: 22,
      }}
    >
      {/* review window: a calm amber strip while franchises study the player before bids open —
          deliberately distinct from the red final-seconds timer treatment. */}
      {reviewing ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
            padding: "12px 16px",
            borderRadius: 10,
            border: `1px solid ${SQ.amber}`,
            background: "rgba(181,131,26,.10)",
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".18em",
              fontWeight: 700,
              color: SQ.amber,
              whiteSpace: "nowrap",
            }}
          >
            ● REVIEW
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 12.5, color: SQ.amber }}>
            Bidding opens in {reviewLeft ?? 0}s — study the player
          </span>
        </div>
      ) : null}

      {/* identity + timer */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <div style={{ ...eyebrow, color: SQ.ember }}>ON THE BLOCK</div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: "clamp(30px,5vw,52px)",
              lineHeight: 0.92,
              marginTop: 8,
              wordBreak: "break-word",
            }}
          >
            {lot.gamerTag}
          </div>
          {lot.games.length > 0 ? (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {lot.games.map((g) => (
                <span
                  key={g}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: ".06em",
                    color: SQ.faint,
                    background: SQ.inset,
                    border: `1px solid ${SQ.hairline}`,
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* countdown clock */}
        <div style={{ textAlign: "center", minWidth: 92 }}>
          <div style={{ ...eyebrow, fontSize: 10, letterSpacing: ".16em" }}>TIMER</div>
          <div
            className={urgent ? "sqar-tick" : undefined}
            style={{
              fontFamily: FONT.display,
              fontSize: 48,
              lineHeight: 1,
              marginTop: 6,
              color: timerColor,
            }}
          >
            {auction.status === "PAUSED" ? "PAUSED" : remaining == null ? "—" : `${remaining}s`}
          </div>
        </div>
      </div>

      {/* current bid + who leads */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "10px 18px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ ...eyebrow, fontSize: 10, letterSpacing: ".1em" }}>CURRENT BID</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT.display, fontSize: 30, color: lot.currentBid > 0 ? SQ.ink : SQ.mute }}>
              {lot.currentBid > 0 ? money(lot.currentBid) : "—"}
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.mute }}>
              {lot.currentBidderTag ? `led by ${lot.currentBidderTag}` : "no bids yet"}
            </span>
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute, marginTop: 6 }}>
            Next bid must reach {money(lot.minNextBid)}
          </div>
        </div>
        {iAmTop ? (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11.5,
              letterSpacing: ".14em",
              color: SQ.green,
              border: `1px solid ${SQ.green}`,
              borderRadius: 7,
              padding: "7px 13px",
              whiteSpace: "nowrap",
            }}
          >
            ★ YOU LEAD
          </div>
        ) : null}
      </div>

      {/* expertise — condensed rows in a fixed-height, internally-scrollable strip, so the hero
          card height stays stable whether the player has 1 or 10 games on record. */}
      {lot.expertise.length > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${SQ.hairlineSoft}` }}>
          <div style={subLabel}>
            EXPERTISE{lot.expertise.length > 1 ? ` · ${lot.expertise.length} GAMES` : ""}
          </div>
          <div className="sqar-scroll" style={{ maxHeight: 104, display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
            {lot.expertise.map((e) => (
              <div key={e.game} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 88,
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.game}
                </span>
                <div style={{ flex: 1, minWidth: 40, height: 6, borderRadius: 4, background: SQ.track, overflow: "hidden" }}>
                  <div style={{ width: `${pct(e.rating)}%`, height: "100%", background: SQ.blue }} />
                </div>
                <span style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.faint, width: 28, textAlign: "right", flexShrink: 0 }}>
                  {Math.round(e.rating)}
                </span>
                {e.handle ? (
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      color: SQ.mute,
                      maxWidth: 96,
                      flexShrink: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    @{e.handle}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {lot.contact ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, marginTop: 12 }}>
          Contact · {lot.contact}
        </div>
      ) : null}

      {/* raise controls */}
      {showRaises ? (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${SQ.hairlineSoft}` }}>
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
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${SQ.hairlineSoft}` }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.amber }}>
            {blockReason ?? "Bidding isn't open right now."}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- SOLD intermission card ------------------------------------------------

function SoldCard({ lot, secondsLeft }: { lot: AuctionLotView; secondsLeft: number | null }) {
  return (
    <div
      className="sqar-sold"
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.green}`,
        borderRadius: 14,
        padding: "clamp(26px,5vw,44px) 22px",
        textAlign: "center",
        boxShadow: "0 0 0 1px var(--sq-green) inset",
      }}
    >
      <div
        className="sqar-badge"
        style={{
          display: "inline-block",
          fontFamily: FONT.display,
          fontSize: "clamp(40px,8vw,72px)",
          lineHeight: 0.9,
          letterSpacing: "-.02em",
          color: SQ.green,
        }}
      >
        SOLD!
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: "clamp(24px,4vw,40px)", lineHeight: 1, marginTop: 16, wordBreak: "break-word" }}>
        {lot.gamerTag}
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".08em", color: SQ.mute, marginTop: 14 }}>
        WON BY
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: "clamp(20px,3.4vw,30px)", marginTop: 4, color: SQ.ember }}>
        {lot.soldToTag ?? "—"}
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: "clamp(26px,4.6vw,40px)", color: SQ.green, marginTop: 12 }}>
        {money(lot.soldPrice)}
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 18 }}>
        {secondsLeft != null && secondsLeft > 0 ? `Next player in ${secondsLeft}s…` : "Next player incoming…"}
      </div>
    </div>
  );
}

// ---- between-lots / idle hero states ---------------------------------------

function WaitingLot() {
  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px dashed ${SQ.inputBorder}`,
        borderRadius: 14,
        padding: "clamp(30px,6vw,52px) 22px",
        textAlign: "center",
      }}
    >
      <div style={{ ...eyebrow, color: SQ.ember, letterSpacing: ".2em" }}>STANDING BY</div>
      <div style={{ fontFamily: FONT.display, fontSize: "clamp(22px,3.6vw,32px)", lineHeight: 1, marginTop: 12 }}>
        Next player incoming
      </div>
      <div style={{ fontSize: 13, color: SQ.mute, marginTop: 12, maxWidth: 360, marginInline: "auto", lineHeight: 1.5 }}>
        Bidding opens the moment the auctioneer nominates the next player. Keep your eyes on the block.
      </div>
    </div>
  );
}

function IdleLot() {
  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px dashed ${SQ.inputBorder}`,
        borderRadius: 14,
        padding: "clamp(30px,6vw,52px) 22px",
        textAlign: "center",
      }}
    >
      <div style={{ ...eyebrow, color: SQ.amber, letterSpacing: ".2em" }}>ALL LOTS DONE</div>
      <div style={{ fontFamily: FONT.display, fontSize: "clamp(22px,3.6vw,32px)", lineHeight: 1, marginTop: 12 }}>
        Waiting for the admin
      </div>
      <div style={{ fontSize: 13, color: SQ.mute, marginTop: 12, maxWidth: 380, marginInline: "auto", lineHeight: 1.5 }}>
        Every player has been through the block. The admin is deciding whether to re-auction unsold
        players or wrap up. Review the standings while you wait.
      </div>
    </div>
  );
}

// ---- COMPLETED results -----------------------------------------------------

function Results({
  auction,
  myAF,
  myFranchiseId,
  acquired,
}: {
  auction: AuctionView;
  myAF: AuctionFranchiseView;
  myFranchiseId: string;
  acquired: AuctionLotView[];
}) {
  const spent = myAF.budget - myAF.balance;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <StatusPill status={auction.status} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>{auction.title}</div>
      </div>
      <div style={{ ...eyebrow, color: SQ.green, letterSpacing: ".22em" }}>AUCTION COMPLETE</div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: "clamp(30px,5vw,52px)",
          lineHeight: 0.92,
          letterSpacing: "-.02em",
          marginTop: 8,
        }}
      >
        Your final squad
      </div>

      <div className="sqar-grid" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <WalletBar af={myAF} />
          <div
            style={{
              background: SQ.panel,
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={sectionTitle}>Players you won · {money(spent)} spent</div>
            {acquired.length === 0 ? (
              <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute }}>
                You didn&rsquo;t win any players this auction.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {acquired.map((l, i) => (
                  <div
                    key={l.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 0",
                      borderTop: i === 0 ? "none" : `1px solid ${SQ.hairlineCell}`,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.gamerTag}
                    </span>
                    <span style={{ fontFamily: FONT.mono, fontSize: 13, color: SQ.green, whiteSpace: "nowrap" }}>
                      {money(l.soldPrice)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="sqar-rail">
          <StandingsRail auction={auction} myFranchiseId={myFranchiseId} title="Final standings" />
        </aside>
      </div>
    </div>
  );
}

// ---- franchise standings rail ----------------------------------------------

function StandingsRail({
  auction,
  myFranchiseId,
  title = "Franchise standings",
}: {
  auction: AuctionView;
  myFranchiseId: string;
  title?: string;
}) {
  const topBidderId = auction.currentLot?.currentBidderFranchiseId;
  const rows = useMemo(
    () =>
      [...auction.franchises].sort(
        (a, b) => b.acquiredCount - a.acquiredCount || (b.budget - b.balance) - (a.budget - a.balance),
      ),
    [auction.franchises],
  );

  return (
    <section
      className="sqar-panel"
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 12,
        padding: "16px 16px 6px",
      }}
    >
      <div style={sectionTitle}>{title}</div>
      <div className="sqar-scroll" style={{ maxHeight: 300, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((f) => {
          const isMe = f.franchiseId === myFranchiseId;
          const isTop = topBidderId != null && f.franchiseId === topBidderId;
          const spent = f.budget - f.balance;
          const barPct = f.budget > 0 ? pct((f.balance / f.budget) * 100) : 0;
          return (
            <div
              key={f.franchiseId}
              style={{
                padding: "9px 11px",
                borderRadius: 8,
                border: `1px solid ${isMe ? SQ.green : isTop ? SQ.ember : SQ.hairlineCell}`,
                background: isMe ? "rgba(31,157,99,.08)" : isTop ? "rgba(232,96,44,.08)" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  {isTop ? (
                    <span className="sqar-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: SQ.ember, flexShrink: 0 }} />
                  ) : null}
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 12,
                      fontWeight: 700,
                      color: isMe ? SQ.green : SQ.ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.tag}
                    {isMe ? <span style={{ color: SQ.mute, fontWeight: 400 }}> · you</span> : null}
                  </span>
                </div>
                <span style={{ fontFamily: FONT.mono, fontSize: 12.5, color: SQ.ink, whiteSpace: "nowrap" }}>
                  {money(f.balance)}
                </span>
              </div>
              <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: SQ.track, overflow: "hidden" }}>
                <div style={{ width: `${barPct}%`, height: "100%", background: isMe ? SQ.green : SQ.mute }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: FONT.mono, fontSize: 9.5, color: SQ.mute }}>
                <span>{f.acquiredCount} won</span>
                <span>{money(spent)} spent</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- recent bids feed ------------------------------------------------------

function RecentBidsPanel({ auction, myTag }: { auction: AuctionView; myTag: string }) {
  if (auction.recentBids.length === 0) return null;
  return (
    <section
      className="sqar-panel"
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 12,
        padding: "16px 16px 4px",
      }}
    >
      <div style={sectionTitle}>Recent bids</div>
      <div className="sqar-scroll" style={{ maxHeight: 220, display: "flex", flexDirection: "column", gap: 0 }}>
        {auction.recentBids.slice(0, 12).map((b, i) => {
          const isMine = b.franchiseTag === myTag;
          return (
            <div
              key={`${b.lotId}-${b.at}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 0",
                borderTop: i === 0 ? "none" : `1px solid ${SQ.hairlineCell}`,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12.5,
                  color: SQ.faint,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontWeight: 700, color: isMine ? SQ.ember : SQ.ink }}>{b.franchiseTag}</span>
                <span style={{ color: SQ.mute }}> on </span>
                {b.playerGamerTag}
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ink, whiteSpace: "nowrap" }}>{money(b.amount)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- my acquired players (rail) --------------------------------------------

function AcquiredPanel({ acquired }: { acquired: AuctionLotView[] }) {
  return (
    <section
      className="sqar-panel"
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 12,
        padding: "16px 16px 6px",
      }}
    >
      <div style={sectionTitle}>My acquired players</div>
      {acquired.length === 0 ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.mute, paddingBottom: 10 }}>
          You haven&rsquo;t won any players yet.
        </div>
      ) : (
        <div className="sqar-scroll" style={{ maxHeight: 200, display: "flex", flexDirection: "column", gap: 0 }}>
          {acquired.map((l, i) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 0",
                borderTop: i === 0 ? "none" : `1px solid ${SQ.hairlineCell}`,
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.gamerTag}
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 12.5, color: SQ.green, whiteSpace: "nowrap" }}>{money(l.soldPrice)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- remaining counter -----------------------------------------------------

function RemainingChips({ queued, sold }: { queued: number; sold: number }) {
  const chip = (n: number, label: string, color: string): React.ReactNode => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        fontFamily: FONT.mono,
        fontSize: 10,
        letterSpacing: ".12em",
        color: SQ.mute,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 999,
        padding: "4px 11px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{n}</span>
      {label}
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {chip(queued, "LEFT", SQ.ink)}
      {chip(sold, "SOLD", SQ.green)}
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

const STATUS_COLOR: Record<AuctionView["status"], string> = {
  LIVE: SQ.red,
  PAUSED: SQ.amber,
  LOBBY: SQ.blue,
  DRAFT: SQ.mute,
  COMPLETED: SQ.green,
};

function StatusPill({ status }: { status: AuctionView["status"] }) {
  const color = STATUS_COLOR[status];
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

/** Local, self-contained keyframes for the war room (no external animation libs). */
function WarStyles() {
  return (
    <style>{`
      /* Desktop: a fixed, near-viewport-height dashboard. The hero column keeps the live lot +
         bidding pinned; the rail is bounded to the viewport and hands its height to its panels,
         each of which scrolls internally instead of pushing the page down. */
      .sqar-grid { display: grid; grid-template-columns: minmax(0,1.6fr) minmax(288px,1fr); gap: 22px; align-items: start; }
      .sqar-hero { position: sticky; top: 84px; align-self: start; display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; }
      .sqar-rail { position: sticky; top: 84px; align-self: start; display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; max-height: calc(100vh - 104px); }
      /* A rail panel: fixed header + a scroll region that absorbs any overflow. min-height:0 lets it
         shrink below its content so the inner list — not the page — is what scrolls. */
      .sqar-panel { display: flex; flex-direction: column; min-height: 0; overflow: hidden; flex: 0 1 auto; }
      .sqar-scroll { overflow-y: auto; min-height: 0; flex: 1 1 auto; }
      @media (max-width: 920px) {
        .sqar-grid { grid-template-columns: 1fr; }
        .sqar-hero { position: static; top: auto; }
        /* Narrow screens stack and scroll normally; panels keep their own bounded lists. */
        .sqar-rail { position: static; top: auto; max-height: none; }
      }
      @keyframes sqar-soldin { 0% { transform: scale(.92); opacity: 0; } 60% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes sqar-badge { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      @keyframes sqar-lead { 0%, 100% { box-shadow: 0 0 0 1px var(--sq-green) inset, 0 0 0 0 rgba(31,157,99,0); } 50% { box-shadow: 0 0 0 1px var(--sq-green) inset, 0 0 22px 2px rgba(31,157,99,.32); } }
      @keyframes sqar-tick { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
      @keyframes sqar-dot { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
      .sqar-sold { animation: sqar-soldin .5s cubic-bezier(.2,.8,.2,1) both; }
      .sqar-badge { animation: sqar-badge 1s ease-in-out infinite; }
      .sqar-lead { animation: sqar-lead 1.8s ease-in-out infinite; }
      .sqar-tick { display: inline-block; animation: sqar-tick 1s ease-in-out infinite; }
      .sqar-dot { animation: sqar-dot 1.1s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .sqar-sold, .sqar-badge, .sqar-lead, .sqar-tick, .sqar-dot { animation: none; }
      }
    `}</style>
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
