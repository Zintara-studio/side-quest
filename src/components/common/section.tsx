import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Section({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "View all",
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-12 md:py-16", className)}>
      <div className="container">
        {(title || eyebrow) && (
          <div className="mb-8 flex flex-col gap-2 md:mb-10 md:flex-row md:items-end md:justify-between">
            <div>
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neon-electric">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-2 max-w-2xl text-sm text-ink-muted md:text-base">
                  {description}
                </p>
              )}
            </div>
            {href && (
              <Link
                href={href}
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-neon-electric transition-colors"
              >
                {hrefLabel}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
