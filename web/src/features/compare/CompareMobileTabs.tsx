import { type RefObject } from "react";
import { NlPlate } from "../../components/NlPlate";

interface CompareMobileTabsProps {
  plates: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

/**
 * Mobile-only car switcher: snaps the horizontal table to the selected column.
 */
export function CompareMobileTabs({
  plates,
  activeIndex,
  onSelect,
  scrollRef,
}: CompareMobileTabsProps) {
  function select(index: number) {
    onSelect(index);
    const scroller = scrollRef.current;
    if (!scroller) return;
    const colWidth = 11 * 16;
    const sticky = 7.5 * 16;
    scroller.scrollTo({ left: sticky + index * colWidth, behavior: "smooth" });
  }

  return (
    <div className="compare-mobile-tabs" role="tablist" aria-label="Cars">
      {plates.map((plate, i) => (
        <button
          key={plate}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          className={`compare-mobile-tab${i === activeIndex ? " active" : ""}`}
          onClick={() => select(i)}
        >
          <NlPlate value={plate} size="sm" />
        </button>
      ))}
    </div>
  );
}
