import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Twitch } from "lucide-react";

export function CTA() {
  return (
    <section className="container py-20">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-bg-panel p-10 md:p-16">
        <div className="absolute inset-0 grid-overlay opacity-40" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[1200px] -translate-x-1/2 bg-radial-glow blur-2xl" />
        <div className="relative text-center">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight text-ink md:text-6xl">
            Run your league. Sign your stars.<br />
            <span className="text-gradient">Win the season.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm text-ink-muted md:text-base">
            From sign-up to championship — every tool a modern franchise needs,
            on one platform. Free for fans, generous for organizations.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline">
              <Twitch className="h-4 w-4" /> Watch live now
            </Button>
            <Button size="lg" variant="ghost">
              <Github className="h-4 w-4" /> Developer API
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
