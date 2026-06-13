const sponsors = [
  "RIOT", "VALVE", "ESL", "BLAST", "KRAFTON", "RAZER", "LOGITECH",
  "REDBULL", "INTEL", "NVIDIA", "MONSTER", "HYPERX",
];

export function Sponsors() {
  return (
    <section className="border-y border-white/[0.05] bg-gradient-to-b from-transparent via-bg-raised/50 to-transparent py-10">
      <div className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-ink-dim">
          Powering the world's biggest leagues
        </p>
        <div className="relative mt-6 overflow-hidden mask-fade-r">
          <div className="flex w-max animate-marquee gap-12">
            {[...sponsors, ...sponsors].map((s, i) => (
              <span
                key={`${s}-${i}`}
                className="font-display text-2xl font-bold tracking-[0.2em] text-ink-dim opacity-70 transition-colors hover:text-ink"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
