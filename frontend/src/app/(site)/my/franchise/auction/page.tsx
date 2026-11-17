import type { Metadata } from "next";
import { AuctionBidScreen } from "@/components/sidequest/screens/auction-bid";

export const metadata: Metadata = { title: "Auction" };

export default function AuctionBidPage() {
  return <AuctionBidScreen />;
}
