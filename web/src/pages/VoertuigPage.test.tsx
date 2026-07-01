import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RdwVehicleDetail } from "../lib/types";

// Mock the API + the cache before importing the page so the mocks are
// in place when VoertuigPage's useEffect runs.
// Mocks return resolved promises by default so the page's `.catch(...)`
// on fire-and-forget calls (addRecent, putCached) has something to chain
// off. A vi.fn() returns undefined which would `.catch` on undefined.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetVoertuig: any = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetMarktaanbod: any = vi.fn(async () => ({ listings: [], fetchedAt: null }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetCached: any = vi.fn(async () => null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPutCached: any = vi.fn(async () => undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAddRecent: any = vi.fn(async () => undefined);

vi.mock("../lib/api", () => ({
  getVoertuig: (plate: string, signal?: AbortSignal) => mockGetVoertuig(plate, signal),
  getMarktaanbod: () => mockGetMarktaanbod(),
  getMonthlyCosts: () => new Promise(() => {}),
  LookupError: class LookupError extends Error {
    constructor(message: string, public readonly status?: number) {
      super(message);
    }
  },
  DailyLimitError: class DailyLimitError extends Error {
    constructor(
      message: string,
      public readonly feature: "rdw_lookup" | "ai_analysis",
      public readonly limit: number,
    ) {
      super(message);
    }
  },
  saveDossier: () => Promise.resolve(),
}));

vi.mock("../lib/voertuigCache", () => ({
  addRecent: (plate: string) => mockAddRecent(plate),
  getCached: (plate: string) => mockGetCached(plate),
  putCached: (plate: string, payload: RdwVehicleDetail) => mockPutCached(plate, payload),
  prettyPlate: (raw: string) => raw,
  normalise: (raw: string) => raw.replace(/[\s-]/g, "").toUpperCase(),
}));

import { LanguageProvider } from "../lib/i18n";
import { VoertuigPage } from "./VoertuigPage";

function detail(overrides: Partial<RdwVehicleDetail> = {}): RdwVehicleDetail {
  return {
    kenteken: "J650NX",
    found: true,
    algemeen: {
      merk: "OPEL", model: "KARL / VIVA", voertuigsoort: "Personenauto",
      inrichting: "hatchback", eersteKleur: "Grijs", tweedeKleur: null,
      nieuwprijsEuro: 12647, brutoBpmEuro: 1693, aantalDeuren: 5, aantalZitplaatsen: 5,
      datumEersteToelating: "2017-12-29", datumEersteNlRegistratie: "2017-12-29",
      datumTenaamstelling: "2025-07-16", importauto: false,
      europeseVoertuigcategorie: "M1", typegoedkeuringsnummer: "e4*2007/46",
      variant: "DHX", uitvoering: "B11",
    },
    motorMilieu: {
      brandstof: "Benzine", aantalCilinders: 3, cilinderinhoudCc: 999,
      vermogenKw: 55, vermogenPk: 75,
      verbruikStad: 5.1, verbruikSnelweg: 3.7, verbruikGecombineerd: 4.1,
      co2GecombineerdGperKm: 94, zuinigheidslabel: "B",
      uitlaatemissieniveau: "EURO 6", emissiecode: "6",
      hybrideKlasse: null, geluidsniveauRijdend: 71, geluidsniveauStationair: 74,
    },
    carrosserie: {
      lengteCm: 368, breedteCm: 160, hoogteCm: 149, wielbasisCm: 239, aantalWielen: 4,
      massaLedigKg: 839, massaRijklaarKg: 939,
      toegestaneMaximumMassaKg: 1353, maxTrekkenOngeremdKg: 500, maxTrekkenGeremdKg: 1000,
      vermogenMassarijklaar: 0.06,
    },
    status: {
      apkGeldigTot: "2026-07-15", apkGeldig: true,
      wamVerzekerd: true, openstaandeTerugroepactie: false,
      wokStatus: false, wokToelichting: null,
      taxi: false, exported: false, tenaamstellenMogelijk: true,
      tellerstandoordeel: "Logisch", laatsteRegistratieTellerstandJaar: 2025,
    },
    apkHistorie: [],
    ...overrides,
  };
}

function renderPage(plate = "J650NX") {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[`/voertuig/${plate}`]}>
        <Routes>
          <Route path="/voertuig/:plate" element={<VoertuigPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  mockGetCached.mockImplementation(async () => null);
});

describe("<VoertuigPage />", () => {
  it("shows the loading state while fetching", async () => {
    let resolveFetch: (d: RdwVehicleDetail) => void = () => undefined;
    mockGetVoertuig.mockImplementation(
      () => new Promise<RdwVehicleDetail>((res) => { resolveFetch = res; })
    );
    renderPage();
    // Wait for the page to advance past the (async) cache lookup and
    // actually start the fetch - only then is the loading state shown.
    await waitFor(() => expect(screen.getByText(/Bezig met ophalen|Fetching from RDW/)).toBeInTheDocument());
    resolveFetch(detail());
    await waitFor(() => expect(screen.queryByText(/Bezig met ophalen/)).not.toBeInTheDocument());
  });

  it("paints all RDW sections on a happy fetch", async () => {
    mockGetVoertuig.mockResolvedValue(detail());
    renderPage();
    await waitFor(() => expect(screen.getByText("Algemene informatie")).toBeInTheDocument());
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Motor en milieu")).toBeInTheDocument();
    // The structured AI analysis card moved to the v2 chat agent, so it is no
    // longer rendered on this page.
    expect(
      screen.queryByText(/Auto Consul is jouw auto aan het analyseren/),
    ).not.toBeInTheDocument();
  });

  it("shows the not-found card when RDW returns found=false", async () => {
    mockGetVoertuig.mockResolvedValue(detail({ found: false, algemeen: null, motorMilieu: null, status: null }));
    renderPage();
    await waitFor(() => expect(screen.getByText(/staat niet in het RDW register/i)).toBeInTheDocument());
  });

  it("hits the cache first and skips the backend on a warm cache", async () => {
    mockGetCached.mockResolvedValue(detail());
    renderPage();
    await waitFor(() => expect(screen.getByText("Algemene informatie")).toBeInTheDocument());
    expect(mockGetVoertuig).not.toHaveBeenCalled();
    expect(mockAddRecent).toHaveBeenCalledWith("J650NX");
  });

  it("writes back to the cache after a successful backend fetch", async () => {
    mockGetVoertuig.mockResolvedValue(detail());
    renderPage();
    await waitFor(() => expect(mockPutCached).toHaveBeenCalledWith("J650NX", expect.any(Object)));
  });

  it("surfaces a lookup error to the user", async () => {
    const { LookupError } = await import("../lib/api");
    mockGetVoertuig.mockRejectedValue(new LookupError("Lookup failed (500)", 500));
    renderPage();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Lookup failed/));
  });

  it("flips labels AND data values to English when lang=en", async () => {
    // The provider reads ?lang=en from window.location.search on init.
    // jsdom only lets us set window.location indirectly, so go through
    // history.replaceState which is supported.
    window.history.replaceState({}, "", "/voertuig/J650NX?lang=en");
    mockGetVoertuig.mockResolvedValue(detail());
    renderPage();

    // Labels in English (was "Algemene informatie" in NL):
    await waitFor(() =>
      expect(screen.getByText("General information")).toBeInTheDocument()
    );
    expect(screen.getByText("Engine & emissions")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Body & weights")).toBeInTheDocument();

    // Row labels in English:
    expect(screen.getByText("Make")).toBeInTheDocument();
    expect(screen.getByText("Vehicle type")).toBeInTheDocument();
    expect(screen.getByText("Body style")).toBeInTheDocument();
    expect(screen.getByText("Colour")).toBeInTheDocument();
    // "Fuel" appears twice - hero tile label + Motor section row label.
    expect(screen.getAllByText("Fuel").length).toBeGreaterThanOrEqual(2);

    // Data values translated via rdwTranslate:
    //   Personenauto → Passenger car
    //   hatchback    → Hatchback
    //   Grijs        → Grey
    //   Benzine      → Petrol
    //   Logisch      → Logical (consistent)
    expect(screen.getByText("Passenger car")).toBeInTheDocument();
    expect(screen.getByText("Hatchback")).toBeInTheDocument();
    expect(screen.getByText("Grey")).toBeInTheDocument();
    // "Petrol" appears in both the hero tile + the Engine row, so query
    // by getAllByText and expect at least one.
    expect(screen.getAllByText("Petrol").length).toBeGreaterThan(0);
    expect(screen.getByText("Logical (consistent)")).toBeInTheDocument();

    // Reset for the next test.
    window.history.replaceState({}, "", "/");
  });
});
