import express, { type Request, type Response, type NextFunction } from "express";
import { applyScenario, normalizePlate, readScenario } from "../../lib/mockScenario.js";
import { findFixture, findFixtureByVin, type PlateFixture } from "../fixtures/index.js";

/**
 * Mock for the Autotelex Vehicle Data API. URL shape mirrors
 * https://vehicledataapi.autotelexpro.nl/vehicle/by-license-plate/{plate}
 * so the real Java client (Spring RestClient + Resilience4j) can swap
 * base URLs and bearer secret without code changes.
 *
 * Response shape follows the Autotelex swagger contract (preliminary).
 *
 * Auth: Bearer token required (any non-empty value). Missing or empty
 * Authorization header returns 401, matching what we want the Java
 * client to surface as a configuration bug rather than a soft failure.
 */
export const autotelexApp = express();
autotelexApp.disable("x-powered-by");
autotelexApp.use(express.json());

autotelexApp.use(requireBearer);

autotelexApp.get("/vehicle/by-license-plate/:plate", (req, res, next) => {
  const scenario = readScenario(req);
  if (applyScenario(scenario, res, next)) return;

  const plate = normalizePlate(String(req.params.plate));
  const fixture = findFixture(plate);
  if (!fixture) {
    res.status(404).json({ error: "plate_not_found" });
    return;
  }
  res.status(200).json(toVehicleResponse(plate, fixture));
});

autotelexApp.get("/vehicle/by-vin/:vin", (req, res, next) => {
  const scenario = readScenario(req);
  if (applyScenario(scenario, res, next)) return;

  const vin = String(req.params.vin).toUpperCase();
  if (vin.length !== 17) {
    res.status(400).json({ error: "invalid_vin" });
    return;
  }
  const fixture = findFixtureByVin(vin);
  if (!fixture) {
    res.status(404).json({ error: "vin_not_found" });
    return;
  }
  res.status(200).json(toVehicleResponse("", fixture));
});

autotelexApp.use((_req, res) => res.status(404).json({ error: "not_found" }));

function requireBearer(req: Request, res: Response, next: NextFunction): void {
  const auth = req.header("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) {
    res.status(401).json({ error: "missing_bearer" });
    return;
  }
  next();
}

function toVehicleResponse(licensePlate: string, f: PlateFixture): Record<string, unknown> {
  return {
    identification: {
      vin: f.vin,
      licensePlate,
      make: f.make,
      model: f.model,
      trim: f.trim,
      modelYear: f.modelYear,
      firstRegistration: f.firstRegistration,
      firstNlRegistration: f.firstNlRegistration,
    },
    drivetrain: {
      fuelType: f.fuelType,
      transmission: f.transmission,
      drive: f.drive,
      powerKw: f.powerKw,
      engineCc: f.engineCc,
      co2WltpGramsPerKm: f.co2WltpGramsPerKm,
    },
    options: [],
    mileage: {
      lastKnownKm: f.lastKnownKm,
      asOfDate: f.lastKnownKmAsOf,
      band: bandFor(f.lastKnownKm, f.modelYear),
    },
    valuation: {
      currency: "EUR",
      tradeInLow:      f.valuationTradeIn[0],
      tradeInMid:      f.valuationTradeIn[1],
      tradeInHigh:     f.valuationTradeIn[2],
      privateSaleLow:  f.valuationPrivate[0],
      privateSaleMid:  f.valuationPrivate[1],
      privateSaleHigh: f.valuationPrivate[2],
      valuationDate:   new Date().toISOString().slice(0, 10),
    },
  };
}

function bandFor(km: number, modelYear: number): "below-average" | "average" | "above-average" | "unknown" {
  const ageYears = Math.max(1, new Date().getFullYear() - modelYear);
  const expected = ageYears * 15_000;
  if (km < expected * 0.75) return "below-average";
  if (km > expected * 1.25) return "above-average";
  return "average";
}
