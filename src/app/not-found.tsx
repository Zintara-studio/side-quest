import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink-dim">
        404 · Match not found
      </p>
      <h1 className="mt-4 font-display text-6xl font-bold tracking-tight md:text-8xl">
        <span className="text-gradient">Off the map.</span>
      </h1>
      <p className="mt-4 max-w-md text-sm text-ink-muted">
        We couldn't find that page. It may have been re-bracketed, transferred,
        or never existed.
      </p>
      <div className="mt-7 flex gap-3">
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/leaderboards">Open rankings</Link>
        </Button>
      </div>
    </section>
  );
}
