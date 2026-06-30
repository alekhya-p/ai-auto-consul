import {
  siAudi,
  siBmw,
  siCitroen,
  siFiat,
  siFord,
  siHonda,
  siHyundai,
  siKia,
  siMazda,
  siMitsubishi,
  siNissan,
  siOpel,
  siPeugeot,
  siRenault,
  siSeat,
  siSkoda,
  siSuzuki,
  siTesla,
  siToyota,
  siVolkswagen,
  siVolvo,
} from "simple-icons";

/**
 * Per-brand theme map. Accent and ink colours per make; logos from simple-icons
 * (CC0 SVG paths, MIT package licence).
 *
 * Brand colour applies only to filled badges and left-border accents
 * (always paired with ink for contrast). Never use raw brand colour as text.
 *
 * Trademark: logos identify the user's car (nominative fair use).
 */

export interface BrandTheme {
  /** RDW `merk` value, normalised to UPPER. Used as the lookup key. */
  rdwKey: string;
  /** Lowercase slug - also the `data-brand` attribute value. */
  slug: string;
  /** Accent colour for plate-badge background + card left-border. */
  accent: string;
  /** Text colour to pair with the accent (guaranteed contrast). */
  ink: string;
  /** simple-icons SVG path data. Rendered into a 24x24 inline svg. */
  iconPath: string;
}

const BRANDS: BrandTheme[] = [
  // RDW merk → simple-icons brand mapping.
  brand("BMW",          "bmw",         "#0066B1", "#FFFFFF", siBmw.path),
  brand("OPEL",         "opel",        "#F7FF14", "#000000", siOpel.path),
  brand("VOLKSWAGEN",   "volkswagen",  "#001E50", "#FFFFFF", siVolkswagen.path),
  brand("AUDI",         "audi",        "#BB0A30", "#FFFFFF", siAudi.path),
  brand("TOYOTA",       "toyota",      "#E50000", "#FFFFFF", siToyota.path),
  brand("HONDA",        "honda",       "#CC0000", "#FFFFFF", siHonda.path),
  brand("FORD",         "ford",        "#003478", "#FFFFFF", siFord.path),
  brand("TESLA",        "tesla",       "#CC0000", "#FFFFFF", siTesla.path),
  brand("HYUNDAI",      "hyundai",     "#002C5F", "#FFFFFF", siHyundai.path),
  brand("KIA",          "kia",         "#BB162B", "#FFFFFF", siKia.path),
  brand("RENAULT",      "renault",     "#FFCC00", "#000000", siRenault.path),
  brand("PEUGEOT",      "peugeot",     "#0079C1", "#FFFFFF", siPeugeot.path),
  brand("VOLVO",        "volvo",       "#003057", "#FFFFFF", siVolvo.path),
  brand("SKODA",        "skoda",       "#4BA82E", "#FFFFFF", siSkoda.path),
  brand("SEAT",         "seat",        "#CC0000", "#FFFFFF", siSeat.path),
  brand("FIAT",         "fiat",        "#B81F2D", "#FFFFFF", siFiat.path),
  brand("MAZDA",        "mazda",       "#101010", "#FFFFFF", siMazda.path),
  brand("NISSAN",       "nissan",      "#C3002F", "#FFFFFF", siNissan.path),
  brand("CITROEN",      "citroen",     "#CD193F", "#FFFFFF", siCitroen.path),
  brand("CITROËN",      "citroen",     "#CD193F", "#FFFFFF", siCitroen.path),
  brand("SUZUKI",       "suzuki",      "#1B2C5C", "#FFFFFF", siSuzuki.path),
  brand("MITSUBISHI",   "mitsubishi",  "#E60012", "#FFFFFF", siMitsubishi.path),
];

const INDEX: Map<string, BrandTheme> = new Map(BRANDS.map((b) => [b.rdwKey, b]));

function brand(rdwKey: string, slug: string, accent: string, ink: string, iconPath: string): BrandTheme {
  return { rdwKey, slug, accent, ink, iconPath };
}

/** Look up by raw RDW `merk` value. Case-insensitive, accent-tolerant. */
export function brandFor(merk: string | null | undefined): BrandTheme | null {
  if (!merk) return null;
  return INDEX.get(merk.trim().toUpperCase()) ?? null;
}
