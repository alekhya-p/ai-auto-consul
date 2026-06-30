import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { DailyLimitModal } from "../components/DailyLimitModal";
import { InfoButton } from "../components/InfoButton";
import { DossierExportPanel } from "../features/dossier/DossierExportPanel";
import { DossierLiteAnalysis } from "../features/dossier/DossierLiteAnalysis";
import { MaandlastenCard } from "../components/MaandlastenCard";
import { MarktaanbodScroll } from "../components/MarktaanbodScroll";
import { NlPlate } from "../components/NlPlate";
import { SectionExplainer } from "../components/SectionExplainer";
import { track } from "../lib/analytics";
import { useAuth } from "../lib/auth";
import { DailyLimitError, getVoertuig, LookupError, saveDossier } from "../lib/api";
import { brandFor } from "../lib/brandTheme";
import type { BrandTheme } from "../lib/brandTheme";
import { addRecent, getCached, prettyPlate, putCached } from "../lib/voertuigCache";
import { useI18n, useT, useTList } from "../lib/i18n";
import type { Lang } from "../lib/i18n";
import { translateRdwValue } from "../lib/rdwTranslate";
import type { RdwField } from "../lib/rdwTranslate";
import type {
  RdwAlgemeen,
  RdwApkInspection,
  RdwCarrosserie,
  RdwMotorMilieu,
  RdwStatus,
  RdwVehicleDetail,
} from "../lib/types";

/**
 * Anonymous dossier page - RDW facts plus a locked AI teaser.
 *
 *   1. Hero card (model + mini-tiles)
 *   2. Locked AI analyse teaser
 *   3. Marktaanbod scroll (NL listings)
 *   4. RDW sections under supporting-data headline
 *
 * Source badges on section titles. RDW enum values via translateRdwValue();
 * defect descriptions stay Dutch (RDW source text).
 */
export function VoertuigPage() {
  const { plate = "" } = useParams<{ plate: string }>();
  const t = useT();
  const { lang } = useI18n();
  const auth = useAuth();
  const [detail, setDetail] = useState<RdwVehicleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyLimit, setDailyLimit] = useState<{ feature: "rdw_lookup" | "ai_analysis"; limit: number } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    (async () => {
      const cached = await getCached(plate).catch(() => null);
      if (cancelled) return;
      if (cached) {
        setDetail(cached);
        setLoading(false);
        addRecent(plate).catch(() => undefined);
        return;
      }
      try {
        const fresh = await getVoertuig(plate, ac.signal);
        if (cancelled) return;
        setDetail(fresh);
        if (fresh.found) {
          putCached(plate, fresh).catch(() => undefined);
        }
        addRecent(plate).catch(() => undefined);
      } catch (err) {
        if (cancelled) return;
        if ((err as DOMException)?.name === "AbortError") return;
        if (err instanceof DailyLimitError) {
          setDailyLimit({ feature: err.feature, limit: err.limit });
          // Daily-limit error means we can't render the dossier; show
          // the modal + a quiet hint behind it.
          setError(t("errors.generic"));
        } else {
          setError(err instanceof LookupError ? err.message : t("errors.generic"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [plate, t]);

  // Server-side "recent dossiers" persistence. Fires once per
  // (plate × signed-in-uid × dossier-loaded) so the dashboard's
  // recent list survives cache clear + works across devices.
  //
  // Split from the fetch effect because auth.user resolves async after
  // first render - keeping it separate means we still record the visit
  // even if the token loads after the dossier did, and we don't re-run
  // the (potentially expensive) RDW fetch when auth flips.
  const uid = auth.user?.uid;
  const found = detail?.found ?? false;
  useEffect(() => {
    if (!uid || !found || !detail) return;
    void saveDossier({
      plate,
      merk: detail.algemeen?.merk ?? null,
      model: detail.algemeen?.model ?? null,
      year: detail.algemeen?.datumEersteToelating?.slice(0, 4) ?? null,
    });
  }, [plate, uid, found, detail]);

  // Brand-theme the page: set `data-brand` on <body> + override the
  // CSS --brand / --brand-ink slots inline. Reset on unmount / brand
  // change so we never bleed Opel-yellow onto the next visitor's BMW.
  const theme = brandFor(detail?.algemeen?.merk);
  useEffect(() => {
    const body = document.body;
    if (theme) {
      body.dataset.brand = theme.slug;
      body.style.setProperty("--brand", theme.accent);
      body.style.setProperty("--brand-ink", theme.ink);
    } else {
      delete body.dataset.brand;
      body.style.removeProperty("--brand");
      body.style.removeProperty("--brand-ink");
    }
    return () => {
      delete body.dataset.brand;
      body.style.removeProperty("--brand");
      body.style.removeProperty("--brand-ink");
    };
  }, [theme]);

  // Engagement: record the lookup outcome once the dossier resolves.
  useEffect(() => {
    if (detail) track("dossier_viewed", { found: detail.found });
  }, [detail]);

  const prettied = prettyPlate(plate.toUpperCase());

  return (
    <section className="voertuig-page">
      {dailyLimit && (
        <DailyLimitModal
          feature={dailyLimit.feature}
          limit={dailyLimit.limit}
          onClose={() => setDailyLimit(null)}
        />
      )}
      <p className="back">
        <Link to={auth.user ? "/dashboard" : "/"}>
          {auth.user ? t("topbar.backDashboard") : t("topbar.back")}
        </Link>
      </p>

      {detail && detail.found && detail.algemeen && (
        <HeroCard
          plate={prettied}
          algemeen={detail.algemeen}
          motor={detail.motorMilieu}
          status={detail.status}
          theme={theme}
        />
      )}

      {(!detail || !detail.found) && (
        <h1 className="plate"><NlPlate value={plate} size="lg" /></h1>
      )}

      {loading && <p className="loading">{t("voertuig.loading")}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {detail && !detail.found && (
        <div className="card not-found">
          {t("voertuig.notFound", { plate: prettied })}
        </div>
      )}

      {detail && detail.found && auth.user && (
        <Link
          to={`/v2/chat?plate=${encodeURIComponent(plate.toUpperCase())}`}
          className="dossier-chat-fab"
          aria-label={t("voertuig.fab.aria", { plate: prettied })}
        >
          <span aria-hidden="true">💬</span>
          {t("voertuig.fab.chat")}
        </Link>
      )}

      {detail && detail.found && (
        <>
          <AiSection plate={plate} detail={detail} lang={lang} />

          <MarktaanbodScroll plate={plate.replace(/[\s-]/g, "").toUpperCase()} />

          <MaandlastenCard plate={plate} />

          <h2 className="rdw-supporting-headline">
            {t("voertuig.section.rdwSupporting")}{" "}
            <span className="badge badge-rdw">{t("voertuig.badge.rdw")}</span>
            <InfoButton textKey="voertuig.help.badgeRdw" />
          </h2>

          {detail.algemeen && <AlgemeenSection a={detail.algemeen} />}
          {detail.status && <StatusSection s={detail.status} />}
          {detail.motorMilieu && <MotorSection m={detail.motorMilieu} />}
          {detail.carrosserie && <CarrosserieSection c={detail.carrosserie} />}
          {detail.apkHistorie && detail.apkHistorie.length > 0 && (
            <ApkSection inspections={detail.apkHistorie} />
          )}

          <p className="trademark-disclaimer">{t("trademark")}</p>
        </>
      )}
    </section>
  );
}

// ─── Hero card ──────────────────────────────────────────────────────

function HeroCard({
  plate,
  algemeen,
  motor,
  status,
  theme,
}: {
  plate: string;
  algemeen: RdwAlgemeen;
  motor: RdwMotorMilieu | null;
  status: RdwStatus | null;
  theme: BrandTheme | null;
}) {
  const t = useT();
  const { lang } = useI18n();
  const title = [algemeen.merk, algemeen.model].filter(Boolean).join(" ");
  const bouwjaar = algemeen.datumEersteToelating ? algemeen.datumEersteToelating.slice(0, 4) : null;
  const vermogen = motor?.vermogenPk != null ? `${motor.vermogenPk} pk` : "-";
  const brandstof = (translateRdwValue(motor?.brandstof, "brandstof", lang) ?? motor?.brandstof) || "-";
  const verbruik = motor?.verbruikGecombineerd != null
    ? `${motor.verbruikGecombineerd.toFixed(1)} l/100km`
    : "-";
  const apk = status?.apkGeldigTot ? localDate(status.apkGeldigTot, lang) : "-";
  return (
    <header className="hero-card">
      <div className="hero-card-top">
        <NlPlate value={plate} size="lg" />
        {theme && (
          <span className="brand-logo" style={{ color: "var(--text)" }}>
            <BrandLogo theme={theme} />
          </span>
        )}
        <div className="hero-card-title">
          <strong>{title || "-"}</strong>
          {bouwjaar && <span className="muted"> · {bouwjaar}</span>}
        </div>
      </div>
      <ul className="hero-tiles">
        <Tile label={t("voertuig.tile.brandstof")} value={brandstof} />
        <Tile label={t("voertuig.tile.vermogen")} value={vermogen} />
        <Tile label={t("voertuig.tile.verbruik")} value={verbruik} />
        <Tile label={t("voertuig.tile.apkTot")} value={apk ?? "-"} ok={status?.apkGeldig ?? null} />
      </ul>
    </header>
  );
}

function Tile({ label, value, ok }: { label: string; value: string; ok?: boolean | null }) {
  const cls = ok == null ? "" : ok ? " ok" : " warn";
  return (
    <li className={`tile${cls}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
    </li>
  );
}

// ─── AI section gate ────────────────────────────────────────────────

/**
 * Picks between the AI analysis card and the locked sign-in teaser.
 *
 * Rules:
 *   - Firebase not configured (typical for dev:mock without env vars):
 *     show the analysis card. The mock plugin serves a stub fixture so
 *     the UI is reviewable without a real auth flow.
 *   - Signed-out visitor: show the locked teaser with a "sign in for AI"
 *     CTA that routes to /sign-in.
 *   - Signed-in user: show the analysis card.
 */
function AiSection({
  plate,
  detail,
  lang,
}: {
  plate: string;
  detail: RdwVehicleDetail;
  lang: Lang;
}) {
  const auth = useAuth();
  // The AI plane (analysis + chat) lives in agent-v2, reached via /v2/chat.
  // The dossier page invites the user into that single canonical chat surface
  // with the plate pre-pinned; the chat produces the analysis on demand.
  if (!auth.enabled) {
    return (
      <>
        <CompareInvite plate={plate} />
        <DossierChatInvite plate={plate} />
      </>
    );
  }
  if (!auth.ready) {
    return (
      <div className="dossier-ai-loading" aria-busy="true">
        <div className="route-loading-bar route-loading-bar--wide" />
        <div className="route-loading-bar route-loading-bar--medium" />
      </div>
    );
  }
  if (auth.user) {
    return (
      <>
        <DossierLiteAnalysis plate={plate} />
        <DossierExportPanel plate={plate} detail={detail} lang={lang} />
        <CompareInvite plate={plate} />
        <DossierChatInvite plate={plate} />
      </>
    );
  }
  return (
    <>
      <GuestCompareInvite plate={plate} />
      <AiLockedTeaser plate={plate} />
    </>
  );
}

/** Card linking into the canonical /v2/chat surface with the plate pinned. */
function DossierChatInvite({ plate }: { plate: string }) {
  const t = useT();
  const pretty = prettyPlate(plate.toUpperCase());
  const href = `/v2/chat?plate=${encodeURIComponent(plate.toUpperCase())}`;
  return (
    <section className="card dossier-chat-invite">
      <h2>{t("voertuig.chat.title", { plate: pretty })}</h2>
      <p>{t("voertuig.chat.subtitle")}</p>
      <a className="primary" href={href}>
        {t("voertuig.chat.openFull")}
      </a>
    </section>
  );
}

/** Guest compare: RDW-only preview after sign-up; deep link preserves plates. */
function GuestCompareInvite({ plate }: { plate: string }) {
  const t = useT();
  const [other, setOther] = useState("");
  const trimmed = other.replace(/[\s-]/g, "").toUpperCase();
  const valid = trimmed.length >= 4 && trimmed.length <= 8 && trimmed !== plate.toUpperCase();
  const compareNext = valid
    ? `/compare?plates=${plate.toUpperCase()},${trimmed}`
    : `/voertuig/${plate}`;
  const signUpHref = `/sign-up?next=${encodeURIComponent(compareNext)}`;

  return (
    <section className="card dossier-compare dossier-compare-guest">
      <h2>{t("voertuig.compare.guestTitle")}</h2>
      <p>{t("voertuig.compare.guestBody")}</p>
      <form
        className="dossier-compare-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) window.location.assign(signUpHref);
        }}
      >
        <label>
          <span>{t("voertuig.compare.label")}</span>
          <input
            type="text"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder={t("voertuig.compare.placeholder")}
            autoCapitalize="characters"
            maxLength={10}
            spellCheck={false}
          />
        </label>
        <button type="submit" className="primary" disabled={!valid}>
          {t("voertuig.compare.guestCta")}
        </button>
      </form>
    </section>
  );
}

function CompareInvite({ plate }: { plate: string }) {
  const t = useT();
  const [other, setOther] = useState("");
  const trimmed = other.replace(/[\s-]/g, "").toUpperCase();
  const valid = trimmed.length >= 4 && trimmed.length <= 8 && trimmed !== plate.toUpperCase();
  const compareHref = valid
    ? `/compare?plates=${plate.toUpperCase()},${trimmed}`
    : "#";
  return (
    <section className="card dossier-compare">
      <h2>{t("voertuig.compare.title")}</h2>
      <p>{t("voertuig.compare.body")}</p>
      <form
        className="dossier-compare-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) window.location.assign(compareHref);
        }}
      >
        <label>
          <span>{t("voertuig.compare.label")}</span>
          <input
            type="text"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder={t("voertuig.compare.placeholder")}
            autoCapitalize="characters"
            maxLength={10}
            spellCheck={false}
          />
        </label>
        <button type="submit" className="primary" disabled={!valid}>
          {t("voertuig.compare.go")}
        </button>
      </form>
    </section>
  );
}

// ─── Locked AI teaser ───────────────────────────────────────────────

function AiLockedTeaser({ plate }: { plate: string }) {
  const t = useT();
  const tList = useTList();
  const next = encodeURIComponent(`/voertuig/${plate}`);

  return (
    <section className="card ai-teaser">
      <header>
        <h2>
          🤖 {t("voertuig.ai.lockedTitle")}{" "}
          <span className="badge badge-ai">{t("voertuig.badge.ai")}</span>
          <InfoButton textKey="voertuig.help.badgeAi" />
        </h2>
      </header>
      <p className="ai-teaser-sub">{t("voertuig.ai.lockedSubtitle")}</p>
      <ul className="ai-teaser-bullets">
        {tList("voertuig.ai.lockedBullets").map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <p className="ai-teaser-cta">
        <Link to={`/sign-up?next=${next}`} className="primary">
          {t("voertuig.ai.lockedCta")}
        </Link>
        {" "}
        <Link to={`/sign-in?next=${next}`} className="ghost">
          {t("voertuig.ai.haveAccount")}
        </Link>
      </p>
    </section>
  );
}

// ─── RDW sections ───────────────────────────────────────────────────

/** Pull-back of the verbose lang+t boilerplate every section needs. */
function useSectionHelpers() {
  const t = useT();
  const { lang } = useI18n();
  const L = (k: string) => t(`voertuig.labels.${k}`);
  const V = (v: string | null | undefined, field: RdwField) =>
    translateRdwValue(v, field, lang) ?? v ?? null;
  return { t, lang, L, V };
}

function AlgemeenSection({ a }: { a: RdwAlgemeen }) {
  const { t, lang, L, V } = useSectionHelpers();
  const kleur1 = V(a.eersteKleur, "kleur");
  const kleur2 = V(a.tweedeKleur, "kleur");
  return (
    <section className="card">
      <h2>{t("voertuig.section.algemeen")}</h2>
      <SectionExplainer textKey="voertuig.explainer.algemeen" />
      <dl className="grid">
        <Row label={L("merk")}>{a.merk}</Row>
        <Row label={L("model")}>{a.model}</Row>
        <Row label={L("voertuigsoort")}>{V(a.voertuigsoort, "voertuigsoort")}</Row>
        <Row label={L("inrichting")}>{V(a.inrichting, "inrichting")}</Row>
        <Row label={L("kleur")}>{joined(kleur1, kleur2)}</Row>
        <Row label={L("aantalDeuren")}>{a.aantalDeuren}</Row>
        <Row label={L("aantalZitplaatsen")}>{a.aantalZitplaatsen}</Row>
        <Row label={L("nieuwprijs")} info="nieuwprijs">{euros(a.nieuwprijsEuro, lang)}</Row>
        <Row label={L("brutoBpm")} info="brutoBpm">{euros(a.brutoBpmEuro, lang)}</Row>
        <Row label={L("datumEersteToelating")}>{localDate(a.datumEersteToelating, lang)}</Row>
        <Row label={L("datumEersteNlRegistratie")}>{localDate(a.datumEersteNlRegistratie, lang)}</Row>
        <Row label={L("datumTenaamstelling")}>{localDate(a.datumTenaamstelling, lang)}</Row>
        <Row label={L("importauto")}>{yesNo(a.importauto, t)}</Row>
        <Row label={L("europeseVoertuigcategorie")} info="europeseVoertuigcategorie">{a.europeseVoertuigcategorie}</Row>
        <Row label={L("typegoedkeuringsnummer")} info="typegoedkeuringsnummer">{a.typegoedkeuringsnummer}</Row>
        <Row label={L("variantUitvoering")}>{joined(a.variant, a.uitvoering, " · ")}</Row>
      </dl>
    </section>
  );
}

function StatusSection({ s }: { s: RdwStatus }) {
  const { t, lang, L, V } = useSectionHelpers();
  return (
    <section className="card">
      <h2>{t("voertuig.section.status")}</h2>
      <SectionExplainer textKey="voertuig.explainer.status" />
      <dl className="grid">
        <Row label={L("apkGeldigTot")} info="apkGeldigTot">
          <span className={s.apkGeldig ? "ok" : "warn"}>
            {localDate(s.apkGeldigTot, lang) ?? "-"}
            {s.apkGeldig ? " ✓" : s.apkGeldigTot ? ` (${t("voertuig.value.expired")})` : ""}
          </span>
        </Row>
        <Row label={L("wamVerzekerd")} info="wamVerzekerd">{yesNo(s.wamVerzekerd, t)}</Row>
        <Row label={L("openstaandeTerugroepactie")} info="openstaandeTerugroepactie">
          <span className={s.openstaandeTerugroepactie ? "warn" : "ok"}>
            {s.openstaandeTerugroepactie
              ? t("voertuig.value.recallOpen")
              : t("voertuig.value.recallClean")}
          </span>
        </Row>
        <Row label={L("wokStatus")} info="wokStatus">
          <span className={s.wokStatus ? "warn" : "ok"}>
            {s.wokStatus
              ? s.wokToelichting ?? t("voertuig.value.wokAwaiting")
              : t("voertuig.value.wokNone")}
          </span>
        </Row>
        <Row label={L("taxi")}>{yesNo(s.taxi, t)}</Row>
        <Row label={L("exported")}>{yesNo(s.exported, t)}</Row>
        <Row label={L("tenaamstellenMogelijk")}>{yesNo(s.tenaamstellenMogelijk, t)}</Row>
        <Row label={L("tellerstandoordeel")} info="tellerstandoordeel">{V(s.tellerstandoordeel, "tellerstandoordeel")}</Row>
        <Row label={L("laatsteTellerJaar")}>{s.laatsteRegistratieTellerstandJaar}</Row>
      </dl>
    </section>
  );
}

function MotorSection({ m }: { m: RdwMotorMilieu }) {
  const { t, L, V } = useSectionHelpers();
  return (
    <section className="card">
      <h2>{t("voertuig.section.motorMilieu")}</h2>
      <SectionExplainer textKey="voertuig.explainer.motorMilieu" />
      <dl className="grid">
        <Row label={L("brandstof")}>{V(m.brandstof, "brandstof")}</Row>
        <Row label={L("vermogen")}>
          {m.vermogenKw != null
            ? `${m.vermogenKw.toFixed(0)} kW${m.vermogenPk != null ? ` / ${m.vermogenPk} PK` : ""}`
            : "-"}
        </Row>
        <Row label={L("aantalCilinders")}>{m.aantalCilinders}</Row>
        <Row label={L("cilinderinhoud")}>{m.cilinderinhoudCc != null ? `${m.cilinderinhoudCc} cc` : "-"}</Row>
        <Row label={L("verbruikStad")}>{lPer100(m.verbruikStad)}</Row>
        <Row label={L("verbruikSnelweg")}>{lPer100(m.verbruikSnelweg)}</Row>
        <Row label={L("verbruikGecombineerd")}>{lPer100(m.verbruikGecombineerd)}</Row>
        <Row label={L("co2Uitstoot")} info="co2Uitstoot">{m.co2GecombineerdGperKm != null ? `${m.co2GecombineerdGperKm} g/km` : "-"}</Row>
        <Row label={L("zuinigheidslabel")} info="zuinigheidslabel">{m.zuinigheidslabel}</Row>
        <Row label={L("uitlaatemissieniveau")} info="uitlaatemissieniveau">{m.uitlaatemissieniveau}</Row>
        <Row label={L("emissiecode")} info="emissiecode">{m.emissiecode}</Row>
        <Row label={L("hybrideKlasse")} info="hybrideKlasse">{V(m.hybrideKlasse, "hybride")}</Row>
        <Row label={L("geluidRijdend")}>{m.geluidsniveauRijdend != null ? `${m.geluidsniveauRijdend} dB` : "-"}</Row>
        <Row label={L("geluidStationair")}>{m.geluidsniveauStationair != null ? `${m.geluidsniveauStationair} dB` : "-"}</Row>
      </dl>
    </section>
  );
}

function CarrosserieSection({ c }: { c: RdwCarrosserie }) {
  const { t, L } = useSectionHelpers();
  return (
    <section className="card">
      <h2>{t("voertuig.section.carrosserie")}</h2>
      <SectionExplainer textKey="voertuig.explainer.carrosserie" />
      <dl className="grid">
        <Row label={L("lengte")}>{cmToM(c.lengteCm)}</Row>
        <Row label={L("breedte")}>{cmToM(c.breedteCm)}</Row>
        <Row label={L("hoogte")}>{cmToM(c.hoogteCm)}</Row>
        <Row label={L("wielbasis")}>{cmToM(c.wielbasisCm)}</Row>
        <Row label={L("aantalWielen")}>{c.aantalWielen}</Row>
        <Row label={L("massaLedig")} info="massaLedig">{kg(c.massaLedigKg)}</Row>
        <Row label={L("massaRijklaar")} info="massaRijklaar">{kg(c.massaRijklaarKg)}</Row>
        <Row label={L("maxMassa")} info="maxMassa">{kg(c.toegestaneMaximumMassaKg)}</Row>
        <Row label={L("maxTrekkenOngeremd")} info="maxTrekkenOngeremd">{kg(c.maxTrekkenOngeremdKg)}</Row>
        <Row label={L("maxTrekkenGeremd")} info="maxTrekkenGeremd">{kg(c.maxTrekkenGeremdKg)}</Row>
        <Row label={L("vermogenMassa")} info="vermogenMassa">{c.vermogenMassarijklaar}</Row>
      </dl>
    </section>
  );
}

function ApkSection({ inspections }: { inspections: RdwApkInspection[] }) {
  const { t, lang, V } = useSectionHelpers();
  return (
    <section className="card">
      <h2>{t("voertuig.section.apkHistorie")}</h2>
      <SectionExplainer textKey="voertuig.explainer.apkHistorie" />
      <ol className="apk-list">
        {inspections.map((i, idx) => {
          const n = i.aandachtspunten.length;
          const issuesLabel = n === 0
            ? t("voertuig.value.noIssues")
            : t(n === 1 ? "voertuig.value.issuesOne" : "voertuig.value.issuesMany", { n });
          const soortLabel = V(i.soort, "apkSoort") ?? i.soort ?? "APK";
          return (
            <li key={`${i.datum ?? "?"}-${idx}`}>
              <header>
                <strong>{localDate(i.datum, lang) ?? t("voertuig.value.unknownDate")}</strong>
                {i.tijd && <span className="time"> · {i.tijd}</span>}
                <span className="kind"> · {soortLabel}</span>
                <span className={`badge ${n === 0 ? "ok" : "warn"}`}>{issuesLabel}</span>
              </header>
              {n > 0 && (
                <ul>
                  {i.aandachtspunten.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─── formatting helpers ─────────────────────────────────────────────

function Row({
  label,
  info,
  children,
}: {
  label: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt>
        {label}
        {info && <InfoButton textKey={`voertuig.help.${info}`} />}
      </dt>
      <dd>{children == null || children === "" ? "-" : children}</dd>
    </>
  );
}

function joined(a: string | null | undefined, b: string | null | undefined, sep = " / ") {
  return [a, b].filter(Boolean).join(sep) || null;
}

function yesNo(v: boolean | null | undefined, t: (key: string) => string): string {
  if (v == null) return "-";
  return v ? t("voertuig.value.yes") : t("voertuig.value.no");
}

function euros(v: number | null | undefined, lang: Lang): string {
  if (v == null) return "-";
  const locale = lang === "en" ? "en-IE" : "nl-NL"; // en-IE keeps "€ 1,234"
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

/** Date in the user's language - dd-mm-yyyy for NL, dd Mon yyyy for EN. */
function localDate(iso: string | null | undefined, lang: Lang): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  if (lang === "en") {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      }).format(new Date(`${y}-${m}-${d}T00:00:00Z`));
    } catch {
      return `${d}-${m}-${y}`;
    }
  }
  return `${d}-${m}-${y}`;
}

function lPer100(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v.toFixed(1)} l/100km`;
}

function cmToM(cm: number | null | undefined): string {
  if (cm == null) return "-";
  return `${(cm / 100).toFixed(2)} m`;
}

function kg(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v.toLocaleString("nl-NL")} kg`;
}
