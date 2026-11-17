import type { Metadata } from "next";
import { AnnouncementsScreen } from "@/components/admin/screens/announcements";

export const metadata: Metadata = { title: "Announcements" };

export default function AdminAnnouncementsPage() {
  return <AnnouncementsScreen />;
}
