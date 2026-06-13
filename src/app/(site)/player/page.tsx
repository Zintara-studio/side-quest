import type { Metadata } from "next";
import { PlayerScreen } from "@/components/sidequest/screens/player";

export const metadata: Metadata = { title: "Raghavan · Player Profile" };

export default function LeaguePlayerPage() {
  return <PlayerScreen />;
}
