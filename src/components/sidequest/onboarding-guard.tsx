"use client";

// Forces a not-yet-onboarded SSO account to finish onboarding before using any other page. Mounted
// once (in Providers) so it covers the public site, the admin console, and the auth pages uniformly.
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

// The only path an onboarding-required account may sit on.
const ALLOWED = "/onboarding";

export function OnboardingGuard() {
  const { onboardingRequired, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Wait for the session to hydrate so we don't bounce a returning user mid-refresh.
    if (!hydrated || !onboardingRequired) return;
    if (pathname !== ALLOWED) router.replace(ALLOWED);
  }, [hydrated, onboardingRequired, pathname, router]);

  return null;
}
