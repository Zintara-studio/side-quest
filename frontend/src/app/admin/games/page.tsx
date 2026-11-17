import type { Metadata } from "next";
import { GamesScreen } from "@/components/admin/screens/games";

export const metadata: Metadata = { title: "Games" };

export default function AdminGamesPage() {
  return <GamesScreen />;
}
