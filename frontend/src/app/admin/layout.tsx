import type { Metadata } from "next";
import { Archivo, Archivo_Black, Spline_Sans_Mono } from "next/font/google";
import { AdminShell } from "@/components/admin/admin-shell";

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
    default: "Admin · Side Quest",
    template: "%s · Side Quest Admin",
  },
  description: "Side Quest league control room — fixtures, results, registrations, and settings.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell
      fontClass={`${archivo.variable} ${archivoBlack.variable} ${splineMono.variable}`}
    >
      {children}
    </AdminShell>
  );
}
