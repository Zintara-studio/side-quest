import type { Metadata } from "next";
import { HistoryScreen } from "@/components/admin/screens/history";

export const metadata: Metadata = { title: "History" };

export default function AdminHistoryPage() {
  return <HistoryScreen />;
}
