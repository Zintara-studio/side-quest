import type { Metadata } from "next";
import { FranchisesScreen } from "@/components/sidequest/screens/franchises";

export const metadata: Metadata = { title: "Franchises" };

export default function LeagueFranchisesPage() {
  return <FranchisesScreen />;
}
