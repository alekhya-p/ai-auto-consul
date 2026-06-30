import { Link } from "react-router-dom";
import { BottomSheet } from "../../components/BottomSheet";
import { useT } from "../../lib/i18n";

interface ComparePaywallSheetProps {
  onClose: () => void;
}

export function ComparePaywallSheet({ onClose }: ComparePaywallSheetProps) {
  const t = useT();

  return (
    <BottomSheet ariaLabel={t("compare.paywall.title")} onClose={onClose}>
      <div className="compare-paywall-sheet">
        <h2>{t("compare.paywall.title")}</h2>
        <p>{t("compare.paywall.body")}</p>
        <Link to="/prijzen" className="primary" onClick={onClose}>
          {t("compare.paywall.cta")}
        </Link>
        <button type="button" className="ghost" onClick={onClose}>
          {t("compare.paywall.dismiss")}
        </button>
      </div>
    </BottomSheet>
  );
}
