"use client";
import { franchises } from "@/lib/mock/franchises";

type Handler = (...args: any[]) => void;

class MockSocket {
  private listeners = new Map<string, Set<Handler>>();
  private timers: ReturnType<typeof setInterval>[] = [];

  on(event: string, handler: Handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }
  off(event: string, handler: Handler) {
    this.listeners.get(event)?.delete(handler);
  }
  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((h) => h(...args));
  }

  start() {
    this.stop();
    // simulated bids every 2-5s
    const bidTick = () => {
      const f = franchises[Math.floor(Math.random() * franchises.length)];
      const increment = 25_000 + Math.floor(Math.random() * 75_000);
      this.emit("bid:new", {
        franchiseId: f.id,
        franchiseTag: f.tag,
        increment,
        ts: Date.now(),
      });
      this.timers.push(
        setTimeout(bidTick, 1800 + Math.random() * 3200) as unknown as ReturnType<
          typeof setInterval
        >,
      );
    };
    this.timers.push(
      setTimeout(bidTick, 1500) as unknown as ReturnType<typeof setInterval>,
    );

    // match score ticks every 6s
    const scoreTick = setInterval(() => {
      this.emit("score:tick", {
        matchId: "m-001",
        side: Math.random() > 0.5 ? "A" : "B",
      });
    }, 6000);
    this.timers.push(scoreTick);
  }

  stop() {
    this.timers.forEach((t) => clearTimeout(t as unknown as number));
    this.timers.forEach((t) => clearInterval(t as unknown as number));
    this.timers = [];
  }
}

let instance: MockSocket | null = null;
export function getMockSocket() {
  if (typeof window === "undefined") return null;
  if (!instance) instance = new MockSocket();
  return instance;
}
