"use client";

import { SQ } from "./tokens";
import { mediaSrc } from "@/lib/api/client";

/**
 * A player/franchise avatar. Renders the stored image when present (resolved to the API origin via
 * {@link mediaSrc}) and falls back to the warm gradient placeholder used across the app otherwise.
 */
export function Avatar({
  url,
  alt = "",
  size = 40,
  radius,
}: {
  url?: string | null;
  alt?: string;
  size?: number;
  radius?: number | string;
}) {
  const br = radius ?? "50%";
  const border = `1px solid ${SQ.avatarBorder}`;
  const src = mediaSrc(url);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external API origin; next/image needs host config
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: br,
          objectFit: "cover",
          border,
          background: SQ.avatar,
          display: "block",
          flex: "0 0 auto",
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: br,
        background: SQ.avatarGrad,
        border,
        flex: "0 0 auto",
      }}
    />
  );
}
