import type { Metadata } from "next";
import { AnnouncementsScreen } from "@/components/sidequest/screens/announcements";

export const metadata: Metadata = { title: "Announcements" };

export default function LeagueAnnouncementsPage() {
  return <AnnouncementsScreen />;
}
