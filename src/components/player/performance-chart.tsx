"use client";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { seededRandom } from "@/lib/utils";

export function PerformanceChart({ seed = 7 }: { seed?: number }) {
  const rand = seededRandom(seed);
  const data = Array.from({ length: 12 }, (_, i) => ({
    week: `W${i + 1}`,
    rating: +(0.9 + rand() * 0.6).toFixed(2),
    impact: +(0.7 + rand() * 0.55).toFixed(2),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="g-rating" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-impact" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: "#6B7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#6B7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(11,13,20,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
              color: "#E5E7EB",
            }}
            cursor={{ stroke: "rgba(0,229,255,0.3)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="rating"
            stroke="#00E5FF"
            strokeWidth={2}
            fill="url(#g-rating)"
          />
          <Area
            type="monotone"
            dataKey="impact"
            stroke="#A855F7"
            strokeWidth={2}
            fill="url(#g-impact)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
