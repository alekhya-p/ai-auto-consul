import localforage from "localforage";
import { scopedLocalKey } from "./userScope";
import type { RdwVehicleDetail } from "./types";

/**
 * Browser-side cache for the /voertuig dossier, backed by IndexedDB via
 * localforage. Two responsibilities:
 *
 *   - **Recent-lookups list** - every plate the user has viewed,
 *     newest-first, capped at 10. Survives tab close. Drives the
 *     HomePage's recent-lookups row + the "back to my last lookup"
 *     intuition that returning users expect.
 *
 *   - **Payload cache (24h TTL)** - last 3 full payloads keyed by plate
 *     so a returning visitor (closed tab → reopened tomorrow) gets an
 *     instant render rather than a 5s cache-miss skeleton (24h TTL).
 *
 * Failure mode: localforage may be unavailable (private-mode Safari,
 * tracking-protection extensions). All reads are best-effort - they
 * return null/[] when the store is down, and the caller falls back to
 * a fresh backend fetch.
 */

const RECENT_NAME = "recent-plates";
const LEGACY_RECENT_KEY = "recent-plates";

function recentKey(): string {
  return scopedLocalKey(RECENT_NAME);
}
const PAYLOAD_PREFIX = "voertuig:";
const PAYLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RECENT = 10;
const MAX_PAYLOADS = 3;

interface CachedPayload {
  plate: string;
  cachedAt: number;
  payload: RdwVehicleDetail;
}

localforage.config({
  name: "auto-consul",
  storeName: "voertuig",
  description: "Auto Consul local dossier cache",
});

export async function addRecent(plate: string): Promise<void> {
  try {
    const normalised = normalise(plate);
    if (!normalised) return;
    await migrateLegacyRecentIfNeeded();
    const current = (await localforage.getItem<string[]>(recentKey())) ?? [];
    const next = [normalised, ...current.filter((p) => p !== normalised)].slice(0, MAX_RECENT);
    await localforage.setItem(recentKey(), next);
  } catch {
    /* ignore - best-effort */
  }
}

export async function getRecent(): Promise<string[]> {
  try {
    await migrateLegacyRecentIfNeeded();
    return (await localforage.getItem<string[]>(recentKey())) ?? [];
  } catch {
    return [];
  }
}

export async function clearRecent(): Promise<void> {
  try {
    await localforage.removeItem(recentKey());
    await localforage.removeItem(LEGACY_RECENT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Remove a single plate from the recent-lookups list AND drop its cached
 * payload (so a re-lookup starts fresh). Used by the "✕" controls on the
 * home recent-pills row and the dashboard tiles.
 */
export async function removeRecent(plate: string): Promise<void> {
  const normalised = normalise(plate);
  if (!normalised) return;
  try {
    await migrateLegacyRecentIfNeeded();
    const current = (await localforage.getItem<string[]>(recentKey())) ?? [];
    const next = current.filter((p) => p !== normalised);
    await localforage.setItem(recentKey(), next);
  } catch {
    /* ignore */
  }
  try {
    const key = payloadKey(normalised);
    if (key) await localforage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function getCached(plate: string): Promise<RdwVehicleDetail | null> {
  const key = payloadKey(plate);
  if (!key) return null;
  try {
    const hit = await localforage.getItem<CachedPayload>(key);
    if (!hit) return null;
    if (Date.now() - hit.cachedAt > PAYLOAD_TTL_MS) {
      await localforage.removeItem(key);
      return null;
    }
    return hit.payload;
  } catch {
    return null;
  }
}

export async function putCached(plate: string, payload: RdwVehicleDetail): Promise<void> {
  const key = payloadKey(plate);
  if (!key) return;
  try {
    await localforage.setItem(key, {
      plate: normalise(plate),
      cachedAt: Date.now(),
      payload,
    } satisfies CachedPayload);
    await evictOldPayloads();
  } catch {
    /* ignore */
  }
}

/** Keep at most MAX_PAYLOADS payload entries - drop the oldest. */
async function evictOldPayloads(): Promise<void> {
  try {
    const keys = await localforage.keys();
    const payloadKeys = keys.filter((k) => k.startsWith(PAYLOAD_PREFIX));
    if (payloadKeys.length <= MAX_PAYLOADS) return;
    const entries: Array<{ key: string; cachedAt: number }> = [];
    for (const k of payloadKeys) {
      const v = await localforage.getItem<CachedPayload>(k);
      entries.push({ key: k, cachedAt: v?.cachedAt ?? 0 });
    }
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    const toDrop = entries.slice(0, entries.length - MAX_PAYLOADS);
    await Promise.all(toDrop.map((e) => localforage.removeItem(e.key)));
  } catch {
    /* ignore */
  }
}

export function normalise(plate: string): string {
  return plate.replace(/[\s-]/g, "").toUpperCase();
}

/** One-time: do not copy legacy recent list into a signed-in scope (privacy). */
async function migrateLegacyRecentIfNeeded(): Promise<void> {
  try {
    const legacy = await localforage.getItem<string[]>(LEGACY_RECENT_KEY);
    if (legacy?.length) {
      await localforage.removeItem(LEGACY_RECENT_KEY);
    }
  } catch {
    /* ignore */
  }
}

function payloadKey(plate: string): string | null {
  const n = normalise(plate);
  if (!n || n.length < 4) return null;
  return PAYLOAD_PREFIX + n;
}

/**
 * Pretty-print a Dutch plate for display.
 *
 * Standard Dutch sidecodes are 6 characters split into three groups that
 * alternate between letters and digits. Examples covering every modern
 * sidecode shape:
 *   sidecode 1 (LL-DD-DD): AB-12-34
 *   sidecode 3 (DD-LL-DD): 12-AB-34
 *   sidecode 7 (DD-LLL-D): 20-TRF-4
 *   sidecode 8 (D-LLL-DD): 1-ABC-23
 *   sidecode 9 (LL-DDD-L): AB-123-C
 *   sidecode 10 (L-DDD-LL): J-640-HT
 *
 * Algorithm: collapse the alphanumeric input into runs of consecutive
 * same-type characters (letter vs digit) and hyphenate when we end up
 * with exactly three runs. That's correct for every sidecode without
 * having to enumerate them. Falls back to the raw input otherwise.
 */
export function prettyPlate(raw: string): string {
  const n = normalise(raw);
  if (!/^[A-Z0-9]+$/.test(n) || n.length !== 6) return n;
  const runs: string[] = [];
  let current = "";
  let runIsDigit = false;
  for (const ch of n) {
    const isDigit = ch >= "0" && ch <= "9";
    if (current && isDigit !== runIsDigit) {
      runs.push(current);
      current = "";
    }
    current += ch;
    runIsDigit = isDigit;
  }
  if (current) runs.push(current);

  // Sidecodes 3/4/7/8/9/10 form three alternating runs already.
  if (runs.length === 3) return runs.join("-");
  // Sidecodes 1/2/5/6 collapse into two runs because two same-type pairs
  // sit next to each other (e.g. AB-CD-12 reads as one 4-letter run +
  // one 2-digit run). Split the 4-char run down the middle.
  if (runs.length === 2) {
    const [a, b] = runs;
    if (a.length === 4 && b.length === 2) return `${a.slice(0, 2)}-${a.slice(2)}-${b}`;
    if (a.length === 2 && b.length === 4) return `${a}-${b.slice(0, 2)}-${b.slice(2)}`;
  }
  return n;
}
