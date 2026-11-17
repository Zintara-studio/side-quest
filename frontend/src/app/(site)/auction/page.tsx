import type { Metadata } from "next";
import { AuctionBidScreen } from "@/components/sidequest/screens/auction-bid";

export const metadata: Metadata = { title: "Auction" };

// Public-facing spectator entry: the same board as /my/franchise/auction, but AuctionBidScreen renders
// it read-only for anyone without a participating franchise seat.
export default function AuctionWatchPage() {
  return <AuctionBidScreen />;
}
