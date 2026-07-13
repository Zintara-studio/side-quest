import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/sidequest/screens/onboarding";

export const metadata: Metadata = { title: "Complete your account" };

// Standalone (no nav shell): a first-time SSO user must finish here before entering the app.
export default function OnboardingPage() {
  return <OnboardingScreen />;
}
