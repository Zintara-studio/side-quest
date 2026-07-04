import { Suspense } from "react";
import type { Metadata } from "next";
import { SQ, FONT } from "@/components/admin/tokens";
import { ResultScreen } from "@/components/admin/screens/result";

export const metadata: Metadata = { title: "Result Entry" };

export default function AdminResultPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "40px 0",
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".08em",
            color: SQ.mute,
          }}
        >
          Loading result entry…
        </div>
      }
    >
      <ResultScreen />
    </Suspense>
  );
}
