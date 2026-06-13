import { Logo } from "@/components/layout/logo";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate min-h-[calc(100vh-4rem)]">
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 bg-radial-glow blur-3xl" />

      <div className="container relative grid min-h-[calc(100vh-4rem)] items-center gap-10 py-10 lg:grid-cols-2">
        <div className="hidden lg:block">
          <Logo />
          <h1 className="mt-10 font-display text-5xl font-bold leading-[1.05] tracking-tight">
            <span className="text-ink">Step into the</span>
            <br />
            <span className="text-gradient">arena.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-ink-muted">
            Sign in to manage your franchise, follow your favorite players, and
            join live auctions. Built for fans, operators, and pros alike.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3">
            {[
              ["1.2M+", "Players tracked"],
              ["480+", "Live tournaments"],
              ["$58M", "Prize pool"],
              ["98%", "Uptime SLA"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <p className="stat-num text-2xl font-bold text-ink">{v}</p>
                <p className="text-[11px] uppercase tracking-widest text-ink-dim">
                  {l}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-ink-dim">
            By continuing you agree to our{" "}
            <Link href="/" className="underline-offset-2 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/" className="underline-offset-2 hover:underline">
              Privacy policy
            </Link>
            .
          </p>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-2 rounded-3xl bg-neon-gradient opacity-20 blur-xl" />
          <div className="panel relative p-7 md:p-9">{children}</div>
        </div>
      </div>
    </div>
  );
}
