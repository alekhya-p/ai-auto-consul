import { useEffect, useId, useRef, useState } from "react";
import { useT } from "../lib/i18n";

/**
 * Small "i" button that pops a one-paragraph explanation. Used to take
 * the edge off Dutch RDW jargon (BPM, WOK, APK, tellerstandoordeel, …)
 * and the source-of-truth badges (RDW · Officieel, AI · Indicatief).
 *
 * Pass an i18n `textKey`; the body comes from `t(textKey)` so both NL
 * and EN copy live next to the rest of the translations.
 */
export function InfoButton({
  textKey,
  size = "sm",
  align = "left",
}: {
  textKey: string;
  size?: "sm" | "md";
  align?: "left" | "right";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onDocPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDocPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={`info-wrap info-${size} info-${align}`}>
      <button
        type="button"
        className="info-trigger"
        aria-label={t("voertuig.help.openLabel")}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open && (
        <div
          id={popoverId}
          role="tooltip"
          className="info-popover"
        >
          {t(textKey)}
        </div>
      )}
    </span>
  );
}
