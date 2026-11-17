"use client";

// App-wide client providers: TanStack Query (server-state cache) + the auth session context.
// Mounted once in the root layout so every route can use React Query hooks and useAuth().
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/context";
import { OnboardingGuard } from "@/components/sidequest/onboarding-guard";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnboardingGuard />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
