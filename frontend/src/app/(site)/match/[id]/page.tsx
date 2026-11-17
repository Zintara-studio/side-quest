import type { Metadata } from "next";
import { MatchScreen } from "@/components/sidequest/screens/match";

export const metadata: Metadata = { title: "Match" };

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchScreen id={id} />;
}
