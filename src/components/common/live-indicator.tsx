import { cn } from "@/lib/utils";

export function LiveIndicator({
  label = "LIVE",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-neon-red/50 bg-neon-red/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-neon-red",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-neon-red/70" />
        <span className="relative h-2 w-2 rounded-full bg-neon-red" />
      </span>
      {label}
    </span>
  );
}
