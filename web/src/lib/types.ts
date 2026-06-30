// Re-export the generated schema types under shorter names so call sites stay
// readable. The types themselves live in api-types.gen.ts and are regenerated
// from the private Java agent OpenAPI spec via `npm run gen:types`.
import type { components } from "./api-types.gen";

export type RdwVehicleSummary = components["schemas"]["RdwVehicleSummary"];
export type RdwLookupRequest = components["schemas"]["RdwLookupRequest"];
// ChatRequest/ChatResponse removed with the legacy Java chat (now agent-v2 / chat-v2).

// ---- /v1/voertuig/{plate} response. ----
// Hand-typed for now; openapi-drift / type-gen is skipped in CI, so until
// the next openapi.json refresh these don't appear in api-types.gen.ts.
// Mirrors RdwVehicleDetail.java. The endpoint returns the detail object
// directly (no wrapper) - AI analysis lives on a separate /analyse path.

export interface RdwVehicleDetail {
  kenteken: string;
  found: boolean;
  algemeen: RdwAlgemeen | null;
  motorMilieu: RdwMotorMilieu | null;
  carrosserie: RdwCarrosserie | null;
  status: RdwStatus | null;
  apkHistorie: RdwApkInspection[];
}

export interface RdwAlgemeen {
  merk: string | null;
  model: string | null;
  voertuigsoort: string | null;
  inrichting: string | null;
  eersteKleur: string | null;
  tweedeKleur: string | null;
  nieuwprijsEuro: number | null;
  brutoBpmEuro: number | null;
  aantalDeuren: number | null;
  aantalZitplaatsen: number | null;
  datumEersteToelating: string | null;
  datumEersteNlRegistratie: string | null;
  datumTenaamstelling: string | null;
  importauto: boolean | null;
  europeseVoertuigcategorie: string | null;
  typegoedkeuringsnummer: string | null;
  variant: string | null;
  uitvoering: string | null;
}

export interface RdwMotorMilieu {
  brandstof: string | null;
  aantalCilinders: number | null;
  cilinderinhoudCc: number | null;
  vermogenKw: number | null;
  vermogenPk: number | null;
  verbruikStad: number | null;
  verbruikSnelweg: number | null;
  verbruikGecombineerd: number | null;
  co2GecombineerdGperKm: number | null;
  zuinigheidslabel: string | null;
  uitlaatemissieniveau: string | null;
  emissiecode: string | null;
  hybrideKlasse: string | null;
  geluidsniveauRijdend: number | null;
  geluidsniveauStationair: number | null;
}

export interface RdwCarrosserie {
  lengteCm: number | null;
  breedteCm: number | null;
  hoogteCm: number | null;
  wielbasisCm: number | null;
  aantalWielen: number | null;
  massaLedigKg: number | null;
  massaRijklaarKg: number | null;
  toegestaneMaximumMassaKg: number | null;
  maxTrekkenOngeremdKg: number | null;
  maxTrekkenGeremdKg: number | null;
  vermogenMassarijklaar: number | null;
}

export interface RdwStatus {
  apkGeldigTot: string | null;
  apkGeldig: boolean | null;
  wamVerzekerd: boolean | null;
  openstaandeTerugroepactie: boolean | null;
  wokStatus: boolean | null;
  wokToelichting: string | null;
  taxi: boolean | null;
  exported: boolean | null;
  tenaamstellenMogelijk: boolean | null;
  tellerstandoordeel: string | null;
  laatsteRegistratieTellerstandJaar: number | null;
}

export interface RdwApkInspection {
  datum: string | null;
  tijd: string | null;
  soort: string | null;
  resultaat: string | null;
  aandachtspunten: string[];
}

// ---- /v1/voertuig/{plate}/marktaanbod response. ----
// Mirrors MarktaanbodListing.java + MarktaanbodResponse.

export interface MarktaanbodListing {
  title: string;
  url: string;
  source: string;
  snippet: string | null;
  priceHint: string | null;
}

export interface MarktaanbodResponse {
  listings: MarktaanbodListing[];
  fetchedAt: string | null;
}

/** UI-only message shape backing the chat thread. Not on the wire. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

// /v1/voertuig/{plate}/analyse response shape (from OpenAPI-generated types).

export type AiAnalysis = components["schemas"]["AiAnalysis"];
export type AiAnalysisMarktwaarde = components["schemas"]["Marktwaarde"];

// ---- /v1/voertuig/{plate}/kosten response ----
export type MonthlyCosts = components["schemas"]["MonthlyCosts"];
export type MonthlyCostsMrb = components["schemas"]["Mrb"];
export type MonthlyCostsRange = components["schemas"]["Range"];

/** Dutch province codes accepted by /v1/voertuig/{plate}/kosten. */
export type ProvinceCode = "DR" | "FL" | "FR" | "GE" | "GR" | "LI" | "NB" | "NH" | "OV" | "UT" | "ZE" | "ZH";
