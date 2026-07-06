"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { SQ, FONT } from "@/components/sidequest/tokens";
import type { AuthResponse } from "@/lib/api/types";

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    const payload = searchParams.get("payload");
    const error = searchParams.get("error");

    if (error) {
      router.replace(`/login?error=${error}`);
      return;
    }

    if (payload) {
      try {
        const decodedStr = Buffer.from(payload, "base64").toString("utf-8");
        const authData = JSON.parse(decodedStr) as AuthResponse;
        
        // Hydrate the Zustand store
        setSession(authData);

        // Redirect based on role
        if (authData.user.role === "ADMIN") {
          router.replace("/admin");
        } else {
          router.replace("/");
        }
      } catch (err) {
        console.error("Failed to parse auth payload:", err);
        router.replace("/login?error=invalid_payload");
      }
    } else {
      router.replace("/login");
    }
  }, [router, searchParams, setSession]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 40 }}>
      <div style={{ width: 24, height: 24, border: `2px solid ${SQ.ember}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.mute, letterSpacing: ".1em", textTransform: "uppercase" }}>
        Authenticating...
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
