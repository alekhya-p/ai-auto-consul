/**
 * Pack metadata for the pricing page. Mirrored from the agent's
 * `Pack.java` (credits + chat turns) and the Stripe test-mode catalogue
 * (prices). Single source of truth for marketing copy lives here on the
 * web side; the agent only knows credit/chat counts and price IDs.
 */
export type PackId = "SINGLE" | "COMPARE3" | "POWER10";

export interface Pack {
  id: PackId;
  /** Display price string including currency symbol. */
  price: string;
  /** Saving copy vs single-purchase equivalent; null when not applicable. */
  saving: string | null;
  credits: number;
  chatTurns: number;
  /** Pass validity in days. */
  validityDays: number;
  /** Marks the visually-highlighted "most popular" tier. */
  highlight?: boolean;
}

export const PACKS: Pack[] = [
  {
    id: "SINGLE",
    price: "€ 4,95",
    saving: null,
    credits: 1,
    chatTurns: 10,
    validityDays: 30,
  },
  {
    id: "COMPARE3",
    price: "€ 11,95",
    saving: "€ 2,90",
    credits: 3,
    chatTurns: 30,
    validityDays: 30,
    highlight: true,
  },
  {
    id: "POWER10",
    price: "€ 34,95",
    saving: "€ 14,55",
    credits: 10,
    chatTurns: 100,
    validityDays: 60,
  },
];
