import type { Metadata } from "next";
import { MatchScreen } from "@/components/sidequest/screens/match";

export const metadata: Metadata = { title: "Match Details" };

export default function LeagueMatchPage() {
  return <MatchScreen />;
}
