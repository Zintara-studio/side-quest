import type { Metadata } from "next";
import { DisputesScreen } from "@/components/admin/screens/disputes";

export const metadata: Metadata = { title: "Disputes" };

export default function AdminDisputesPage() {
  return <DisputesScreen />;
}
