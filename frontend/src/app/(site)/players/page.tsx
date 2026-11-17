import type { Metadata } from "next";
import { PlayersScreen } from "@/components/sidequest/screens/players";

export const metadata: Metadata = { title: "Players" };

export default function LeaguePlayersPage() {
  return <PlayersScreen />;
}
