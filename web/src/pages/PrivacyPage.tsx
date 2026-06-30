import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";

/**
 * Concept Privacy Policy. Reflects the live application: anonymous RDW
 * lookups, accounts (Firebase Auth), payments (Stripe), and AI analysis/chat
 * on Google Vertex AI (Gemini). Includes the GDPR Article 22 disclosure for
 * the automated AI analysis.
 */
export function PrivacyPage() {
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
      <h1>Privacybeleid</h1>
      <p>Versie: concept · Laatst bijgewerkt: 27 mei 2026</p>

      <h2>Wie zijn wij?</h2>
      <p>
        Auto Consul (autoconsul.nl) levert kentekenrapporten op basis van
        officiële RDW-data, met optionele AI-analyse en chat. Vragen of
        verzoeken? Mail <a href="mailto:contact@autoconsul.nl">contact@autoconsul.nl</a>.
      </p>

      <h2>Welke gegevens verwerken wij?</h2>
      <ul>
        <li><strong>Kenteken-zoekopdrachten</strong> - om RDW-data en een
          indicatieve marktwaarde op te halen. Een kentekencheck kan anoniem,
          zonder account.</li>
        <li><strong>Accountgegevens</strong> - als je een account aanmaakt voor
          AI-chat en opgeslagen dossiers: je e-mailadres en (bij Google-login)
          je naam, via Firebase Authentication.</li>
        <li><strong>Opgeslagen dossiers &amp; chatgeschiedenis</strong> -
          gekoppeld aan je account zodat je ze later terugvindt.</li>
        <li><strong>Credits, passen en gebruik</strong> - we houden bij welke
          tools een credit kostten (chat, AI-analyse) en welke pas je hebt
          gekocht, voor een transparant gebruiksoverzicht.</li>
        <li><strong>Betaalgegevens</strong> - betalingen lopen via Stripe. Wij
          slaan <em>geen</em> kaartgegevens op; we bewaren alleen een
          order-referentie.</li>
        <li><strong>Caches</strong> - RDW- en analyseresultaten worden tot 24 uur
          lokaal en server-side bewaard (sneller en goedkoper hergebruik).</li>
        <li><strong>IP-adres</strong> - alleen om misbruik te beperken
          (rate-limiting) en via Firebase App Check / reCAPTCHA Enterprise om
          geautomatiseerd misbruik te weren.</li>
      </ul>

      <h2>Met wie delen wij gegevens (subverwerkers)?</h2>
      <ul>
        <li><strong>Google Cloud / Firebase</strong> - hosting, authenticatie,
          database (Firestore), opslag en AI (Vertex AI), in de EU.</li>
        <li><strong>Stripe</strong> - betalingsverwerking.</li>
        <li><strong>RDW Open Data</strong> - bron van de officiële voertuigdata.</li>
        <li><strong>Autotelex</strong> - indicatieve marktwaarde.</li>
        <li><strong>Google Search</strong> - alleen wanneer een vraag een
          actuele webzoekopdracht vereist.</li>
        <li><strong>Google Analytics 4</strong> - geanonimiseerde
          gebruiksstatistieken, alleen met jouw toestemming.</li>
      </ul>

      <h2>Waar staan jouw gegevens?</h2>
      <p>
        Verwerking vindt plaats binnen de EU (Google Cloud, regio
        europe-west4, en multi-region eur3 voor Firestore). AI-analyse en chat
        draaien op Google's Gemini-modellen via Vertex AI.
      </p>

      <h2>Hoe lang bewaren wij gegevens?</h2>
      <ul>
        <li>Caches: maximaal 24 uur.</li>
        <li>IP-adres voor rate-limiting: kort, in werkgeheugen.</li>
        <li>Account, dossiers, chatgeschiedenis en gebruiksoverzicht: zolang je
          account bestaat. Bij verwijdering wissen we deze.</li>
      </ul>

      <h2>AI-gestuurde analyse - Artikel 22 AVG</h2>
      <p>
        Onze AI-analyse is een geautomatiseerd proces dat substantiële
        uitspraken doet over je auto (geschatte waarde, toekomstige
        milieuzone-status, vergelijkingen). Op grond van Artikel 22 AVG heb je
        het recht:
      </p>
      <ul>
        <li>te weten dat dit een geautomatiseerd proces is - vandaar het
          <em> "AI · Indicatief"</em> label op elk AI-blok.</li>
        <li>op menselijke tussenkomst - stuur ons je vraag via
          <a href="mailto:contact@autoconsul.nl"> contact@autoconsul.nl</a>.</li>
        <li>bezwaar te maken - we passen de analyse aan of verwijderen je
          zoekopdracht op verzoek.</li>
      </ul>

      <h2>Cookies en lokale opslag</h2>
      <p>
        Zie <Link to="/cookies">/cookies</Link>. Standaard alleen strikt
        noodzakelijke lokale opslag (recente zoekopdrachten, taalkeuze,
        ingelogde sessie) en de Firebase App Check-token. Analytische cookies
        (Google Analytics 4) gebruiken we uitsluitend met jouw toestemming.
      </p>

      <h2>Jouw rechten</h2>
      <p>
        Inzage, verwijdering, correctie, bezwaar en dataportabiliteit - mail
        <a href="mailto:contact@autoconsul.nl"> contact@autoconsul.nl</a>. Je kunt
        ook een klacht indienen bij de Autoriteit Persoonsgegevens.
      </p>
    </>
  );
}

function En() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Version: draft · Last updated: 27 May 2026</p>

      <h2>Who we are</h2>
      <p>
        Auto Consul (autoconsul.nl) provides licence-plate reports based on
        official RDW data, with optional AI analysis and chat. Questions or
        requests? Email <a href="mailto:contact@autoconsul.nl">contact@autoconsul.nl</a>.
      </p>

      <h2>What data do we process?</h2>
      <ul>
        <li><strong>Plate lookups</strong> - to fetch RDW data and an
          indicative market value. A plate check can be done anonymously,
          without an account.</li>
        <li><strong>Account data</strong> - if you create an account for AI chat
          and saved dossiers: your email and (with Google sign-in) your name,
          via Firebase Authentication.</li>
        <li><strong>Saved dossiers &amp; chat history</strong> - linked to your
          account so you can find them later.</li>
        <li><strong>Credits, passes and usage</strong> - we record which tools
          cost a credit (chat, AI analysis) and which pass you bought, for a
          transparent usage overview.</li>
        <li><strong>Payment data</strong> - payments are handled by Stripe. We do
          <em> not</em> store card details; we keep only an order reference.</li>
        <li><strong>Caches</strong> - RDW and analysis results are stored locally
          and server-side for up to 24 hours (faster, cheaper reuse).</li>
        <li><strong>IP address</strong> - only for abuse rate-limiting, and via
          Firebase App Check / reCAPTCHA Enterprise to block automated abuse.</li>
      </ul>

      <h2>Who we share data with (sub-processors)</h2>
      <ul>
        <li><strong>Google Cloud / Firebase</strong> - hosting, authentication,
          database (Firestore), storage and AI (Vertex AI), within the EU.</li>
        <li><strong>Stripe</strong> - payment processing.</li>
        <li><strong>RDW Open Data</strong> - source of the official vehicle data.</li>
        <li><strong>Autotelex</strong> - indicative market value.</li>
        <li><strong>Google Search</strong> - only when a question needs a live
          web search.</li>
        <li><strong>Google Analytics 4</strong> - aggregated usage statistics,
          only with your consent.</li>
      </ul>

      <h2>Where is your data?</h2>
      <p>
        Processing takes place within the EU (Google Cloud, region
        europe-west4, Firestore multi-region eur3). AI analysis and chat run on
        Google's Gemini models via Vertex AI.
      </p>

      <h2>How long do we keep data?</h2>
      <ul>
        <li>Caches: at most 24 hours.</li>
        <li>IP address for rate-limiting: briefly, in process memory.</li>
        <li>Account, dossiers, chat history and usage overview: as long as your
          account exists. We delete these when your account is removed.</li>
      </ul>

      <h2>AI-assisted analysis - GDPR Article 22</h2>
      <p>
        Our AI analysis is an automated process making substantive statements
        about your car (estimated value, future emission-zone status,
        comparisons). Under Article 22 of the GDPR you have the right:
      </p>
      <ul>
        <li>to know this is an automated process - hence the
          <em> "AI · Indicative"</em> label on every AI block.</li>
        <li>to human review - email us via
          <a href="mailto:contact@autoconsul.nl"> contact@autoconsul.nl</a>.</li>
        <li>to object - we adjust the analysis or delete your search on request.</li>
      </ul>

      <h2>Cookies and local storage</h2>
      <p>
        See <Link to="/cookies">/cookies</Link>. By default only strictly
        necessary local storage (recent searches, language choice, signed-in
        session) plus the Firebase App Check token. Analytics cookies (Google
        Analytics 4) are used only with your consent.
      </p>

      <h2>Your rights</h2>
      <p>
        Access, deletion, correction, objection and data portability - email
        <a href="mailto:contact@autoconsul.nl"> contact@autoconsul.nl</a>. You may
        also lodge a complaint with the Dutch Data Protection Authority
        (Autoriteit Persoonsgegevens).
      </p>
    </>
  );
}
