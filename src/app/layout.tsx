import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

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
    "Side Quest Season 04 — franchise standings, matchdays, supported games, players, registration, and the league control room.",
  applicationName: "Side Quest",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0E0F13",
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
      className={`${archivo.variable} ${archivoBlack.variable} ${splineMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
