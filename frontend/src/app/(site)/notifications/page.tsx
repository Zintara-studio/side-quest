import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/sidequest/screens/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
