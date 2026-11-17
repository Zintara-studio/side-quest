import type { Metadata } from "next";
import { PlayerScreen } from "@/components/sidequest/screens/player";

export const metadata: Metadata = { title: "Player" };

export default async function AdminPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerScreen id={id} base="/admin" />;
}
