"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { wsUrl } from "@/lib/api/client";
import { authTokens } from "@/lib/auth/store";
import type { AuctionView } from "@/lib/api/types";

/**
 * Live bid updates over WebSocket for BIDDERS (participating franchise owners/managers) + admins. Each
 * `auction.update` frame is written straight into the same `["auctions", id]` query cache that polling
 * fills, so the board re-renders with no extra request. Spectators never call this with `enabled` — they
 * stay on the poll. Reconnects with capped backoff (reading the freshest token each attempt, since
 * tokens rotate) and heartbeats so a proxy doesn't idle-close the socket.
 */
export function useAuctionSocket({
  auctionId,
  enabled,
}: {
  auctionId: string | undefined;
  enabled: boolean;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || !auctionId) return;
    let closed = false;
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = () => {
      if (closed) return;
      const token = authTokens.getAccess();
      if (!token) {
        // No token yet — retry shortly (auth may still be hydrating).
        retry = setTimeout(connect, 1000);
        return;
      }
      const ws = new WebSocket(
        wsUrl(`/ws/live/auctions/${auctionId}?token=${encodeURIComponent(token)}`),
      );
      socket = ws;

      ws.onopen = () => {
        attempts = 0;
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25_000);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg?.event === "auction.update" && msg.data) {
            qc.setQueryData<AuctionView>(["auctions", auctionId], msg.data as AuctionView);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      const scheduleReconnect = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (closed) return;
        attempts += 1;
        const delay = Math.min(1000 * 2 ** attempts, 15_000);
        retry = setTimeout(connect, delay);
      };
      ws.onclose = scheduleReconnect;
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (retry) clearTimeout(retry);
      if (socket) {
        socket.onclose = null; // don't reconnect after an intentional teardown
        socket.close();
      }
    };
  }, [auctionId, enabled, qc]);
}
