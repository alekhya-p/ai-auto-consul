import { Link } from "react-router-dom";
import { useT } from "../../lib/i18n";

interface ComparePreviewBannerProps {
  variant: "guest" | "free";
  signUpNext?: string;
}

export function ComparePreviewBanner({ variant, signUpNext }: ComparePreviewBannerProps) {
  const t = useT();
  const isGuest = variant === "guest";
  const ctaHref = isGuest
    ? `/sign-up?next=${encodeURIComponent(signUpNext ?? "/compare")}`
    : "/prijzen";

  return (
    <div className="compare-preview-banner" role="status">
      <p>{isGuest ? t("compare.guestPreview.banner") : t("compare.freePreview.banner")}</p>
      <Link to={ctaHref} className="primary compare-preview-cta">
        {isGuest ? t("compare.guestPreview.cta") : t("compare.freePreview.cta")}
      </Link>
    </div>
  );
}
