import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { track } from "../lib/analytics";
import { useT } from "../lib/i18n";
import { clearRecent, getRecent, normalise, removeRecent } from "../lib/voertuigCache";
import { NlPlate } from "./NlPlate";

/**
 * Reusable plate-input + recent-pills row. Two sizes:
 *   - "hero"    used on / under the marketing headline
 *   - "compact" used inside /dashboard under "New analysis"
 *
 * The form behaviour (validation, normalisation, recents) is identical
 * across both - the only difference is size + density so the form looks
 * at home in each context. Single source of truth for "look up a Dutch
 * plate" UX.
 */
export function PlateLookupForm({
  variant = "hero",
  showRecents = true,
}: {
  variant?: "hero" | "compact";
  showRecents?: boolean;
}) {
  const t = useT();
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  // Inline validation message, shown only after a failed submit attempt.
  // We never disable the button - an enabled CTA that explains what's
  // missing on click is friendlier than a greyed-out dead button.
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!showRecents) return;
    getRecent().then(setRecent).catch(() => undefined);
  }, [showRecents]);

  const normalised = useMemo(() => normalise(raw), [raw]);
  const canSubmit = normalised.length >= 4 && normalised.length <= 8;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setError(true);
      return;
    }
    track("plate_lookup", { source: variant === "hero" ? "hero" : "dashboard" });
    navigate(`/voertuig/${normalised}`);
  }

  return (
    <div className={`plate-lookup plate-lookup-${variant}`}>
      <form onSubmit={onSubmit} className="lookup-form" noValidate>
        <label className="plate-field">
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="12-AB-345"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (error) setError(false);
            }}
            aria-label={t("hero.placeholder")}
            aria-invalid={error}
            aria-describedby={error ? "plate-lookup-error" : undefined}
            maxLength={10}
            required
          />
        </label>
        <button type="submit" className="btn-primary">
          {t("hero.submit")}
        </button>
      </form>
      {error && (
        <p id="plate-lookup-error" className="lookup-error" role="alert">
          {t("hero.invalid")}
        </p>
      )}

      {showRecents && recent.length > 0 && (
        <nav className="recent" aria-label={t("recent.label")}>
          <span className="recent-label">{t("recent.label")}</span>
          <ul>
            {recent.slice(0, 6).map((plate) => (
              <li key={plate}>
                <span className="recent-pill-wrap">
                  <button
                    type="button"
                    className="recent-pill"
                    onClick={() => navigate(`/voertuig/${plate}`)}
                    aria-label={plate}
                  >
                    <NlPlate value={plate} size="sm" />
                  </button>
                  <button
                    type="button"
                    className="recent-pill-remove"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await removeRecent(plate);
                      setRecent((r) => r.filter((p) => p !== plate));
                    }}
                    aria-label={t("recent.remove", { plate })}
                    title={t("recent.remove", { plate })}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {recent.length > 1 && (
            <button
              type="button"
              className="recent-clear-all"
              onClick={async () => {
                await clearRecent();
                setRecent([]);
              }}
            >
              {t("recent.clearAll")}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
