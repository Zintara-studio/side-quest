"use client";

import type { CSSProperties, ReactNode } from "react";
import { Modal } from "./modal";
import { SQ, FONT } from "./tokens";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  tone?: "default" | "destructive";
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Themed confirm dialog that replaces the native window.confirm — composes {@link Modal} with a
 * message, an optional destructive tint, and Cancel / Confirm actions. Because it's async (unlike the
 * blocking native confirm), callers stage the target in state and run the action inside onConfirm.
 */
export function ConfirmModal({
  open,
  title,
  message,
  tone = "default",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const destructive = tone === "destructive";
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.6,
          color: destructive ? SQ.ink : SQ.faint,
          ...(destructive
            ? {
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${SQ.red}`,
                background: "rgba(232,96,44,.08)",
              }
            : {}),
        }}
      >
        {message}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onClose} disabled={busy} style={ghostBtn(busy)}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} style={solidBtn(busy, destructive)}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function ghostBtn(busy: boolean): CSSProperties {
  return {
    fontFamily: FONT.mono,
    fontSize: 11.5,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: SQ.faint,
    background: "transparent",
    border: `1px solid ${SQ.inputBorder}`,
    borderRadius: 6,
    padding: "9px 16px",
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.6 : 1,
  };
}

function solidBtn(busy: boolean, destructive: boolean): CSSProperties {
  return {
    fontFamily: FONT.mono,
    fontSize: 11.5,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    fontWeight: 700,
    color: SQ.league,
    background: destructive ? SQ.red : SQ.ember,
    border: "none",
    borderRadius: 6,
    padding: "9px 16px",
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.6 : 1,
  };
}
