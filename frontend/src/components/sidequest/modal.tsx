"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { SQ, FONT } from "./tokens";

// Stack of currently-open modals (in open order). Esc only closes the topmost, so a nested modal
// (e.g. the lineup editor over the lineups list) steps back one level per Esc instead of closing both.
const modalStack: symbol[] = [];

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Themed dialog that replaces window.prompt/confirm. Full-screen dimmed overlay
 * with a centered SQ-styled card. Click the overlay or the X to close, Esc to
 * close. Screens compose their own body + action buttons as children.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Only close on a backdrop click whose press ORIGINATED on the overlay — so dragging a text
  // selection out of a textarea and releasing over the backdrop doesn't discard the user's input.
  const pressedOnOverlay = useRef(false);
  // Keep the latest onClose in a ref so the open-effect does NOT depend on its (unstable) identity.
  // Otherwise every parent re-render (e.g. each keystroke in a child textarea) would re-run the
  // effect and re-focus the card, yanking focus off the input after a single character.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const idRef = useRef<symbol>(Symbol("modal"));

  useEffect(() => {
    if (!open) return;
    const id = idRef.current;
    modalStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      // Only the topmost open modal responds to Escape.
      if (e.key === "Escape" && modalStack[modalStack.length - 1] === id) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog once on open; restore it to the trigger on close. Only focus the
    // card itself when focus isn't already inside it — so a child field's autoFocus (e.g. the resolve
    // / report textarea) keeps the cursor and the user can type immediately.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!cardRef.current?.contains(document.activeElement)) {
      cardRef.current?.focus();
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      const at = modalStack.lastIndexOf(id);
      if (at !== -1) modalStack.splice(at, 1);
      document.body.style.overflow = prev;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        pressedOnOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnOverlay.current && e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          outline: "none",
          width: "min(520px, 94vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,.28)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderBottom: `1px solid ${SQ.hairlineSoft}`,
          }}
        >
          <div
            style={{
              flex: 1,
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: SQ.ink,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${SQ.inputBorder}`,
              background: "transparent",
              color: SQ.mute,
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}
