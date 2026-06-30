import type { BrandTheme } from "../lib/brandTheme";

/**
 * Inline SVG render of the brand logo from simple-icons. Sits in the
 * hero card next to the model name. Stays small (28x28) - this is a
 * trust signal, not a marketing splash.
 *
 * Always currentColor-fillable so the logo inherits the surrounding
 * text colour. We bias to dark grey for legibility on the warm bg.
 */
export function BrandLogo({ theme, size = 28 }: { theme: BrandTheme; size?: number }) {
  return (
    <svg
      role="img"
      aria-label={theme.rdwKey}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <title>{theme.rdwKey}</title>
      <path d={theme.iconPath} />
    </svg>
  );
}
