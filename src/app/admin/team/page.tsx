import type { Metadata } from "next";
import { TeamScreen } from "@/components/admin/screens/team";

export const metadata: Metadata = { title: "Admins" };

export default function AdminTeamPage() {
  return <TeamScreen />;
}
