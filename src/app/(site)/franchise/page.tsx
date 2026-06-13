import type { Metadata } from "next";
import { FranchiseScreen } from "@/components/sidequest/screens/franchise";

export const metadata: Metadata = { title: "RXG — Franchise Details" };

export default function LeagueFranchisePage() {
  return <FranchiseScreen />;
}
