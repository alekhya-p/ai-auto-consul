import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * Minimal app-window chrome (traffic-light dots + title) wrapping an
 * auto-scaling "screen". Used on the landing page to present scaled-down product UI.
 */
export function MktWindow({
  title,
  tone = "app",
  children,
}: {
  title: string;
  /** "app" = white screen, "pdf" = grey document viewer backdrop. */
  tone?: "app" | "pdf";
  children: ReactNode;
}) {
  return (
    <div className={`mkt-win mkt-win--${tone}`}>
      <div className="mkt-win-bar">
        <span className="mkt-win-dots" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="mkt-win-title">{title}</span>
      </div>
      <div className="mkt-win-screen">{children}</div>
    </div>
  );
}

/**
 * Renders `children` at a fixed desktop width/height, then scales the whole
 * thing down with `transform` to fill its container - so the replica is a
 * faithful miniature of the real desktop layout and reflows with the page.
 * A ResizeObserver keeps the scale in sync with the container width.
 */
export function ScaledStage({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      className="mkt-stage"
      // Reserve the scaled height so surrounding layout is correct.
      style={{ height: scale ? height * scale : undefined, aspectRatio: scale ? undefined : `${width} / ${height}` }}
      aria-hidden="true"
    >
      <div
        className="mkt-stage-inner"
        style={{ width, height, transform: `scale(${scale || 0.0001})` }}
      >
        {children}
      </div>
    </div>
  );
}
