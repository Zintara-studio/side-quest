import type { Metadata } from "next";
import { ForgotForm } from "@/components/sidequest/auth/forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
