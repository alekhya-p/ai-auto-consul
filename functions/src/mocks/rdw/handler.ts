import express, { type Request } from "express";
import { applyScenario, normalizePlate, readScenario } from "../../lib/mockScenario.js";
import { findFixture, type PlateFixture } from "../fixtures/index.js";

/**
 * Mock for the public RDW Open Data Socrata API. URL shape mirrors
 * https://opendata.rdw.nl/resource/<dataset-id>.json so the real Java
 * client (Spring RestClient + Resilience4j) can swap base URLs without
 * code changes. Fixtures live under functions/src/mocks/fixtures/.
 *
 * Supported datasets:
 *   m9d7-ebf2  Gekentekende voertuigen          (registry)
 *   8ys7-d773  Gekentekende voertuigen brandstof (fuel + emissions, preliminary id)
 *   j9yg-7rg9  Open recall status               (preliminary id)
 *
 * SoQL subset: filter by `kenteken=...` (Socrata-style equality), optional
 * `$limit`, optional `$select` (returned as-is - selection not enforced).
 *
 * Auth: optional X-App-Token header, accepted with any value.
 */
export const rdwApp = express();
rdwApp.disable("x-powered-by");
rdwApp.use(express.json());

rdwApp.get("/resource/:dataset.json", (req, res, next) => {
  const scenario = readScenario(req);
  if (applyScenario(scenario, res, next)) return;

  const datasetId = String(req.params.dataset);
  const kentekenRaw = pickQuery(req, "kenteken");
  const limit = clampInt(pickQuery(req, "$limit"), 1, 1000, 100);

  if (!kentekenRaw) {
    res.status(200).json([]);
    return;
  }

  const plate = normalizePlate(kentekenRaw);
  const fixture = findFixture(plate);
  if (!fixture) {
    // Socrata returns [] (not 404) for "no rows match the filter".
    res.status(200).json([]);
    return;
  }

  const row = projectFixture(datasetId, plate, fixture);
  if (!row) {
    res.status(200).json([]);
    return;
  }
  res.status(200).json([row].slice(0, limit));
});

rdwApp.use((_req, res) => res.status(404).json({ error: "not_found" }));

function pickQuery(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function projectFixture(
  datasetId: string,
  kenteken: string,
  f: PlateFixture,
): Record<string, unknown> | null {
  switch (datasetId) {
    case "m9d7-ebf2":
      return projectGekentekendeVoertuigen(kenteken, f);
    case "8ys7-d773":
      return projectBrandstof(kenteken, f);
    case "j9yg-7rg9":
      return projectTerugroepactie(kenteken, f);
    default:
      return null;
  }
}

function projectGekentekendeVoertuigen(kenteken: string, f: PlateFixture): Record<string, unknown> {
  // Field names match the RDW gekentekende_voertuigen open-data schema.
  return {
    kenteken,
    voertuigsoort: "Personenauto",
    merk: f.make.toUpperCase(),
    handelsbenaming: `${f.model} ${f.trim}`.trim(),
    vervaldatum_apk: f.apkValidUntil.replace(/-/g, ""),
    datum_tenaamstelling: f.firstNlRegistration.replace(/-/g, ""),
    datum_eerste_toelating: f.firstRegistration.replace(/-/g, ""),
    datum_eerste_tenaamstelling_in_nederland: f.firstNlRegistration.replace(/-/g, ""),
    wam_verzekerd: "Ja",
    bruto_bpm: 0,
    catalogusprijs: f.valuationPrivate[1] * 1.5,
    massa_ledig_voertuig: estimateKerb(f),
    toegestane_maximum_massa_voertuig: estimateKerb(f) + 500,
    aantal_zitplaatsen: 5,
    aantal_deuren: 5,
    eerste_kleur: "GRIJS",
    europese_voertuigcategorie: "M1",
    wacht_op_keuren: "Geen",
    openstaande_terugroepactie_indicator: f.openRecall ? "Ja" : "Nee",
    tellerstandoordeel: "Logisch",
    jaar_laatste_registratie_tellerstand: Number(f.lastKnownKmAsOf.slice(0, 4)),
    tenaamstellen_mogelijk: "Ja",
    export_indicator: "Nee",
    taxi_indicator: "Nee",
    zuinigheidsclassificatie: f.fuelType === "BEV" ? "A" : f.fuelType === "PHEV" ? "B" : "C",
  };
}

function projectBrandstof(kenteken: string, f: PlateFixture): Record<string, unknown> {
  return {
    kenteken,
    brandstof_omschrijving:
      f.fuelType === "BEV"   ? "Elektriciteit"
    : f.fuelType === "PHEV"  ? "Benzine"
    : f.fuelType === "HEV"   ? "Benzine"
    : f.fuelType,
    co2_uitstoot_gecombineerd: f.co2WltpGramsPerKm,
    netto_max_vermogen: f.powerKw,
    cilinderinhoud: f.engineCc,
  };
}

function projectTerugroepactie(kenteken: string, f: PlateFixture): Record<string, unknown> | null {
  if (!f.openRecall) return null;
  return {
    kenteken,
    referentiecode_rdw: f.recallCodes?.[0] ?? "UNKNOWN",
    fabrikant_merk: f.make.toUpperCase(),
    status: "Open",
  };
}

function estimateKerb(f: PlateFixture): number {
  if (f.fuelType === "BEV") return 1800;
  if (f.fuelType === "PHEV") return 1700;
  return 1400;
}
