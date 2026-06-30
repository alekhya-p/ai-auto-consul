import platesJson from "./plates.json";

export interface PlateFixture {
  vin: string;
  make: string;
  model: string;
  trim: string;
  modelYear: number;
  fuelType: "BEV" | "PHEV" | "HEV" | "Diesel" | "Petrol" | "LPG" | "CNG" | "Hydrogen" | "Other";
  transmission: "Manual" | "Automatic" | "DCT" | "CVT" | "Other";
  drive: "FWD" | "RWD" | "AWD" | "Other";
  powerKw: number;
  engineCc: number;
  co2WltpGramsPerKm: number;
  firstRegistration: string;
  firstNlRegistration: string;
  imported: boolean;
  apkValidUntil: string;
  openRecall: boolean;
  recallCodes?: string[];
  lastKnownKm: number;
  lastKnownKmAsOf: string;
  valuationTradeIn: [number, number, number];
  valuationPrivate: [number, number, number];
}

const fixtures = platesJson as unknown as Record<string, PlateFixture | string>;

export function findFixture(normalizedPlate: string): PlateFixture | undefined {
  const v = fixtures[normalizedPlate];
  if (typeof v === "object" && v !== null) return v;
  return undefined;
}

export function findFixtureByVin(vin: string): PlateFixture | undefined {
  for (const [key, value] of Object.entries(fixtures)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "object" && value !== null && (value as PlateFixture).vin === vin) {
      return value as PlateFixture;
    }
  }
  return undefined;
}
