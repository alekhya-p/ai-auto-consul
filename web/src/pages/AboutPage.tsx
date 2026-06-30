import { Link } from "react-router-dom";
import { useT, useTList } from "../lib/i18n";

/**
 * /over - About page. Mission + trust principles + contact. Replaces
 * the previous one-paragraph stub.
 */
export function AboutPage() {
  const t = useT();
  const tList = useTList();
  const principles = tList("about.principles.items");
  return (
    <article className="about-page">
      <header className="content-hero">
        <p className="eyebrow">{t("nav.about")}</p>
        <h1>{t("about.title")}</h1>
        <p className="lede">{t("about.lede")}</p>
      </header>

      <section>
        <h2>{t("about.mission.title")}</h2>
        <p>{t("about.mission.body")}</p>
      </section>

      <section>
        <h2>{t("about.principles.title")}</h2>
        <ul className="about-principles">
          {principles.map((p, i) => {
            const [title, body] = p.split("|");
            return (
              <li key={i} className="about-principle">
                <strong>{title?.trim()}</strong>
                <p>{body?.trim()}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>{t("about.data.title")}</h2>
        <p>{t("about.data.body")}</p>
      </section>

      <section className="about-contact">
        <strong>{t("about.contact.title")}</strong>
        <p>
          {t("about.contact.body")}{" "}
          <a href="mailto:support@autoconsul.nl">support@autoconsul.nl</a>
        </p>
      </section>

      <section>
        <p>
          <Link to="/hoe-werkt-het">{t("nav.how")}</Link>{" · "}
          <Link to="/prijzen">{t("nav.pricing")}</Link>{" · "}
          <Link to="/blog">{t("nav.blog")}</Link>
        </p>
      </section>
    </article>
  );
}
