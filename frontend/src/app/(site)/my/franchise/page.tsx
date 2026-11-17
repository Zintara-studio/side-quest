import type { Metadata } from "next";
import { MyFranchiseScreen } from "@/components/sidequest/screens/my-franchise";

export const metadata: Metadata = { title: "My Franchise" };

export default function MyFranchisePage() {
  return <MyFranchiseScreen />;
}
