import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/sidequest/screens/notifications";

export const metadata: Metadata = { title: "Notifications" };

// Admins get the same notifications list (franchise proposals, disputes raised, …), rendered inside the
// admin shell so they don't get bounced to the public site.
export default function AdminNotificationsPage() {
  return <NotificationsScreen />;
}
