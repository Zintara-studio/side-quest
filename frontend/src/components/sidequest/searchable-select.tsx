"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SQ, FONT } from "./tokens";

export interface SearchableSelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

/**
 * Themed single-select with a type-to-filter popover. Trigger button shows the
 * selected label; opening reveals a filter input over a scrollable option list.
 * Filters by label + hint (case-insensitive). Keyboard: ↑/↓ to move, Enter to
 * pick, Esc to close. Click-outside closes. Styled inline with SQ/FONT tokens.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Type to filter…",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [options, query]);

  // Reset filter + active row each time the popover opens; focus the input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Click-outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open, filtered.length]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[active];
      if (opt) pick(opt.value);
    }
  };

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          textAlign: "left",
          background: SQ.inset,
          border: `1px solid ${SQ.inputBorder}`,
          borderRadius: 5,
          padding: "9px 12px",
          fontSize: 13.5,
          fontFamily: FONT.sans,
          color: selected ? SQ.ink : SQ.mute,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            color: SQ.mute,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .12s",
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 60,
            background: SQ.panel,
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,.18)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 8, borderBottom: `1px solid ${SQ.hairlineSoft}` }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                background: SQ.inset,
                border: `1px solid ${SQ.inputBorder}`,
                borderRadius: 5,
                padding: "7px 10px",
                fontSize: 13,
                color: SQ.ink,
                fontFamily: FONT.sans,
                outline: "none",
              }}
            />
          </div>

          <div ref={listRef} style={{ maxHeight: 240, overflowY: "auto", padding: 4 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "14px 10px",
                  textAlign: "center",
                  fontFamily: FONT.mono,
                  fontSize: 11.5,
                  letterSpacing: ".06em",
                  color: SQ.mute,
                }}
              >
                No matches
              </div>
            ) : (
              filtered.map((o, i) => {
                const isActive = i === active;
                const isSelected = o.value === value;
                return (
                  <div
                    key={o.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 5,
                      cursor: "pointer",
                      background: isActive ? SQ.inset : "transparent",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13.5,
                        fontFamily: FONT.sans,
                        color: SQ.ink,
                        fontWeight: isSelected ? 700 : 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.label}
                    </span>
                    {o.hint ? (
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10.5,
                          color: SQ.mute,
                          flex: "0 0 auto",
                        }}
                      >
                        {o.hint}
                      </span>
                    ) : null}
                    {isSelected ? (
                      <span style={{ color: SQ.ember, fontSize: 12, flex: "0 0 auto" }}>✓</span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
