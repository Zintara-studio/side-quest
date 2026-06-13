import type { ReactNode } from "react";
import { SQ } from "./tokens";

/** Horizontally scrollable, bordered table frame with a min-width inner track. */
export function TableScroll({
  minWidth,
  marginTop,
  children,
}: {
  minWidth: number;
  marginTop?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 9,
        marginTop,
      }}
    >
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}
