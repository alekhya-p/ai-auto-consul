import { Link, useLocation } from "react-router-dom";
import { useT, useTList } from "../lib/i18n";
import { isChatFocusRoute } from "../lib/routeFocus";

/**
 * Site footer - content-rich on desktop (4 columns), stacked on mobile.
 *
 * Columns:
 *   1. About blurb + brand mark
 *   2. Product (links to Home / How it works / About / Blog)
 *   3. Legal (Terms / Privacy / Cookies)
 *   4. Stay in touch (contact + dummy social placeholders for v2.5)
 *
 * Copyright row at the bottom with a small "Built in NL" mark.
 */
export function SiteFooter() {
  const t = useT();
  const { pathname } = useLocation();
  if (isChatFocusRoute(pathname)) return null;

  const year = new Date().getFullYear();
  const aboutBlurb = t("footer.about");
  const productLinks = useTList()("footer.productLinks");
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer-inner">
        <div className="about">
          <span className="brand-mark" aria-hidden="true">AC</span>
          <p>{aboutBlurb}</p>
        </div>

        <div>
          <h4>{t("footer.productHeading")}</h4>
          <ul>
            <li><Link to="/">{productLinks[0] ?? "Home"}</Link></li>
            <li><Link to="/hoe-werkt-het">{productLinks[1] ?? "Hoe werkt het"}</Link></li>
            <li><Link to="/over">{productLinks[2] ?? "Over ons"}</Link></li>
            <li><Link to="/blog">{productLinks[3] ?? "Blog"}</Link></li>
          </ul>
        </div>

        <div>
          <h4>{t("footer.legalHeading")}</h4>
          <ul>
            <li><Link to="/terms">{t("footer.terms")}</Link></li>
            <li><Link to="/privacy">{t("footer.privacy")}</Link></li>
            <li><Link to="/cookies">{t("footer.cookies")}</Link></li>
          </ul>
        </div>

        <div>
          <h4>{t("footer.contactHeading")}</h4>
          <ul>
            <li>
              <a href="mailto:contact@autoconsul.nl">contact@autoconsul.nl</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="site-footer-bottom">
        <span>© {year} Auto Consul · {t("footer.builtIn")}</span>
        <span>{t("footer.trademark")}</span>
      </div>
    </footer>
  );
}
