import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-white/[0.04]",
        "before:absolute before:inset-0",
        "before:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)]",
        "before:bg-[length:200%_100%] before:animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}
