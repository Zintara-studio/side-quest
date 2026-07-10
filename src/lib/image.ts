// Client-side image compression for uploads. The user picks any reasonable image and we resize +
// re-encode it in the browser to fit comfortably under the backend's per-kind size caps (avatar 32KB /
// logo 64KB / banner 256KB), rather than rejecting oversized files. WebP is used when the browser can
// encode it (smaller, preserves alpha), otherwise JPEG — both pass the server's magic-byte validation.

export interface CompressPreset {
  /** Target ceiling for the ENCODED image, in bytes. Kept under the backend cap for headroom. */
  maxBytes: number;
  /** Longest side, in px, the image is scaled down to before encoding. */
  maxDim: number;
}

/**
 * Per-kind presets. Targets sit safely under the backend caps so the encoded bytes AND their base64
 * envelope (≤ 360KB per the @Size cap) always clear validation:
 *  - avatar: displayed 28–96px → 256px covers retina; ~30KB WebP.
 *  - logo:   displayed 64–72px → 320px; ~60KB.
 *  - banner: wide hero strip → 1600px; ~240KB (base64 ≈ 327KB < 360KB).
 */
export const IMAGE_PRESETS: Record<"avatar" | "logo" | "banner", CompressPreset> = {
  avatar: { maxBytes: 30_000, maxDim: 256 },
  logo: { maxBytes: 60_000, maxDim: 320 },
  banner: { maxBytes: 240_000, maxDim: 1600 },
};

/** Reject absurdly large inputs before decoding, purely to avoid choking the browser. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupport;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image."));
    };
    img.src = url;
  });
}

/** Decoded byte length of a base64 data URL. */
function dataUrlByteLength(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function encode(img: HTMLImageElement, longest: number, mime: string, quality: number): string {
  const scale = Math.min(1, longest / Math.max(img.width, img.height));
  const w = Math.max(16, Math.round(img.width * scale));
  const h = Math.max(16, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't supported in this browser.");
  // JPEG has no alpha — flatten onto white so transparent PNGs don't turn black.
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(mime, quality);
}

/**
 * Compress an image in the browser to fit under {@link CompressPreset.maxBytes}: resize to
 * {@link CompressPreset.maxDim}, then step down quality (and, if needed, dimensions) until it fits.
 * Returns a base64 data URL ready to POST to /media. Convergence is guaranteed — a small image at low
 * quality is only a few KB, far under any cap.
 */
export async function compressImage(file: File, preset: CompressPreset): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, JPG, WEBP or GIF).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("That image is enormous — pick one under 25MB.");
  }
  const img = await loadImage(file);
  const mime = supportsWebp() ? "image/webp" : "image/jpeg";

  let longest = Math.min(preset.maxDim, Math.max(img.width, img.height));
  let quality = 0.85;
  let out = encode(img, longest, mime, quality);
  for (let i = 0; i < 12 && dataUrlByteLength(out) > preset.maxBytes; i++) {
    if (quality > 0.42) {
      quality -= 0.12;
    } else {
      longest = Math.max(48, Math.round(longest * 0.82));
      quality = 0.8;
    }
    out = encode(img, longest, mime, quality);
  }
  return out;
}
