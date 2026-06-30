import { useEffect, useState } from "react";
import { getMarktaanbod } from "../lib/api";
import { useT } from "../lib/i18n";
import { InfoButton } from "./InfoButton";
import type { MarktaanbodListing } from "../lib/types";

/**
 * Horizontal-scroll strip of comparable Dutch market listings.
 *
 * Pulls from /v1/voertuig/:plate/marktaanbod (Google CSE-backed when
 * configured; empty list otherwise). Renders nothing at all when the
 * list is empty so the page doesn't show a stub heading without
 * list is empty so the page does not show a heading without content.
 *
 * Auto-fetched on plate change; freshness pill in the badge shows how
 * old the underlying CSE response is (helps the user judge price
 * trustworthiness without us claiming it's "live live").
 */
export function MarktaanbodScroll({ plate }: { plate: string }) {
  const t = useT();
  const [listings, setListings] = useState<MarktaanbodListing[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getMarktaanbod(plate, ac.signal)
      .then((r) => {
        setListings(r.listings);
        setFetchedAt(r.fetchedAt);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [plate]);

  if (listings.length === 0) return null;

  return (
    <section className="card marktaanbod">
      <header>
        <h2>
          {t("voertuig.section.marktaanbod")}{" "}
          <span className="badge badge-marktaanbod" title={fetchedAt ?? ""}>
            {t("voertuig.badge.marktaanbod")}
          </span>
          <InfoButton textKey="voertuig.help.badgeMarktaanbod" />
        </h2>
      </header>
      <ol className="marktaanbod-scroll">
        {listings.map((l, i) => (
          <li key={`${l.url}-${i}`}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              <div className="marktaanbod-source">{l.source}</div>
              <div className="marktaanbod-title">{l.title}</div>
              {l.priceHint && <div className="marktaanbod-price">{l.priceHint}</div>}
              {l.snippet && <p className="marktaanbod-snippet">{truncate(l.snippet, 140)}</p>}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
