import type { Metadata } from "next";
import { RegisterScreen } from "@/components/sidequest/screens/register";

export const metadata: Metadata = { title: "Register" };

export default function LeagueRegisterPage() {
  return <RegisterScreen />;
}
