import type { Metadata } from "next";
import { MatchesScreen } from "@/components/admin/screens/matches";

export const metadata: Metadata = { title: "Matches" };

export default function AdminMatchesPage() {
  return <MatchesScreen />;
}
