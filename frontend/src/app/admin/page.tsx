import type { Metadata } from "next";
import { OverviewScreen } from "@/components/admin/screens/overview";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return <OverviewScreen />;
}
