import type { Metadata } from "next";
import { AdminProfileScreen } from "@/components/admin/screens/profile";

export const metadata: Metadata = { title: "Profile" };

export default function AdminProfilePage() {
  return <AdminProfileScreen />;
}
