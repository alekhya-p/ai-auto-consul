import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";

/**
 * Concept Terms of Service. Marked as such until a Dutch lawyer reviews.
 * Reflects the live application: anonymous RDW lookups, accounts for AI
 * features, and paid credit packs (passes) via Stripe.
 */
export function TermsPage() {
  const { lang } = useI18n();
  return (
    <article className="legal-page">
      <p className="back"><Link to="/">← Terug</Link></p>
      <Banner />
      {lang === "nl" ? <Nl /> : <En />}
    </article>
  );
}

function Banner() {
  const { lang } = useI18n();
  return (
    <p className="concept-banner">
      ⚠ {lang === "nl"
        ? "Concept - niet juridisch geverifieerd."
        : "Concept - not legally reviewed yet."}
    </p>
  );
}

function Nl() {
  return (
    <>
      <h1>Algemene voorwaarden</h1>
      <p>Versie: concept · Laatst bijgewerkt: 27 mei 2026</p>

      <h2>1. Wie zijn wij?</h2>
      <p>
        Auto Consul (autoconsul.nl) combineert openbare RDW-gegevens met een
        AI-gestuurde toelichting over Nederlandse auto's. Wij zijn geen RDW,
        de Belastingdienst, een autobedrijf of een verzekeraar.
      </p>

      <h2>2. Account</h2>
      <p>
        Een kentekencheck kan zonder account. Voor AI-chat, de volledige
        AI-analyse en opgeslagen dossiers maak je een account aan (e-mail of
        Google). Je bent verantwoordelijk voor het geheimhouden van je
        inloggegevens.
      </p>

      <h2>3. Wat wij wel doen</h2>
      <ul>
        <li>Een kenteken opzoeken in het openbare RDW-register en de gegevens overzichtelijk tonen.</li>
        <li>Een AI-analyse maken die RDW-data combineert met algemene marktkennis (marktwaarde, milieuzones, vergelijkingen).</li>
        <li>Waar nodig actuele informatie ophalen via een webzoekopdracht (Google Search), met bronvermelding.</li>
      </ul>

      <h2>4. Wat wij niet doen</h2>
      <ul>
        <li>Geen taxatie. Schattingen zijn indicatief.</li>
        <li>Geen juridisch, fiscaal of verzekeringsadvies.</li>
        <li>Geen schadehistorie of advertentiegeschiedenis.</li>
      </ul>

      <h2>5. Credits en passen</h2>
      <p>
        Kentekenchecks zijn gratis (met een dagelijkse limiet voor niet-betaalde
        gebruikers). De volledige AI-analyse en chat verbruiken credits uit een
        betaalde pas (vanaf €4,95). Een pas is een eenmalige aankoop - geen
        abonnement en geen automatische verlenging - en is 30 dagen geldig.
        Actuele prijzen en wat elke pas ontgrendelt vind je op
        <Link to="/prijzen"> /prijzen</Link>.
      </p>

      <h2>6. Betaling en herroeping</h2>
      <p>
        Betalingen verlopen via Stripe; wij bewaren geen kaartgegevens. Op grond
        van het Nederlandse consumentenrecht heb je 14 dagen herroepingsrecht.
        Ongebruikte credits worden volledig terugbetaald; we rekenen alleen wat
        je hebt gebruikt. Mail <a href="mailto:support@autoconsul.nl">support@autoconsul.nl</a>
        met je ordernummer.
      </p>

      <h2>7. Toegestaan gebruik</h2>
      <p>
        Gebruik de dienst voor je eigen auto-aankoopbeslissingen. Geautomatiseerd
        uitlezen (scraping), omzeilen van limieten of doorverkopen van de data is
        niet toegestaan. Bij misbruik kunnen we toegang beperken of het account
        beëindigen.
      </p>

      <h2>8. AI-output</h2>
      <p>
        Alle AI-gegenereerde inhoud is voorzien van het label
        <em> "Indicatief"</em>. Beslissingen over prijs, belasting of toekomstige
        milieuzones blijven jouw verantwoordelijkheid; verifieer bij RDW,
        Belastingdienst of een professionele adviseur voor bindende uitspraken.
      </p>

      <h2>9. Aansprakelijkheid</h2>
      <p>
        Auto Consul aanvaardt geen aansprakelijkheid voor schade die voortvloeit
        uit het gebruik van de dienst. We doen ons best accurate gegevens te
        tonen, maar de bron (RDW) kan vertraging of fouten bevatten.
      </p>

      <h2>10. Wijzigingen en toepasselijk recht</h2>
      <p>
        We kunnen deze voorwaarden aanpassen; de laatste versie staat altijd op
        deze pagina. Op deze voorwaarden is Nederlands recht van toepassing.
      </p>

      <h2>11. Contact</h2>
      <p>Vragen? Mail <a href="mailto:contact@autoconsul.nl">contact@autoconsul.nl</a>.</p>
    </>
  );
}

function En() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Version: draft · Last updated: 27 May 2026</p>

      <h2>1. Who we are</h2>
      <p>
        Auto Consul (autoconsul.nl) combines public RDW vehicle-registry data
        with an AI-driven analysis layer for Dutch cars. We are not the RDW, the
        Dutch tax authority, a dealership, or an insurer.
      </p>

      <h2>2. Accounts</h2>
      <p>
        A plate check works without an account. For AI chat, the full AI
        analysis and saved dossiers you create an account (email or Google). You
        are responsible for keeping your login credentials safe.
      </p>

      <h2>3. What we do</h2>
      <ul>
        <li>Look up a plate in the public RDW registry and display the data clearly.</li>
        <li>Produce an AI analysis combining RDW data with general market knowledge (market value, emission zones, comparisons).</li>
        <li>Where needed, fetch current information via a web search (Google Search), with sources cited.</li>
      </ul>

      <h2>4. What we don't do</h2>
      <ul>
        <li>No formal valuation - estimates are indicative.</li>
        <li>No legal, tax, or insurance advice.</li>
        <li>No damage history or ad history.</li>
      </ul>

      <h2>5. Credits and passes</h2>
      <p>
        Plate checks are free (with a daily limit for non-paying users). The full
        AI analysis and chat consume credits from a paid pass (from €4.95). A pass
        is a one-off purchase - no subscription and no auto-renewal - valid for 30
        days. Current prices and what each pass unlocks are on
        <Link to="/prijzen"> /prijzen</Link>.
      </p>

      <h2>6. Payment and withdrawal</h2>
      <p>
        Payments are handled by Stripe; we store no card details. Under Dutch
        consumer law you have a 14-day right of withdrawal. Unused credits are
        refunded in full; we only charge for what you've used. Email
        <a href="mailto:support@autoconsul.nl"> support@autoconsul.nl</a> with your
        order number.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Use the service for your own car-buying decisions. Automated scraping,
        circumventing limits, or reselling the data is not allowed. We may
        restrict access or terminate an account in case of abuse.
      </p>

      <h2>8. AI output</h2>
      <p>
        All AI-generated content is labelled <em>"Indicative"</em>. Decisions
        about price, tax, or future emission zones remain your responsibility;
        verify with the RDW, the Belastingdienst, or a professional advisor for
        binding answers.
      </p>

      <h2>9. Liability</h2>
      <p>
        Auto Consul accepts no liability for damages resulting from use of the
        service. We do our best to surface accurate data, but the upstream source
        (RDW) may have delays or errors.
      </p>

      <h2>10. Changes and governing law</h2>
      <p>
        We may update these terms; the latest version is always on this page.
        These terms are governed by Dutch law.
      </p>

      <h2>11. Contact</h2>
      <p>Questions? Email <a href="mailto:contact@autoconsul.nl">contact@autoconsul.nl</a>.</p>
    </>
  );
}
