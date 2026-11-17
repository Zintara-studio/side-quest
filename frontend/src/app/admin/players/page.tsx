import type { Metadata } from "next";
import { PlayersScreen } from "@/components/admin/screens/players";

export const metadata: Metadata = { title: "Players" };

export default function AdminPlayersPage() {
  return <PlayersScreen />;
}
