import type { Metadata } from "next";
import { RegistrationsScreen } from "@/components/admin/screens/registrations";

export const metadata: Metadata = { title: "Registrations" };

export default function AdminRegistrationsPage() {
  return <RegistrationsScreen />;
}
