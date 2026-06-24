import type { Metadata } from "next";
import { RegisterScreen } from "@/components/sidequest/screens/register";

export const metadata: Metadata = { title: "Register" };

export default async function LeagueRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ announcement?: string }>;
}) {
  const sp = await searchParams;
  return <RegisterScreen announcementId={sp.announcement} />;
}
