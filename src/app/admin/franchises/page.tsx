import type { Metadata } from "next";
import { FranchisesScreen } from "@/components/admin/screens/franchises";

export const metadata: Metadata = { title: "Franchises" };

export default function AdminFranchisesPage() {
  return <FranchisesScreen />;
}
