import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatRelative(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const m = 60_000,
    h = 3_600_000,
    d = 86_400_000;
  const sign = ms > 0 ? "in " : "";
  const suffix = ms > 0 ? "" : " ago";
  if (abs < m) return `${sign}${Math.round(abs / 1000)}s${suffix}`;
  if (abs < h) return `${sign}${Math.round(abs / m)}m${suffix}`;
  if (abs < d) return `${sign}${Math.round(abs / h)}h${suffix}`;
  return `${sign}${Math.round(abs / d)}d${suffix}`;
}

export function initials(name: string) {
  return name
    .split(/\s|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
