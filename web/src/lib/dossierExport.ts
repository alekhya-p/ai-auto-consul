import type { AiAnalysisV2 } from "./api";
import type { Lang } from "./i18n";
import { translateRdwValue } from "./rdwTranslate";
import type { RdwField } from "./rdwTranslate";
import type { RdwVehicleDetail } from "./types";
import { prettyPlate } from "./voertuigCache";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// ─── value formatting (mirrors VoertuigPage so the PDF matches the page) ───
function joined(a: string | null | undefined, b: string | null | undefined, sep = " / ") {
  return [a, b].filter(Boolean).join(sep) || null;
}
function yesNo(v: boolean | null | undefined, t: TFn): string | null {
  if (v == null) return null;
  return v ? t("voertuig.value.yes") : t("voertuig.value.no");
}
function euros(v: number | null | undefined, lang: Lang): string | null {
  if (v == null) return null;
  const locale = lang === "en" ? "en-IE" : "nl-NL";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}
function localDate(iso: string | null | undefined, lang: Lang): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  if (lang === "en") {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${y}-${m}-${d}T00:00:00Z`));
    } catch {
      return `${d}-${m}-${y}`;
    }
  }
  return `${d}-${m}-${y}`;
}
function lPer100(v: number | null | undefined): string | null {
  return v == null ? null : `${v.toFixed(1)} l/100km`;
}
function cmToM(cm: number | null | undefined): string | null {
  return cm == null ? null : `${(cm / 100).toFixed(2)} m`;
}
function kg(v: number | null | undefined): string | null {
  return v == null ? null : `${v.toLocaleString("nl-NL")} kg`;
}

export interface DossierExportLabels {
  title: string;
  generated: string;
  plate: string;
  sectionRdw: string;
  sectionAiLite: string;
  sectionAiDeep: string;
  sectionGlossary: string;
  badgeRdw: string;
  badgeAi: string;
  badgeLite: string;
  badgeDeep: string;
  disclaimer: string;
  glossary: string[];
  rows: Record<string, string>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string | null | undefined): string {
  if (value == null || value === "") return "";
  return `<tr><th>${esc(label)}</th><td>${esc(String(value))}</td></tr>`;
}

/** Like row(), but the value is trusted HTML (e.g. a status chip). */
function rowRaw(label: string, valueHtml: string | null | undefined): string {
  if (valueHtml == null || valueHtml === "") return "";
  return `<tr><th>${esc(label)}</th><td>${valueHtml}</td></tr>`;
}

/** A coloured status pill - "ok" (green), "warn" (red), or "neutral". */
function chip(text: string, tone: "ok" | "warn" | "neutral"): string {
  return `<span class="chip chip-${tone}">${esc(text)}</span>`;
}

function section(title: string, badge: string, body: string, variant = ""): string {
  return `
    <section class="block${variant ? ` block--${variant}` : ""}">
      <header class="block-head">
        <h2>${esc(title)}</h2>
        <span class="badge">${esc(badge)}</span>
      </header>
      ${body}
    </section>`;
}

function listSection(title: string, items: string[] | undefined): string {
  if (!items?.length) return "";
  return `<h3>${esc(title)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function analysisBlock(a: AiAnalysisV2, labels: DossierExportLabels, tier: "lite" | "deep"): string {
  const badge = tier === "deep" ? labels.badgeDeep : labels.badgeLite;
  const parts: string[] = [];
  if (a.summary) parts.push(`<p class="lead">${esc(a.summary)}</p>`);
  if (a.marketValue?.estimateRangeEur) {
    parts.push(
      `<p><strong>${esc(labels.rows.marketRange)}:</strong> ${esc(a.marketValue.estimateRangeEur)}</p>`,
    );
  }
  if (a.redFlags?.length) {
    parts.push(listSection(labels.rows.redFlags, a.redFlags));
  }
  if (a.pros?.length) parts.push(listSection(labels.rows.pros, a.pros));
  if (a.cons?.length) parts.push(listSection(labels.rows.cons, a.cons));
  if (a.thingsToCheckBeforeBuying?.length) {
    parts.push(listSection(labels.rows.checkBefore, a.thingsToCheckBeforeBuying));
  }
  if (a.reliabilityNotes) {
    parts.push(`<p><strong>${esc(labels.rows.reliability)}:</strong> ${esc(a.reliabilityNotes)}</p>`);
  }
  if (a.recallSummary) {
    parts.push(`<p><strong>${esc(labels.rows.recalls)}:</strong> ${esc(a.recallSummary)}</p>`);
  }
  if (a.dutchTaxNotes) {
    parts.push(`<p><strong>${esc(labels.rows.tax)}:</strong> ${esc(a.dutchTaxNotes)}</p>`);
  }
  if (a.emissionZonesAndBans) {
    parts.push(`<p><strong>${esc(labels.rows.zones)}:</strong> ${esc(a.emissionZonesAndBans)}</p>`);
  }
  if (a.negotiationLeverage?.length) {
    parts.push(listSection(labels.rows.negotiation, a.negotiationLeverage));
  }
  return section(
    tier === "deep" ? labels.sectionAiDeep : labels.sectionAiLite,
    badge,
    parts.join("") || `<p>-</p>`,
    "ai",
  );
}

export function buildDossierExportHtml(
  plate: string,
  detail: RdwVehicleDetail,
  labels: DossierExportLabels,
  t: TFn,
  lang: Lang,
  lite?: AiAnalysisV2 | null,
  deep?: AiAnalysisV2 | null,
): string {
  const pretty = prettyPlate(plate.toUpperCase());
  const a = detail.algemeen;
  const m = detail.motorMilieu;
  const s = detail.status;
  const c = detail.carrosserie;
  const now = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  // Field label + RDW enum-value translation, mirroring the on-page sections.
  const L = (k: string) => t(`voertuig.labels.${k}`);
  const V = (v: string | null | undefined, field: RdwField) =>
    translateRdwValue(v, field, lang) ?? v ?? null;
  const num = (v: number | null | undefined) => (v == null ? null : String(v));
  const table = (rows: string) => (rows ? `<table>${rows}</table>` : "");

  const algemeen = a
    ? table(
        [
          row(L("merk"), a.merk),
          row(L("model"), a.model),
          row(L("voertuigsoort"), V(a.voertuigsoort, "voertuigsoort")),
          row(L("inrichting"), V(a.inrichting, "inrichting")),
          row(L("kleur"), joined(V(a.eersteKleur, "kleur"), V(a.tweedeKleur, "kleur"))),
          row(L("aantalDeuren"), num(a.aantalDeuren)),
          row(L("aantalZitplaatsen"), num(a.aantalZitplaatsen)),
          row(L("nieuwprijs"), euros(a.nieuwprijsEuro, lang)),
          row(L("brutoBpm"), euros(a.brutoBpmEuro, lang)),
          row(L("datumEersteToelating"), localDate(a.datumEersteToelating, lang)),
          row(L("datumEersteNlRegistratie"), localDate(a.datumEersteNlRegistratie, lang)),
          row(L("datumTenaamstelling"), localDate(a.datumTenaamstelling, lang)),
          row(L("importauto"), yesNo(a.importauto, t)),
          row(L("europeseVoertuigcategorie"), a.europeseVoertuigcategorie),
          row(L("typegoedkeuringsnummer"), a.typegoedkeuringsnummer),
          row(L("variantUitvoering"), joined(a.variant, a.uitvoering, " · ")),
        ].join(""),
      )
    : "";

  const status = s
    ? table(
        [
          rowRaw(
            L("apkGeldigTot"),
            s.apkGeldigTot
              ? chip(
                  `${localDate(s.apkGeldigTot, lang)}${s.apkGeldig ? "" : ` (${t("voertuig.value.expired")})`}`,
                  s.apkGeldig ? "ok" : "warn",
                )
              : null,
          ),
          row(L("wamVerzekerd"), yesNo(s.wamVerzekerd, t)),
          rowRaw(
            L("openstaandeTerugroepactie"),
            s.openstaandeTerugroepactie != null
              ? chip(
                  s.openstaandeTerugroepactie
                    ? t("voertuig.value.recallOpen")
                    : t("voertuig.value.recallClean"),
                  s.openstaandeTerugroepactie ? "warn" : "ok",
                )
              : null,
          ),
          rowRaw(
            L("wokStatus"),
            s.wokStatus != null
              ? chip(
                  s.wokStatus
                    ? s.wokToelichting ?? t("voertuig.value.wokAwaiting")
                    : t("voertuig.value.wokNone"),
                  s.wokStatus ? "warn" : "ok",
                )
              : null,
          ),
          row(L("taxi"), yesNo(s.taxi, t)),
          row(L("exported"), yesNo(s.exported, t)),
          row(L("tenaamstellenMogelijk"), yesNo(s.tenaamstellenMogelijk, t)),
          row(L("tellerstandoordeel"), V(s.tellerstandoordeel, "tellerstandoordeel")),
          row(L("laatsteTellerJaar"), num(s.laatsteRegistratieTellerstandJaar)),
        ].join(""),
      )
    : "";

  const motor = m
    ? table(
        [
          row(L("brandstof"), V(m.brandstof, "brandstof")),
          row(
            L("vermogen"),
            m.vermogenKw != null
              ? `${m.vermogenKw.toFixed(0)} kW${m.vermogenPk != null ? ` / ${m.vermogenPk} PK` : ""}`
              : null,
          ),
          row(L("aantalCilinders"), num(m.aantalCilinders)),
          row(L("cilinderinhoud"), m.cilinderinhoudCc != null ? `${m.cilinderinhoudCc} cc` : null),
          row(L("verbruikStad"), lPer100(m.verbruikStad)),
          row(L("verbruikSnelweg"), lPer100(m.verbruikSnelweg)),
          row(L("verbruikGecombineerd"), lPer100(m.verbruikGecombineerd)),
          row(L("co2Uitstoot"), m.co2GecombineerdGperKm != null ? `${m.co2GecombineerdGperKm} g/km` : null),
          row(L("zuinigheidslabel"), m.zuinigheidslabel),
          row(L("uitlaatemissieniveau"), m.uitlaatemissieniveau),
          row(L("emissiecode"), m.emissiecode),
          row(L("hybrideKlasse"), V(m.hybrideKlasse, "hybride")),
          row(L("geluidRijdend"), m.geluidsniveauRijdend != null ? `${m.geluidsniveauRijdend} dB` : null),
          row(L("geluidStationair"), m.geluidsniveauStationair != null ? `${m.geluidsniveauStationair} dB` : null),
        ].join(""),
      )
    : "";

  const carrosserie = c
    ? table(
        [
          row(L("lengte"), cmToM(c.lengteCm)),
          row(L("breedte"), cmToM(c.breedteCm)),
          row(L("hoogte"), cmToM(c.hoogteCm)),
          row(L("wielbasis"), cmToM(c.wielbasisCm)),
          row(L("aantalWielen"), num(c.aantalWielen)),
          row(L("massaLedig"), kg(c.massaLedigKg)),
          row(L("massaRijklaar"), kg(c.massaRijklaarKg)),
          row(L("maxMassa"), kg(c.toegestaneMaximumMassaKg)),
          row(L("maxTrekkenOngeremd"), kg(c.maxTrekkenOngeremdKg)),
          row(L("maxTrekkenGeremd"), kg(c.maxTrekkenGeremdKg)),
          row(L("vermogenMassa"), num(c.vermogenMassarijklaar)),
        ].join(""),
      )
    : "";

  // APK history: date · type, plus any attention points, matching the page.
  const apk =
    detail.apkHistorie?.slice(0, 8).map((insp) => {
      const when = localDate(insp.datum, lang) ?? t("voertuig.value.unknownDate");
      const soort = V(insp.soort, "apkSoort") ?? insp.soort ?? "APK";
      const points = insp.aandachtspunten ?? [];
      const head = `<h3>${esc(when)} - ${esc(soort)}</h3>`;
      const body = points.length
        ? `<ul>${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
        : `<p>${esc(t("voertuig.value.noIssues"))}</p>`;
      return head + body;
    }).join("") ?? "";

  const rdwSections =
    section(t("voertuig.section.algemeen"), labels.badgeRdw, algemeen) +
    (status ? section(t("voertuig.section.status"), labels.badgeRdw, status) : "") +
    (motor ? section(t("voertuig.section.motorMilieu"), labels.badgeRdw, motor) : "") +
    (carrosserie ? section(t("voertuig.section.carrosserie"), labels.badgeRdw, carrosserie) : "") +
    (apk ? section(t("voertuig.section.apkHistorie"), labels.badgeRdw, apk) : "");

  // One analysis only - a deep analysis (paid) takes precedence over lite.
  const aiParts = deep?.summary
    ? analysisBlock(deep, labels, "deep")
    : lite?.summary
      ? analysisBlock(lite, labels, "lite")
      : "";

  const glossaryItems = labels.glossary
    .map((g) => {
      const [term, def] = g.split("|");
      return `<dt>${esc(term?.trim() ?? "")}</dt><dd>${esc(def?.trim() ?? "")}</dd>`;
    })
    .join("");
  const glossary = `
    <section class="block block--glossary">
      <header class="block-head"><h2>${esc(labels.sectionGlossary)}</h2></header>
      <dl class="glossary">${glossaryItems}</dl>
    </section>`;

  // Cover identity: the car's make + model headline with the plate as the
  // signature element. Falls back to the document title if RDW lacks a name.
  const carName = [a?.merk, a?.model].filter(Boolean).join(" ");
  const carYear = a?.datumEersteToelating?.slice(0, 4) ?? null;
  const headline = carName || labels.title;
  const isEn = labels.title.includes("Auto Consul");
  const nlPlate = `<span class="nlplate"><span class="nlplate-band">NL</span><span class="nlplate-reg">${esc(pretty)}</span></span>`;

  return `<!DOCTYPE html>
<html lang="${isEn ? "en" : "nl"}">
<head>
  <meta charset="utf-8"/>
  <title>${esc(labels.title)} - ${esc(pretty)}</title>
  <style>
    :root {
      --navy: #1E3A8A; --navy-deep: #172554; --teal: #0EA5A4;
      --ink: #0F172A; --muted: #64748B; --line: #E2E8F0; --tint: #F6F8FB;
      --ok: #047857; --ok-bg: #ECFDF5; --warn: #B91C1C; --warn-bg: #FEF2F2;
      --serif: Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
      --sans: "Helvetica Neue", Arial, system-ui, sans-serif;
      --mono: "SFMono-Regular", "Consolas", "Liberation Mono", Menlo, monospace;
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--serif); font-size: 10.5pt; color: var(--ink);
      margin: 0; padding: 1.2cm 1.3cm; line-height: 1.5;
      counter-reset: section;
    }

    /* ── Cover ───────────────────────────────────────────────── */
    .cover { margin: 0 0 1.4rem; }
    .cover-top {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 0.6rem; border-bottom: 2px solid var(--navy);
    }
    .brand { display: flex; align-items: center; gap: 0.5rem; }
    .brand-mark {
      width: 26px; height: 26px; border-radius: 6px; background: var(--navy);
      color: #fff; font-family: var(--mono); font-weight: 700; font-size: 10pt;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .brand-name {
      font-family: var(--sans); font-weight: 700; font-size: 11.5pt;
      letter-spacing: -0.01em; color: var(--navy-deep);
    }
    .cover-doc {
      margin: 0; font-family: var(--sans); font-size: 7.5pt; font-weight: 600;
      letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted);
    }
    .cover-main {
      display: flex; align-items: center; gap: 1.1rem;
      margin-top: 1.1rem;
    }
    .cover-head { flex: 1; }
    .cover-kicker {
      margin: 0 0 0.15rem; font-family: var(--sans); font-size: 7.5pt;
      font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--teal);
    }
    h1 { margin: 0; font-size: 23pt; line-height: 1.08; color: var(--navy-deep); font-weight: 700; }
    .cover-sub { margin: 0.2rem 0 0; font-family: var(--sans); font-size: 9.5pt; color: var(--muted); }
    .cover-meta {
      margin: 0.9rem 0 0; font-family: var(--sans); font-size: 8pt; color: var(--muted);
    }

    /* ── NL licence plate ────────────────────────────────────── */
    .nlplate {
      display: inline-flex; align-items: stretch; height: 38px;
      border: 1.5px solid var(--ink); border-radius: 6px; overflow: hidden;
      background: #FFCB05; box-shadow: 0 1px 0 rgba(0,0,0,0.08);
    }
    .nlplate-band {
      display: inline-flex; align-items: flex-end; justify-content: center;
      width: 22px; background: #003399; color: #FFCB05;
      font-family: var(--sans); font-weight: 700; font-size: 7pt;
      padding-bottom: 3px; letter-spacing: 0.04em;
    }
    .nlplate-reg {
      display: inline-flex; align-items: center; padding: 0 0.7rem;
      font-family: var(--mono); font-weight: 700; font-size: 15pt;
      letter-spacing: 0.12em; color: #15233b;
    }

    /* ── Sections ────────────────────────────────────────────── */
    .block { break-inside: avoid; margin: 0 0 1.15rem; }
    .block-head {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 0.75rem; margin: 0 0 0.5rem;
      border-bottom: 1px solid var(--line); padding-bottom: 0.3rem;
    }
    .block-head h2 {
      margin: 0; font-size: 12.5pt; color: var(--navy-deep); font-weight: 700;
      counter-increment: section;
    }
    .block-head h2::before {
      content: counter(section, decimal-leading-zero);
      font-family: var(--mono); font-size: 8.5pt; color: var(--teal);
      font-weight: 700; margin-right: 0.55rem; vertical-align: 0.12em;
    }
    .block--glossary .block-head h2::before { content: none; }
    .badge {
      font-family: var(--sans); font-size: 7pt; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase;
      background: #E8EDFB; color: var(--navy); padding: 3px 9px; border-radius: 999px;
      white-space: nowrap;
    }
    h3 {
      font-family: var(--sans); font-size: 9pt; font-weight: 700; color: var(--navy-deep);
      margin: 0.7rem 0 0.3rem; letter-spacing: 0.01em;
    }

    /* ── Data tables ─────────────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; }
    tr { break-inside: avoid; }
    tr:nth-child(even) td, tr:nth-child(even) th { background: var(--tint); }
    th, td { text-align: left; padding: 0.32rem 0.6rem; vertical-align: top; }
    th {
      width: 42%; font-family: var(--sans); font-weight: 500; font-size: 8.5pt;
      color: var(--muted);
    }
    td { font-family: var(--sans); font-size: 9pt; color: var(--ink); }

    /* ── Status chips ────────────────────────────────────────── */
    .chip {
      display: inline-block; font-family: var(--sans); font-size: 8pt; font-weight: 600;
      padding: 2px 9px; border-radius: 999px; line-height: 1.4;
    }
    .chip-ok { background: var(--ok-bg); color: var(--ok); }
    .chip-warn { background: var(--warn-bg); color: var(--warn); }
    .chip-neutral { background: #EEF2F7; color: var(--navy-deep); }

    /* ── AI analysis block ───────────────────────────────────── */
    .block--ai {
      background: #F2FBFA; border: 1px solid #CFEDEB; border-left: 3px solid var(--teal);
      border-radius: 8px; padding: 0.85rem 1rem 0.95rem;
    }
    .block--ai .block-head { border-bottom-color: #CFEDEB; }
    .block--ai .badge { background: #D6F3F0; color: #0B6e6c; }
    .block--ai .lead {
      font-style: italic; font-size: 11pt; color: #134e4a; margin: 0.5rem 0 0.7rem;
    }
    .block--ai p { margin: 0.4rem 0; font-size: 9.5pt; }
    .block--ai strong { font-family: var(--sans); color: var(--navy-deep); }
    .block--ai ul { font-family: var(--sans); font-size: 9pt; }
    ul { margin: 0.2rem 0 0.5rem; padding-left: 1.15rem; }
    li { margin: 0.12rem 0; }

    /* ── Glossary ────────────────────────────────────────────── */
    .glossary { margin: 0; }
    .glossary dt {
      font-family: var(--sans); font-weight: 700; font-size: 8.5pt;
      color: var(--navy-deep); margin-top: 0.5rem;
    }
    .glossary dd { margin: 0.1rem 0 0; font-size: 9pt; color: #475569; }

    /* ── Footer ──────────────────────────────────────────────── */
    .report-foot {
      margin-top: 1.4rem; padding-top: 0.7rem; border-top: 1px solid var(--line);
      font-family: var(--sans); font-size: 7.5pt; color: var(--muted); line-height: 1.5;
    }
    .report-foot strong { color: var(--navy-deep); }

    /* Screen preview uses body padding; print hands margins to @page so every
       page (not just the first) gets consistent edges. */
    @page { margin: 1.15cm 1.25cm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <header class="cover">
    <div class="cover-top">
      <span class="brand"><span class="brand-mark">AC</span><span class="brand-name">Auto Consul</span></span>
      <p class="cover-doc">${esc(labels.title)}</p>
    </div>
    <div class="cover-main">
      <div class="cover-head">
        <p class="cover-kicker">${esc(labels.plate)}</p>
        <h1>${esc(headline)}</h1>
        ${carYear ? `<p class="cover-sub">${esc(carYear)}</p>` : ""}
      </div>
      ${nlPlate}
    </div>
    <p class="cover-meta">${esc(labels.generated)} ${esc(now)}</p>
  </header>
  ${rdwSections}
  ${aiParts}
  ${glossary}
  <p class="report-foot"><strong>Auto Consul</strong> · ${esc(labels.disclaimer)}</p>
</body>
</html>`;
}

/**
 * Renders the dossier into a hidden iframe and triggers the print dialog;
 * the user chooses "Save as PDF" there.
 *
 * We deliberately do NOT use `window.open(..., "noopener")` - that returns
 * `null` per spec (no window handle), so the previous implementation silently
 * did nothing, which is why export "wasn't working". An off-screen iframe also
 * sidesteps mobile pop-up blockers, so it works on phones too.
 */
export function printDossierExport(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };

  iframe.addEventListener("load", () => {
    const win = iframe.contentWindow;
    if (!win) {
      remove();
      return;
    }
    // Clean up after the print dialog closes; the timeout is a fallback for
    // browsers that never fire `afterprint`.
    win.addEventListener("afterprint", remove, { once: true });
    setTimeout(remove, 60_000);
    try {
      win.focus();
      win.print();
    } catch {
      remove();
    }
  });

  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}

export function labelsFromT(
  t: (key: string, vars?: Record<string, string | number>) => string,
  tList: (key: string) => string[],
): DossierExportLabels {
  return {
    title: t("voertuig.export.title"),
    generated: t("voertuig.export.generated"),
    plate: t("voertuig.export.plate"),
    sectionRdw: t("voertuig.section.rdwSupporting"),
    sectionAiLite: t("voertuig.export.sectionLite"),
    sectionAiDeep: t("voertuig.export.sectionDeep"),
    sectionGlossary: t("voertuig.export.glossaryTitle"),
    badgeRdw: t("voertuig.badge.rdw"),
    badgeAi: t("voertuig.badge.ai"),
    badgeLite: t("voertuig.lite.badge"),
    badgeDeep: t("voertuig.export.badgeDeep"),
    disclaimer: t("voertuig.export.disclaimer"),
    glossary: tList("voertuig.export.glossary"),
    rows: {
      brand: t("compare.row.brand"),
      model: t("compare.row.model"),
      year: t("voertuig.export.rowYear"),
      fuel: t("voertuig.tile.brandstof"),
      power: t("voertuig.tile.vermogen"),
      consumption: t("voertuig.tile.verbruik"),
      apk: t("voertuig.tile.apkTot"),
      recall: t("voertuig.export.rowRecall"),
      wok: t("voertuig.export.rowWok"),
      nap: t("voertuig.export.rowNap"),
      seats: t("voertuig.export.rowSeats"),
      doors: t("voertuig.export.rowDoors"),
      yes: t("voertuig.export.yes"),
      no: t("voertuig.export.no"),
      marketRange: t("voertuig.export.marketRange"),
      redFlags: t("voertuig.export.redFlags"),
      pros: t("voertuig.export.pros"),
      cons: t("voertuig.export.cons"),
      checkBefore: t("voertuig.export.checkBefore"),
      reliability: t("voertuig.export.reliability"),
      recalls: t("voertuig.export.recalls"),
      tax: t("voertuig.export.tax"),
      zones: t("voertuig.export.zones"),
      negotiation: t("voertuig.export.negotiation"),
    },
  };
}
