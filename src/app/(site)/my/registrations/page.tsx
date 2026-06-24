import type { Metadata } from "next";
import { MyRegistrationsScreen } from "@/components/sidequest/screens/my-registrations";

export const metadata: Metadata = { title: "My Team" };

export default function MyRegistrationsPage() {
  return <MyRegistrationsScreen />;
}
