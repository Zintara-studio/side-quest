import type { Metadata } from "next";
import { AuctionScreen } from "@/components/admin/screens/auction";

export const metadata: Metadata = { title: "Auction" };

export default function AdminAuctionPage() {
  return <AuctionScreen />;
}
