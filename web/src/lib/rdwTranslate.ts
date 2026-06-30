import type { Lang } from "./i18n";

/**
 * Translate well-known Dutch RDW enum values to English. The RDW returns
 * everything in Dutch (Personenauto, hatchback, Grijs, Benzine, Logisch,
 * ...). When the user is in EN mode the LABELS get translated through
 * useT() - these are the VALUES.
 *
 * Anything we don't have a mapping for falls through to the original
 * Dutch text (we don't make up data the registry didn't give us).
 *
 * One module-level constant means we can use this helper outside of
 * React (no `t` function needed). Keys are the lowercased, trimmed
 * Dutch source value; values are the English replacement.
 *
 * Coverage spans the enums that actually show up on the dossier page:
 *   - voertuigsoort         (vehicle type)
 *   - inrichting            (body style)
 *   - kleur                 (colour names)
 *   - brandstof             (fuel)
 *   - hybride               (hybrid class)
 *   - tellerstandoordeel    (odometer assessment)
 *   - apkSoort              (inspection scope)
 *   - apkResultaat          (inspection meld-type)
 *
 * Defect descriptions (apkHistorie.aandachtspunten) are NOT translated
 * here - there are 500+ codes in RDW's lexicon and each is a precise
 * Dutch automotive sentence. They stay Dutch (with the source noted in
 * the page). Translating them is a separate, larger project.
 */

const dictionaries: Record<RdwField, Record<string, string>> = {
  voertuigsoort: {
    "personenauto": "Passenger car",
    "bedrijfsauto": "Commercial vehicle",
    "motorfiets": "Motorcycle",
    "bromfiets": "Moped",
    "snorfiets": "Light moped",
    "aanhangwagen": "Trailer",
    "oplegger": "Semi-trailer",
    "driewielig motorrijtuig": "Three-wheeled motor vehicle",
    "land- of bosbouwtrekker": "Agricultural / forestry tractor",
    "mobiele machine": "Mobile machine",
  },
  inrichting: {
    "hatchback": "Hatchback",
    "sedan": "Sedan",
    "stationwagen": "Station wagon",
    "coupe": "Coupé",
    "coupé": "Coupé",
    "cabriolet": "Convertible",
    "mpv": "MPV",
    "suv": "SUV",
    "pick-up": "Pick-up",
    "pickup truck": "Pick-up",
    "bestelauto": "Van",
    "bus": "Bus",
    "bestelauto met laadbak": "Flatbed van",
    "voor rolstoel toegankelijk": "Wheelchair-accessible",
  },
  kleur: {
    "wit": "White",
    "zwart": "Black",
    "grijs": "Grey",
    "rood": "Red",
    "blauw": "Blue",
    "groen": "Green",
    "geel": "Yellow",
    "bruin": "Brown",
    "paars": "Purple",
    "roze": "Pink",
    "beige": "Beige",
    "oranje": "Orange",
    "goud": "Gold",
    "zilver": "Silver",
    "creme": "Cream",
    "crème": "Cream",
    "ivoor": "Ivory",
    "niet geregistreerd": "Not recorded",
  },
  brandstof: {
    "benzine": "Petrol",
    "diesel": "Diesel",
    "elektrisch": "Electric",
    "elektriciteit": "Electric",
    "lpg": "LPG",
    "cng": "CNG",
    "lng": "LNG",
    "hybride": "Hybrid",
    "waterstof": "Hydrogen",
    "alcohol": "Ethanol",
    "niet geregistreerd": "Not recorded",
  },
  hybride: {
    "mild-hybride": "Mild hybrid",
    "mild hybrid": "Mild hybrid",
    "plug-in hybride": "Plug-in hybrid",
    "plug-in hybrid": "Plug-in hybrid",
    "full hybrid": "Full hybrid",
    "niet hybride": "Not a hybrid",
    "geen hybride": "Not a hybrid",
  },
  tellerstandoordeel: {
    "logisch": "Logical (consistent)",
    "onlogisch": "Inconsistent - suspicious",
    "niet voldoende": "Insufficient data",
    "geen oordeel mogelijk": "Assessment not possible",
  },
  apkSoort: {
    "apk lichte voertuigen": "MOT - Light vehicles",
    "apk zware voertuigen": "MOT - Heavy vehicles",
    "apk landbouwvoertuigen": "MOT - Agricultural vehicles",
  },
  apkResultaat: {
    "periodieke controle": "Periodic inspection",
    "tussentijdse controle": "Interim inspection",
    "controle wegens reparatie": "Re-inspection after repair",
    "controle wegens reparatie en periodieke controle": "Re-inspection after repair + periodic",
  },
};

export type RdwField =
  | "voertuigsoort"
  | "inrichting"
  | "kleur"
  | "brandstof"
  | "hybride"
  | "tellerstandoordeel"
  | "apkSoort"
  | "apkResultaat";

/**
 * Translate an RDW value for the given language. Falls through to the
 * original string if no mapping exists or `lang` is `nl`.
 *
 * Handles compound colour strings like "Grijs / Zwart" by translating
 * each segment independently.
 */
export function translateRdwValue(
  value: string | null | undefined,
  field: RdwField,
  lang: Lang
): string | null | undefined {
  if (value == null || lang !== "en") return value;
  const dict = dictionaries[field];
  // Try the whole string first.
  const direct = dict[value.trim().toLowerCase()];
  if (direct) return direct;
  // Compound - colour fields often arrive as "A / B".
  if (/[\/·,]/.test(value)) {
    const parts = value.split(/\s*[\/·,]\s*/);
    const translated = parts.map((p) => dict[p.trim().toLowerCase()] ?? p);
    return translated.join(" / ");
  }
  return value;
}
