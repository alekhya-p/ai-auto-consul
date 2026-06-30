/**
 * Tiny dependency-free bar chart: one labelled row per datum, bar width is the
 * value as a share of the max. Used for the admin usage "over time" + per-tool
 * views so we don't pull in a charting library.
 */
export interface UsageBar {
  label: string;
  value: number;
  /** Optional right-aligned display value (defaults to the number). */
  display?: string;
}

export function UsageBars({ bars }: { bars: UsageBar[] }) {
  const max = bars.reduce((m, b) => Math.max(m, b.value), 0);
  return (
    <ul className="admin-bars">
      {bars.map((b) => (
        <li key={b.label} className="admin-bar-row">
          <span className="admin-bar-label">{b.label}</span>
          <span className="admin-bar-track">
            <span
              className="admin-bar-fill"
              style={{ width: max === 0 ? "0%" : `${Math.round((b.value / max) * 100)}%` }}
            />
          </span>
          <span className="admin-bar-value">{b.display ?? b.value}</span>
        </li>
      ))}
    </ul>
  );
}
