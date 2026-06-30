import { useEffect, type ReactNode } from "react";

interface BottomSheetProps {
  children: ReactNode;
  /** Accessible label for the dialog region */
  ariaLabel: string;
  onClose?: () => void;
  className?: string;
}

/**
 * Mobile-first bottom sheet: full-screen backdrop + panel anchored to the
 * bottom safe area. Used for paywall / upgrade prompts in chat.
 */
export function BottomSheet({
  children,
  ariaLabel,
  onClose,
  className = "",
}: BottomSheetProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className={`bottom-sheet-root ${className}`.trim()} role="presentation">
      <button
        type="button"
        className="bottom-sheet-backdrop"
        aria-label={ariaLabel}
        onClick={onClose}
        tabIndex={onClose ? 0 : -1}
      />
      <div
        className="bottom-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}
