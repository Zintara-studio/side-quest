import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-2.5 select-none",
        className,
      )}
      aria-label="Esports Arena home"
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        <span className="absolute inset-0 rounded-lg bg-neon-gradient opacity-90 blur-[1px] transition-all group-hover:opacity-100 group-hover:blur-sm" />
        <svg
          viewBox="0 0 24 24"
          className="relative h-5 w-5 text-black"
          fill="currentColor"
          aria-hidden
        >
          <path d="M3 6.5 12 2l9 4.5v11L12 22 3 17.5v-11Zm9-2.2L5.5 7.5v9L12 19.7l6.5-3.2v-9L12 4.3Zm0 4.2 4 2v4l-4 2-4-2v-4l4-2Z" />
        </svg>
      </span>
      {showText && (
        <span className="font-display text-base font-bold tracking-tight">
          <span className="text-ink">ESPORTS</span>
          <span className="text-gradient">/ARENA</span>
        </span>
      )}
    </Link>
  );
}
