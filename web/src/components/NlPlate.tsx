import { prettyPlate } from "../lib/voertuigCache";

type Size = "sm" | "md" | "lg";

/**
 * Visual Dutch licence plate. Yellow body, black mono text, EU-blue
 * "NL" strip on the left. Pure presentational - pass the raw plate
 * string and we'll format it (12-AB-345 segmentation) via prettyPlate.
 */
export function NlPlate({ value, size = "md" }: { value: string; size?: Size }) {
  const formatted = prettyPlate(value.toUpperCase());
  return (
    <span className={`nl-plate nl-plate-${size}`} aria-label={`kenteken ${formatted}`}>
      <span className="nl-plate-strip" aria-hidden="true">NL</span>
      <span className="nl-plate-chars">{formatted}</span>
    </span>
  );
}
