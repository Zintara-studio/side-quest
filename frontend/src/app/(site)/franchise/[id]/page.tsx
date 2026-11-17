import type { Metadata } from "next";
import { FranchiseScreen } from "@/components/sidequest/screens/franchise";

export const metadata: Metadata = { title: "Franchise" };

export default async function FranchiseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FranchiseScreen id={id} />;
}
