"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "~/i18n/i18n-provider";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 10;

type Point = { x: number; y: number };
type View = { scale: number; x: number; y: number; animate: boolean };

const IDENTITY: View = { scale: 1, x: 0, y: 0, animate: true };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// Pinch, drag, double tap and wheel zoom confined to the image, so the page
// itself never zooms.
export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const { m } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; mid: Point } | null>(null);
  const tap = useRef({ start: { x: 0, y: 0 }, moved: false, last: 0 });
  const viewRef = useRef(IDENTITY);
  const [view, setView] = useState(IDENTITY);
  const [failed, setFailed] = useState(false);

  const update = useCallback((next: View) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const scale = clamp(next.scale, 1, MAX_SCALE);
    const maxX = rect ? (rect.width * (scale - 1)) / 2 : 0;
    const maxY = rect ? (rect.height * (scale - 1)) / 2 : 0;
    const clamped = {
      scale,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
      animate: next.animate,
    };
    viewRef.current = clamped;
    setView(clamped);
  }, []);

  // Zooms keeping the content under `focus` (client coordinates) in place.
  const zoomAt = useCallback(
    (focus: Point, targetScale: number, animate = false) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const current = viewRef.current;
      const scale = clamp(targetScale, 1, MAX_SCALE);
      const fx = focus.x - rect.left - rect.width / 2;
      const fy = focus.y - rect.top - rect.height / 2;
      const ratio = scale / current.scale;
      update({
        scale,
        x: fx - (fx - current.x) * ratio,
        y: fy - (fy - current.y) * ratio,
        animate,
      });
    },
    [update]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(
        { x: e.clientX, y: e.clientY },
        viewRef.current.scale * Math.exp(-e.deltaY * 0.01)
      );
    };
    // Safari fires its own gesture events for trackpad / page pinch.
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", prevent);
    el.addEventListener("gesturechange", prevent);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", prevent);
      el.removeEventListener("gesturechange", prevent);
    };
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = null;
    if (pointers.current.size === 1) {
      tap.current.start = { x: e.clientX, y: e.clientY };
      tap.current.moved = false;
    } else {
      tap.current.moved = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const point = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, point);
    const { start } = tap.current;
    if (Math.hypot(point.x - start.x, point.y - start.y) > TAP_SLOP) {
      tap.current.moved = true;
    }

    const current = viewRef.current;
    if (pointers.current.size === 1) {
      if (current.scale > 1) {
        update({
          ...current,
          x: current.x + point.x - prev.x,
          y: current.y + point.y - prev.y,
          animate: false,
        });
      }
      return;
    }

    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const last = pinch.current;
    pinch.current = { distance, mid };
    if (!last || last.distance === 0) return;

    zoomAt(mid, (current.scale * distance) / last.distance);
    const zoomed = viewRef.current;
    update({
      ...zoomed,
      x: zoomed.x + mid.x - last.mid.x,
      y: zoomed.y + mid.y - last.mid.y,
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (
      pointers.current.size > 0 ||
      tap.current.moved ||
      e.type === "pointercancel"
    ) {
      return;
    }
    if (e.timeStamp - tap.current.last < DOUBLE_TAP_MS) {
      tap.current.last = 0;
      if (viewRef.current.scale > 1) update(IDENTITY);
      else zoomAt({ x: e.clientX, y: e.clientY }, DOUBLE_TAP_SCALE, true);
    } else {
      tap.current.last = e.timeStamp;
    }
  };

  if (failed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <ImageOff className="size-8" />
        <p className="text-sm">{m.timetable.unavailable}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 cursor-zoom-in touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}>
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: view.animate ? "transform 200ms ease-out" : "none",
        }}>
        <Image
          alt={alt}
          src={src}
          fill
          sizes="200vw"
          draggable={false}
          onError={() => setFailed(true)}
          className="pointer-events-none object-contain"
        />
      </div>
    </div>
  );
}
