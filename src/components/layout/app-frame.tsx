"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./top-nav";
import { MobileNav } from "./mobile-nav";
import { Footer } from "./footer";

/**
 * Wraps the app chrome (top nav, footer, mobile nav). The admin control room
 * (`/admin/*`) is a self-contained product with its own sidebar shell, so the
 * global chrome is suppressed there.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-neon-electric focus:px-3 focus:py-1.5 focus:text-black"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main" className="pb-24 md:pb-12">
        {children}
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
