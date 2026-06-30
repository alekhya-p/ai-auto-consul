/**
 * Pack types and credit/chat-turn amounts for Stripe checkout.
 * Must stay aligned with the Java Pack enum in the private backend.
 */
export type Pack = "SINGLE" | "COMPARE3" | "POWER10";

export const PACK_DETAILS: Record<Pack, { credits: number; chatTurns: number }> = {
  SINGLE:   { credits: 1,  chatTurns: 10 },
  COMPARE3: { credits: 3,  chatTurns: 30 },
  POWER10:  { credits: 10, chatTurns: 100 },
};

export function isPack(value: unknown): value is Pack {
  return value === "SINGLE" || value === "COMPARE3" || value === "POWER10";
}

export type Tier = "free" | "pass" | "pro" | "power";

/**
 * Map a purchased pack to the Firebase custom claim tier.
 * maxTier picks the highest tier when the user has multiple active passes.
 */
export function packTier(pack: Pack): Tier {
  switch (pack) {
    case "SINGLE":   return "pass";
    case "COMPARE3": return "pro";
    case "POWER10":  return "power";
  }
}

/**
 * Rank for tier comparison. Higher = more capabilities. Used by the
 * webhook to compute the user's effective tier across multiple
 * active passes - buying a smaller pack later should never downgrade
 * a still-active bigger pack.
 */
const TIER_RANK: Record<Tier, number> = {
  free:  0,
  pass:  1,
  pro:   2,
  power: 3,
};

/** Return the higher-ranked of two tiers. */
export function maxTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}
