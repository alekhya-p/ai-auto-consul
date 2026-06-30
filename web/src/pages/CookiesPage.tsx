import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";

export function CookiesPage() {
  const { lang } = useI18n();
  return (
    <article className="legal-page">
      <p className="back"><Link to="/">← Terug</Link></p>
      <p className="concept-banner">
        ⚠ {lang === "nl"
          ? "Concept - niet juridisch geverifieerd."
          : "Concept - not legally reviewed yet."}
      </p>
      {lang === "nl" ? <Nl /> : <En />}
    </article>
  );
}

function Nl() {
  return (
    <>
      <h1>Cookies en lokale opslag</h1>

      <h2>Korte versie</h2>
      <p>
        Auto Consul gebruikt standaard alleen strikt noodzakelijke
        browseropslag. <strong>Analytische cookies (Google Analytics 4)
        plaatsen we uitsluitend nadat je daarvoor toestemming hebt
        gegeven</strong> in de cookiemelding - je kunt dit altijd weigeren.
      </p>

      <h2>Wat slaan we op en waar?</h2>
      <table>
        <thead>
          <tr><th>Wat</th><th>Waar</th><th>Bewaartermijn</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Taalkeuze (NL/EN)</td>
            <td>localStorage</td>
            <td>Tot je hem wijzigt</td>
          </tr>
          <tr>
            <td>Recente kentekens (max 10)</td>
            <td>IndexedDB via localforage</td>
            <td>Tot je site-data wist</td>
          </tr>
          <tr>
            <td>Cache laatste 3 dossiers</td>
            <td>IndexedDB via localforage</td>
            <td>24 uur</td>
          </tr>
          <tr>
            <td>Firebase App Check token</td>
            <td>sessionStorage</td>
            <td>1 uur · per tab</td>
          </tr>
          <tr>
            <td>Cookies-toestemming</td>
            <td>localStorage</td>
            <td>Tot je site-data wist</td>
          </tr>
        </tbody>
      </table>

      <h2>Met jouw toestemming: analyse</h2>
      <p>
        Accepteer je analytische cookies, dan gebruiken we Google Analytics 4
        (Firebase Analytics) om geanonimiseerd te meten welke pagina's en
        functies worden gebruikt (bijv. kenteken-opzoekingen, vergelijken,
        chat). Dat helpt ons het product te verbeteren. Weiger je, dan wordt
        Analytics niet geladen en worden er geen analytische gegevens
        verzonden.
      </p>

      <h2>Wat we niet gebruiken</h2>
      <ul>
        <li>Geen Meta Pixel of tracking pixels van derden.</li>
        <li>Geen advertentienetwerken.</li>
        <li>Geen profilering of analyse zonder jouw toestemming.</li>
      </ul>

      <p>
        Zie ook <Link to="/privacy">/privacy</Link>.
      </p>
    </>
  );
}

function En() {
  return (
    <>
      <h1>Cookies and local storage</h1>

      <h2>Short version</h2>
      <p>
        Auto Consul uses only strictly necessary browser storage by default.
        <strong> Analytics cookies (Google Analytics 4) are set only after you
        consent</strong> in the cookie banner - you can always decline.
      </p>

      <h2>What we store, where</h2>
      <table>
        <thead>
          <tr><th>What</th><th>Where</th><th>Retention</th></tr>
        </thead>
        <tbody>
          <tr><td>Language choice (NL/EN)</td><td>localStorage</td><td>Until you change it</td></tr>
          <tr><td>Recent plates (max 10)</td><td>IndexedDB via localforage</td><td>Until you clear site data</td></tr>
          <tr><td>Last 3 dossier payloads</td><td>IndexedDB via localforage</td><td>24 hours</td></tr>
          <tr><td>Firebase App Check token</td><td>sessionStorage</td><td>1 hour · per tab</td></tr>
          <tr><td>Cookie consent</td><td>localStorage</td><td>Until you clear site data</td></tr>
        </tbody>
      </table>

      <h2>With your consent: analytics</h2>
      <p>
        If you accept analytics cookies, we use Google Analytics 4 (Firebase
        Analytics) to measure, in aggregate, which pages and features are used
        (e.g. plate lookups, comparisons, chat) so we can improve the product.
        Decline and Analytics is never loaded - no analytics data is sent.
      </p>

      <h2>What we don't use</h2>
      <ul>
        <li>No Meta Pixel or third-party tracking pixels.</li>
        <li>No ad networks.</li>
        <li>No profiling or analytics without your consent.</li>
      </ul>

      <p>See also <Link to="/privacy">/privacy</Link>.</p>
    </>
  );
}
