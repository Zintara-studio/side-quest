import type { Metadata } from "next";
import { Archivo, Archivo_Black, Spline_Sans_Mono } from "next/font/google";
import { LeagueShell } from "@/components/sidequest/league-shell";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sq-sans",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sq-display",
  display: "swap",
});
const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sq-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Side Quest — Community Esports League",
    template: "%s · Side Quest",
  },
  description:
    "Side Quest — franchise standings, matchdays, supported games, players, and registration.",
};

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return (
    <LeagueShell
      fontClass={`${archivo.variable} ${archivoBlack.variable} ${splineMono.variable}`}
    >
      {children}
    </LeagueShell>
  );
}
