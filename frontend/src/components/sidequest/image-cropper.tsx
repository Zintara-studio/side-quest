"use client";

// Interactive crop-on-upload. The user pans (drag) and zooms (slider/wheel) an image inside an
// aspect-locked frame; on Apply we render EXACTLY the visible region to a canvas at the kind's target
// size (avatar/logo 1:1, banner 4:1). Because the stored image is already the right ratio + the region
// the user chose, every display box shows it verbatim — no surprise object-fit cutting. WYSIWYG.
import { useCallback, useEffect, useRef, useState } from "react";
import { SQ, FONT } from "./tokens";
import { Modal } from "./modal";
import {
  loadImageFile,
  cropToDataUrl,
  CROP_DIMS,
  ASPECT,
  IMAGE_PRESETS,
  type ImageKind,
} from "@/lib/image";

const KIND_LABEL: Record<ImageKind, string> = {
  avatar: "profile photo",
  logo: "logo",
  banner: "banner",
};

/** Clamp the image top-left (tx,ty) so the image always fully covers the box (no gaps at the edges). */
function clampPos(nx: number, ny: number, dw: number, dh: number, boxW: number, boxH: number) {
  return {
    x: Math.min(0, Math.max(boxW - dw, nx)),
    y: Math.min(0, Math.max(boxH - dh, ny)),
  };
}

export function ImageCropper({
  file,
  kind,
  onCancel,
  onCropped,
}: {
  file: File;
  kind: ImageKind;
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}) {
  const aspect = ASPECT[kind];
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [boxW, setBoxW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null);
  const initialized = useRef(false);

  const boxH = aspect ? boxW / aspect : 0;

  // Decode the picked file.
  useEffect(() => {
    let cancelled = false;
    loadImageFile(file)
      .then((i) => !cancelled && setImg(i))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Track the crop-frame width (the height follows via CSS aspect-ratio).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const coverScale =
    img && boxW ? Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight) : 1;
  const scale = coverScale * zoom;
  const dw = img ? img.naturalWidth * scale : 0;
  const dh = img ? img.naturalHeight * scale : 0;

  // Center the image once, when image + box are first ready.
  useEffect(() => {
    if (img && boxW && !initialized.current) {
      initialized.current = true;
      const s = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
      setTx((boxW - img.naturalWidth * s) / 2);
      setTy((boxH - img.naturalHeight * s) / 2);
    }
  }, [img, boxW, boxH]);

  const applyZoom = (nz: number) => {
    if (!img || !boxW) {
      setZoom(nz);
      return;
    }
    // Keep the frame's centre pinned to the same source pixel as we zoom (feels natural).
    const oldScale = coverScale * zoom;
    const newScale = coverScale * nz;
    const cx = (-tx + boxW / 2) / oldScale;
    const cy = (-ty + boxH / 2) / oldScale;
    const ntx = boxW / 2 - cx * newScale;
    const nty = boxH / 2 - cy * newScale;
    const ndw = img.naturalWidth * newScale;
    const ndh = img.naturalHeight * newScale;
    const c = clampPos(ntx, nty, ndw, ndh, boxW, boxH);
    setZoom(nz);
    setTx(c.x);
    setTy(c.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!img) return;
    drag.current = { px: e.clientX, py: e.clientY, tx, ty };
    // Keep receiving move/up even if the pointer leaves the box. Guarded — a stray/invalid pointer id
    // (e.g. a synthetic event) must not throw and break the drag.
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore — capture is a nicety, not required for the drag to work */
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const c = clampPos(
      drag.current.tx + (e.clientX - drag.current.px),
      drag.current.ty + (e.clientY - drag.current.py),
      dw,
      dh,
      boxW,
      boxH,
    );
    setTx(c.x);
    setTy(c.y);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!img) return;
    const next = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    applyZoom(next);
  };

  const apply = useCallback(() => {
    if (!img || !boxW) return;
    setBusy(true);
    try {
      // Map the frame back to source pixels, clamped into the image so rounding can't read out of bounds.
      const sx = Math.max(0, -tx / scale);
      const sy = Math.max(0, -ty / scale);
      const sw = Math.min(img.naturalWidth - sx, boxW / scale);
      const sh = Math.min(img.naturalHeight - sy, boxH / scale);
      const dims = CROP_DIMS[kind];
      const dataUrl = cropToDataUrl(img, { x: sx, y: sy, w: sw, h: sh }, dims.w, dims.h, IMAGE_PRESETS[kind].maxBytes);
      onCropped(dataUrl);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [img, boxW, tx, ty, scale, boxH, kind, onCropped]);

  const btn = {
    fontFamily: FONT.mono,
    fontSize: 11,
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
    borderRadius: 6,
    padding: "10px 16px",
    cursor: "pointer",
  };

  return (
    <Modal open title={`Position your ${KIND_LABEL[kind]}`} onClose={busy ? () => {} : onCancel}>
      <div style={{ width: "min(520px, 78vw)", maxWidth: "100%" }}>
        <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
          Drag to move, and use the slider (or scroll) to zoom. Everything inside the frame is what gets
          saved.
        </div>

        {error ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember, marginBottom: 12 }}>{error}</div>
        ) : null}

        <div
          ref={boxRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: String(aspect),
            overflow: "hidden",
            borderRadius: kind === "avatar" ? "50%" : 10,
            border: `1px solid ${SQ.inputBorder}`,
            background: SQ.inset,
            cursor: img ? "grab" : "default",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element -- transient in-browser crop preview
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: tx,
                top: ty,
                width: dw,
                height: dh,
                maxWidth: "none",
                pointerEvents: "none",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT.mono,
                fontSize: 12,
                color: SQ.mute,
              }}
            >
              {error ? "Couldn't load that image." : "Loading…"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em", color: SQ.label }}>ZOOM</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            disabled={!img}
            style={{ flex: 1, accentColor: SQ.red, cursor: "pointer" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ ...btn, color: SQ.faint, background: "transparent", border: `1px solid ${SQ.inputBorder}` }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!img || busy}
            style={{
              ...btn,
              color: SQ.league,
              background: SQ.red,
              border: "none",
              fontWeight: 700,
              opacity: !img || busy ? 0.6 : 1,
            }}
          >
            {busy ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
