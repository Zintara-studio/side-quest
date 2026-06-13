import type { Metadata } from "next";
import { GamesScreen } from "@/components/sidequest/screens/games";

export const metadata: Metadata = { title: "Supported Games" };

export default function LeagueGamesPage() {
  return <GamesScreen />;
}
