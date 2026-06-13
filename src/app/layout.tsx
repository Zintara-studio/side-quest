import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/layout/app-frame";
import { QueryProvider } from "@/providers/query-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Esports Arena — The future of competitive gaming",
    template: "%s · Esports Arena",
  },
  description:
    "Multi-game tournaments, franchises, live auctions, rankings, and analytics. The infrastructure layer for modern esports.",
  applicationName: "Esports Arena",
  keywords: [
    "esports",
    "tournaments",
    "valorant",
    "cs2",
    "bgmi",
    "dota 2",
    "franchises",
    "auction",
  ],
  authors: [{ name: "Esports Arena" }],
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#05060A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${mono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <AppFrame>{children}</AppFrame>
        </QueryProvider>
      </body>
    </html>
  );
}
