import type { Metadata } from "next";
import { RulesScreen } from "@/components/sidequest/screens/rules";

export const metadata: Metadata = { title: "Rules & Fair Play" };

export default function RulesPage() {
  return <RulesScreen />;
}
