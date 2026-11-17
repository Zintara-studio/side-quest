import type { Metadata } from "next";
import { FranchiseScreen } from "@/components/sidequest/screens/franchise";

export const metadata: Metadata = { title: "Franchise" };

export default function LeagueFranchisePage() {
  return <FranchiseScreen />;
}
