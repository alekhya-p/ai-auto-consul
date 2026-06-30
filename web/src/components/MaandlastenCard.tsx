import { useEffect, useState } from "react";
import { getMonthlyCosts } from "../lib/api";
import { useI18n, useT } from "../lib/i18n";
import type { Lang } from "../lib/i18n";
import type { MonthlyCosts, MonthlyCostsRange, ProvinceCode } from "../lib/types";
import { InfoButton } from "./InfoButton";

const PROVINCES: ProvinceCode[] = ["DR", "FL", "FR", "GE", "GR", "LI", "NB", "NH", "OV", "UT", "ZE", "ZH"];

/**
 * Monthly cost-of-ownership card. Shows the deterministic Dutch MRB
 * computed from RDW data plus indicative ranges for fuel, insurance
 * and maintenance. Province is user-selectable and re-fetches the
 * card on change.
 *
 * Anonymous and free - no auth required, no LLM cost.
 */
export function MaandlastenCard({ plate }: { plate: string }) {
  const t = useT();
  const { lang } = useI18n();
  const [province, setProvince] = useState<ProvinceCode>("NH");
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; data: MonthlyCosts }
    | { kind: "error"; message: string }
    | { kind: "notFound" }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    setState({ kind: "loading" });
    getMonthlyCosts(plate, province, ac.signal)
      .then((data) => {
        if (cancelled) return;
        if (data == null) setState({ kind: "notFound" });
        else setState({ kind: "ok", data });
      })
      .catch((err: unknown) => {
        if (cancelled || ac.signal.aborted) return;
        setState({ kind: "error", message: err instanceof Error ? err.message : "Error" });
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [plate, province]);

  if (state.kind === "notFound") return null;

  return (
    <section className="card maandlasten-card" aria-label={t("voertuig.kosten.title")}>
      <header>
        <h2>
          💰 {t("voertuig.kosten.title")}{" "}
          <span className="badge badge-rdw">{t("voertuig.kosten.badge")}</span>
          <InfoButton textKey="voertuig.kosten.help" />
        </h2>
        <p className="maandlasten-sub">{t("voertuig.kosten.subtitle")}</p>
      </header>

      <div className="maandlasten-province">
        <label htmlFor="province-select">{t("voertuig.kosten.provinceLabel")}</label>
        <select
          id="province-select"
          value={province}
          onChange={(e) => setProvince(e.target.value as ProvinceCode)}
        >
          {PROVINCES.map((code) => (
            <option key={code} value={code}>
              {t(`voertuig.kosten.province.${code}`)}
            </option>
          ))}
        </select>
      </div>

      {state.kind === "loading" && <MaandlastenSkeleton />}
      {state.kind === "error" && <p className="maandlasten-error">{state.message}</p>}
      {state.kind === "ok" && <MaandlastenBody data={state.data} lang={lang} t={t} />}
    </section>
  );
}

function MaandlastenSkeleton() {
  return (
    <div className="maandlasten-skeleton">
      <div className="line w-80" />
      <div className="line w-60" />
      <div className="line w-70" />
      <div className="line w-50" />
    </div>
  );
}

function MaandlastenBody({
  data,
  lang,
  t,
}: {
  data: MonthlyCosts;
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const fmt = (eur: number) => formatEur(eur, lang);
  const range = (r: MonthlyCostsRange | undefined | null) => r
    ? `${fmt(r.lowEur)} - ${fmt(r.highEur)}`
    : "-";
  return (
    <>
      <p className="maandlasten-total" aria-live="polite">
        <span className="maandlasten-total-amount">{range(data.total)}</span>
        <span className="maandlasten-total-label">{t("voertuig.kosten.perMonth")}</span>
      </p>

      <ul className="maandlasten-list">
        {data.mrb && (
          <li className="maandlasten-row maandlasten-mrb">
            <div className="row-head">
              <strong>{t("voertuig.kosten.mrb")}</strong>
              <InfoButton textKey="voertuig.kosten.mrbHelp" />
              <span className="row-amount">
                {fmt(data.mrb.monthEur)} <span className="muted">{t("voertuig.kosten.perMonth")}</span>
              </span>
            </div>
            <div className="row-meta">
              {t("voertuig.kosten.mrbMath", {
                base: fmt(data.mrb.baseQuarterEur),
                pct: data.mrb.provincialOpcentenPercent,
                total: fmt(data.mrb.totalQuarterEur),
              })}
            </div>
          </li>
        )}
        {data.fuel && (
          <li className="maandlasten-row">
            <div className="row-head">
              <strong>{t("voertuig.kosten.fuel")}</strong>
              <InfoButton textKey="voertuig.kosten.fuelHelp" />
              <span className="row-amount">{range(data.fuel)}</span>
            </div>
            <div className="row-meta">
              {t("voertuig.kosten.fuelMeta", {
                km: data.assumptions.kilometersPerYear.toLocaleString(lang === "en" ? "en-GB" : "nl-NL"),
                price: data.assumptions.fuelPriceLabel,
              })}
            </div>
          </li>
        )}
        {data.insurance && (
          <li className="maandlasten-row">
            <div className="row-head">
              <strong>{t("voertuig.kosten.insurance")}</strong>
              <InfoButton textKey="voertuig.kosten.insuranceHelp" />
              <span className="row-amount">{range(data.insurance)}</span>
            </div>
          </li>
        )}
        {data.maintenance && (
          <li className="maandlasten-row">
            <div className="row-head">
              <strong>{t("voertuig.kosten.maintenance")}</strong>
              <InfoButton textKey="voertuig.kosten.maintenanceHelp" />
              <span className="row-amount">{range(data.maintenance)}</span>
            </div>
          </li>
        )}
        {data.apkReservering && (
          <li className="maandlasten-row">
            <div className="row-head">
              <strong>{t("voertuig.kosten.apk")}</strong>
              <InfoButton textKey="voertuig.kosten.apkHelp" />
              <span className="row-amount">{range(data.apkReservering)}</span>
            </div>
          </li>
        )}
      </ul>

      <p className="maandlasten-disclaimer">{t("voertuig.kosten.disclaimer")}</p>
    </>
  );
}

function formatEur(eur: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-IE" : "nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(eur);
  } catch {
    return `€ ${eur}`;
  }
}
