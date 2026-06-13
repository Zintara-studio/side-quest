import type { Metadata } from "next";
import { TwoFactorForm } from "@/components/sidequest/auth/two-factor-form";

export const metadata: Metadata = { title: "Verify code" };

export default function TwoFactorPage() {
  return <TwoFactorForm />;
}
