"use client";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export function PlayerRadar({
  data,
}: {
  data: { stat: string; value: number; full?: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
          />
          <PolarRadiusAxis
            tick={{ fill: "#6B7280", fontSize: 9 }}
            angle={90}
            domain={[0, 100]}
          />
          <Radar
            name="player"
            dataKey="value"
            stroke="#00E5FF"
            fill="#00E5FF"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
