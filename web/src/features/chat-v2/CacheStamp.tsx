import { useI18n, useT } from "../../lib/i18n";

/** Shows when a card payload was served from the 24h server cache. */
export function CacheStamp({ cachedAt }: { cachedAt?: string }) {
  const t = useT();
  const { lang } = useI18n();
  if (!cachedAt) return null;
  let when = cachedAt;
  try {
    when = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(cachedAt));
  } catch {
    /* keep raw */
  }
  return (
    <p className="cv2-cache-stamp" title={cachedAt}>
      {t("chat.cache.updated", { when })}
    </p>
  );
}
