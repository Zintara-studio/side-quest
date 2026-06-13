import type { Metadata } from "next";
import { ResultScreen } from "@/components/admin/screens/result";

export const metadata: Metadata = { title: "Result Entry" };

export default function AdminResultPage() {
  return <ResultScreen />;
}
