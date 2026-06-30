/**
 * Blog content registry. Each article is hand-written in nl + en and
 * rendered by ArticlePage from this config. We deliberately keep
 * content in TypeScript (not Markdown / CMS) for v1. Four articles
 * doesn't warrant the toolchain, and inline JSX lets us link to
 * /prijzen, /voertuig, etc. without extra plumbing.
 *
 * Each article body is an array of `Block`s so the renderer doesn't
 * need dangerouslySetInnerHTML.
 */

import type { ReactNode } from "react";

export type ArticleBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "callout"; tone: "info" | "warn"; title: string; body: string }
  | { kind: "quote"; text: string };

export interface Article {
  slug: string;
  publishedAt: string;            // ISO date for ordering + display
  readMinutes: number;
  tags: string[];                 // shown as chips
  /** True for stub articles where only title+subtitle are written; the
   *  index shows a "Coming soon" pill and the article page shows a
   *  placeholder body. Lets us publish a populated index while bodies
   *  are still being written. */
  draft?: boolean;
  title: { nl: string; en: string };
  subtitle: { nl: string; en: string };
  hero?: { nl: string; en: string }; // single image alt-text placeholder (no image binary yet)
  body: { nl: ArticleBlock[]; en: ArticleBlock[] };
}

export const ARTICLES: Article[] = [
  {
    slug: "what-rdw-data-tells-you",
    publishedAt: "2026-05-15",
    readMinutes: 6,
    tags: ["rdw", "data", "basics"],
    title: {
      nl: "Wat zegt RDW-data over een tweedehands auto?",
      en: "What RDW data tells you about a used car",
    },
    subtitle: {
      nl: "Het Nederlandse kentekenregister is gratis, openbaar en eerlijker dan de meeste advertentieteksten. Hier is waar je écht naar kijkt.",
      en: "The Dutch vehicle registry is free, public, and more honest than most listing copy. Here's what actually matters.",
    },
    body: {
      nl: [
        { kind: "p", text: "RDW (Rijksdienst voor het Wegverkeer) houdt elk geregistreerd voertuig in Nederland bij. Veel daarvan is openbaar via Open Data: APK-historie, terugroepacties, brandstof, CO₂, eerste registratie, soort eigenaar (particulier of bedrijf), milieuclassificatie. Voordat je een testrit boekt, kun je hier al heel veel weten." },
        { kind: "h2", text: "Wat staat er in?" },
        { kind: "ul", items: [
          "**Eerste registratie**: wanneer de auto voor het eerst in NL op kenteken is gezet. Belangrijk voor BPM, MRB en milieuzones.",
          "**APK geldig tot**: vervaldatum van de huidige keuring. Een auto verkopen met een korte APK is een signaal: wist de verkoper iets dat hij niet wil oplossen?",
          "**Open terugroepacties**: als de fabrikant een veiligheidsupdate heeft uitgegeven en die nog niet uitgevoerd is, staat dat hier.",
          "**Tellerstandoordeel**: Nationale Auto Pas vergelijkt elke geregistreerde tellerstand met de vorige. 'Logisch' = consistent oplopende stand. 'Onlogisch' = mogelijk geknoeid.",
          "**WOK-status**: 'Wacht Op Keuren' betekent dat RDW deze auto niet meer vertrouwt en een nieuwe inspectie eist. Hier wil je nooit instappen.",
          "**Geïmporteerd?** Auto's met een buitenlandse historie hebben vaak een lagere restwaarde en kunnen ontbrekende servicegegevens hebben.",
          "**Brandstof + emissies**: bepaalt MRB, milieuzonetoegang, en aftrek bij zakelijk gebruik.",
        ]},
        { kind: "h2", text: "Wat staat er NIET in?" },
        { kind: "ul", items: [
          "Schadehistorie: RDW registreert geen ongelukken tenzij de auto WOK-gevlagd werd.",
          "Onderhoudsstempel: geen servicehistorie bij merkdealer of ZZP-monteur.",
          "Eigendomswisselingen: wel beschikbaar bij Voertuigchecker en CarPass, niet gratis bij RDW.",
          "Reële marktwaarde: RDW kent geen prijzen, alleen voertuigfeiten.",
        ]},
        { kind: "callout", tone: "info", title: "Tip", body: "Bij Auto Consul vullen we RDW gratis aan met indicatieve marktwaarde en een AI-samenvatting in begrijpelijke taal. Handig om in één scherm te zien of een auto het bekijken waard is." },
        { kind: "h2", text: "De volgorde die wij volgen" },
        { kind: "ol", items: [
          "Kenteken opzoeken bij Auto Consul (gratis). Fact-check de advertentie meteen.",
          "Check terugroepacties: is er iets open? Vraag de verkoper om bewijs van uitvoering.",
          "Kijk naar tellerstandoordeel: 'onlogisch' is een hard NO.",
          "Vergelijk APK-geldigheid met de aangeboden prijs. 1 maand APK = 1 maand om gebreken te ontdekken.",
          "Importauto's? Vraag bewijs van schadehistorie uit het land van herkomst.",
        ]},
        { kind: "p", text: "RDW-data is geen vervanger voor een fysieke inspectie, maar het is de filter waarmee je 80% van de slechte aanbiedingen meteen overslaat." },
      ],
      en: [
        { kind: "p", text: "RDW (Rijksdienst voor het Wegverkeer, the Dutch road-vehicle authority) keeps a record of every registered vehicle in the Netherlands. A lot of it is public via Open Data: MOT history, recalls, fuel, CO₂, first registration, owner type (private vs business), emission classification. Before you book a test drive you can already learn a lot." },
        { kind: "h2", text: "What's in it?" },
        { kind: "ul", items: [
          "**First registration**: when the car was first NL-registered. Drives BPM, MRB road tax, emission-zone access.",
          "**APK valid until**: current MOT expiry. Selling with a short MOT remaining is a signal: did the seller know about something they didn't want to fix?",
          "**Open recalls**: if the manufacturer issued a safety update that hasn't been performed yet, it's listed here.",
          "**Odometer assessment**: Nationale Auto Pas compares every recorded reading. 'Logical' = consistent. 'Illogical' = potential tampering.",
          "**WOK status**: 'Wacht Op Keuren' (awaiting inspection) means RDW no longer trusts the car. Never buy one in this state.",
          "**Imported?** Cars with foreign history often have lower resale and may have missing service records.",
          "**Fuel + emissions**: drives road tax, emission-zone access, business-tax write-off.",
        ]},
        { kind: "h2", text: "What's NOT in it?" },
        { kind: "ul", items: [
          "Accident history: RDW only records crashes if the car was WOK-flagged.",
          "Service stamps: no maintenance history from dealer or independent garage.",
          "Number of owners: available via Voertuigchecker and CarPass, not free RDW.",
          "Actual market value: RDW knows facts, not prices.",
        ]},
        { kind: "callout", tone: "info", title: "Tip", body: "Auto Consul layers an indicative market-value range and a plain-language AI summary on top of RDW for free. Useful to see in one screen whether a car is even worth viewing." },
        { kind: "h2", text: "The order we recommend" },
        { kind: "ol", items: [
          "Look up the plate at Auto Consul (free). Fact-check the listing immediately.",
          "Check recalls: anything open? Ask the seller for proof it's been done.",
          "Look at odometer assessment: 'illogical' is a hard NO.",
          "Compare MOT validity against the asking price. 1 month of MOT left = 1 month to discover problems.",
          "Imported car? Request damage history from the country of origin.",
        ]},
        { kind: "p", text: "RDW data is no replacement for a physical inspection, but it's the filter that lets you skip 80% of the bad listings immediately." },
      ],
    },
  },
  {
    slug: "5-things-to-check-before-buying",
    publishedAt: "2026-05-14",
    readMinutes: 5,
    tags: ["buying", "checklist", "tips"],
    title: {
      nl: "5 dingen om te checken vóór je een tweedehands auto koopt",
      en: "5 things to check before you buy a Dutch used car",
    },
    subtitle: {
      nl: "Een tweedehands auto in Nederland kopen voelt overzichtelijk, tot je in details verdrinkt. Dit is de korte versie.",
      en: "Buying second-hand in the Netherlands feels simple, until you're knee-deep in detail. Here's the short version.",
    },
    body: {
      nl: [
        { kind: "p", text: "Iedereen heeft een mening over auto's, maar weinig daarvan zijn praktisch. Dit is de checklist die wij zelf afwerken voordat we überhaupt opbellen." },
        { kind: "h2", text: "1. Tellerstandoordeel" },
        { kind: "p", text: "Begin hier. Als de stand 'onlogisch' is volgens NAP, is alle andere informatie verdacht. RDW toont dit gratis." },
        { kind: "h2", text: "2. Open terugroepacties" },
        { kind: "p", text: "Veiligheidsupdates die nog niet zijn uitgevoerd kosten 0 euro om te laten doen, maar de auto met 1 open recall is per definitie minder waard. Vraag de verkoper om bewijs of plan een gratis afspraak met een merkdealer." },
        { kind: "h2", text: "3. APK-geldigheid + APK-historie" },
        { kind: "p", text: "Niet alleen 'is er APK', maar HOEVEEL maanden zit erin? En wat zijn de afgekeurde punten geweest? Een patroon van remmen-, ophanging- of rooststcheckpunten in de laatste 3 keuringen voorspelt dezelfde rekening." },
        { kind: "h2", text: "4. Milieuzone-toegang" },
        { kind: "p", text: "Diesel uit 2010 mag Amsterdam centrum niet meer in. Hybride 2014 zit op de wip in 2026. Check welke zones de auto NU mag en in 2030 nog mag, want milieuzones worden alleen maar strenger." },
        { kind: "h2", text: "5. Maandlasten écht uitrekenen" },
        { kind: "p", text: "Vraagprijs is één getal. Maandlasten zijn nog 5 anderen: MRB (per provincie verschillend), verzekering (afhankelijk van leeftijd + cilinderinhoud), brandstof (LPG goedkoop, benzine duur), bijtelling (zakelijk), onderhoud. Bij hybride auto's overschatten verkopers vaak de verbruikswinst. Vraag bewijs." },
        { kind: "callout", tone: "warn", title: "Rode vlag", body: "Een verkoper die geen 24 uur wil wachten zodat je een onafhankelijke check kunt doen, verkoopt een auto die niet door die check heen komt. Lopen, niet rennen." },
      ],
      en: [
        { kind: "p", text: "Everyone has opinions about used cars; few are practical. This is the checklist we run before we even pick up the phone." },
        { kind: "h2", text: "1. Odometer assessment" },
        { kind: "p", text: "Start here. If NAP rates the reading 'illogical', every other detail is suspect. RDW shows this for free." },
        { kind: "h2", text: "2. Open recalls" },
        { kind: "p", text: "Unperformed safety updates cost €0 to fix at a brand dealer, but a car with an open recall is technically less valuable. Ask for proof, or schedule a free dealer appointment." },
        { kind: "h2", text: "3. APK validity + APK history" },
        { kind: "p", text: "Not just \"does it have MOT\" but HOW MANY MONTHS are left? And what were the failure items? A pattern of brake / suspension / rust points in the last 3 inspections predicts the same invoice for you." },
        { kind: "h2", text: "4. Emission-zone access" },
        { kind: "p", text: "A 2010 diesel can't enter central Amsterdam. A 2014 hybrid is borderline in 2026. Check which zones the car can enter NOW and in 2030, because emission zones only get stricter." },
        { kind: "h2", text: "5. Real monthly cost, not just price" },
        { kind: "p", text: "Asking price is one number. Monthly cost is 5 more: MRB road tax (province-dependent), insurance (age + engine size), fuel (LPG cheap, petrol expensive), company-car tax, maintenance. With hybrids, sellers overstate the fuel saving. Ask for proof." },
        { kind: "callout", tone: "warn", title: "Red flag", body: "A seller who won't wait 24 hours for you to do an independent inspection is selling a car that won't pass that inspection. Walk, don't run." },
      ],
    },
  },
  {
    slug: "apk-history-red-flags",
    publishedAt: "2026-05-12",
    readMinutes: 7,
    tags: ["apk", "inspection", "red-flags"],
    title: {
      nl: "APK-historie lezen: welke rode vlaggen je niet mag missen",
      en: "Reading APK history: red flags you can't afford to miss",
    },
    subtitle: {
      nl: "Een goedgekeurde APK is geen garantie. De geschiedenis daarachter vertelt veel meer.",
      en: "A passed MOT is no guarantee. The history behind it tells you a lot more.",
    },
    body: {
      nl: [
        { kind: "p", text: "Bij iedere APK noteert de keurmeester gebreken: van 'reparatieadvies' (gele kaart) tot 'afgekeurd' (rode kaart). Veel daarvan staat publiek bij RDW, niet alleen het eindoordeel maar het patroon." },
        { kind: "h2", text: "Patronen die je wilt zien" },
        { kind: "ul", items: [
          "Eerste 2 keuringen schoon = consistent onderhoud bij de dealer.",
          "Geen afkeur in de laatste 5 jaar = uitzonderlijk goed onderhouden.",
          "Adviespunten die in de volgende keuring weg zijn = eigenaar lost ze proactief op.",
        ]},
        { kind: "h2", text: "Patronen die je wilt zien aankomen" },
        { kind: "ul", items: [
          "Rem-gerelateerde adviezen in 2+ opeenvolgende keuringen: schijven en blokken zijn voorzien.",
          "Ophanging / fusee-gewrichten: €400-800 in komende werkplaats.",
          "Rooststcheckpunten op bodemplaat: kan duur laswerk worden bij volgende APK.",
          "Lichtafstelling herhaaldelijk: vaak kleine afregeling, soms duidt op chassis-issue (frontale aanrijding?).",
        ]},
        { kind: "h2", text: "Patronen die rood zijn" },
        { kind: "ul", items: [
          "Afkeur op koppeling van remleiding: geen discussie mogelijk, dit moet meteen.",
          "Afkeur op stuurinrichting: direct levensgevaar.",
          "Afkeur op chassis-corrosie: meestal goedkoper om de auto te vervangen.",
          "WOK-historie (waarbij RDW de auto van de weg haalde): auto's met WOK-historie verkoop je later met 20-30% korting.",
        ]},
        { kind: "callout", tone: "info", title: "Hoe je dit met Auto Consul ziet", body: "Bij elk dossier op Auto Consul (vanaf €4,95) zie je de volledige APK-historie inclusief individuele gebreken per keuring. Je leest in 2 minuten of dit pattern bij jouw budget past." },
      ],
      en: [
        { kind: "p", text: "At every APK (Dutch MOT), the inspector logs defects ranging from 'advisory' (yellow) to 'failure' (red). Much of this is public via RDW, not just the verdict but the pattern over years." },
        { kind: "h2", text: "Patterns you want to see" },
        { kind: "ul", items: [
          "First 2 inspections clean = consistent dealer servicing.",
          "No failures in the last 5 years = exceptionally well kept.",
          "Advisories that disappear in the next inspection = owner is proactive.",
        ]},
        { kind: "h2", text: "Patterns you want to anticipate" },
        { kind: "ul", items: [
          "Brake-related advisories in 2+ consecutive inspections: discs and pads are due.",
          "Suspension / ball-joint notes: €400-800 in upcoming workshop bills.",
          "Underbody corrosion checkpoints: could become expensive welding at the next MOT.",
          "Repeated headlight aim: usually a quick adjustment but sometimes signals a chassis issue (frontal damage?).",
        ]},
        { kind: "h2", text: "Patterns that are red" },
        { kind: "ul", items: [
          "Failure on a brake hose or pipe: no debate, this must be done immediately.",
          "Failure on steering: direct safety hazard.",
          "Failure on chassis corrosion: usually cheaper to replace the car.",
          "WOK history (where RDW took the car off the road): cars with WOK history resell at 20-30% less.",
        ]},
        { kind: "callout", tone: "info", title: "How you see this in Auto Consul", body: "Every Auto Consul dossier (from €4.95) includes the full APK history with per-inspection defects. You can read in 2 minutes whether this pattern fits your budget." },
      ],
    },
  },
  {
    slug: "emission-zones-bpm-explained",
    publishedAt: "2026-05-10",
    readMinutes: 6,
    tags: ["taxes", "milieuzone", "bpm"],
    title: {
      nl: "Milieuzones en BPM: wat betaal je écht?",
      en: "Emission zones and BPM tax: what you actually pay",
    },
    subtitle: {
      nl: "BPM, MRB, bijtelling, milieuzone-acces: de meeste kopers begrijpen één van die vier. Hier is de korte versie van alle vier.",
      en: "BPM, MRB, company-car tax, emission-zone access: most buyers understand one of the four. Here's the short version of all four.",
    },
    body: {
      nl: [
        { kind: "h2", text: "BPM: eenmalig, bij eerste NL-registratie" },
        { kind: "p", text: "BPM is een eenmalige aanschafbelasting die je betaalt zodra een auto voor het eerst in Nederland op kenteken wordt gezet. Tweedehandsauto's die al in NL gereden hebben? BPM is al betaald, je betaalt er bij doorverkoop niets meer aan. Importauto's? Je betaalt vaak BPM bij invoer (er is een afschrijvingstabel)." },
        { kind: "h2", text: "MRB: maandelijks, naar gewicht en provincie" },
        { kind: "p", text: "Motorrijtuigenbelasting (wegenbelasting). Twee parameters: gewicht van de auto en je provincie (de 'opcenten'). Voor een 1.300kg benzine-auto in Noord-Holland: rond €60/maand. Volledig elektrisch: 25% van het normale tarief (tot 2030). Plug-in hybride: 50%. LPG en diesel: aanzienlijk duurder." },
        { kind: "h2", text: "Bijtelling: alleen bij zakelijk gebruik" },
        { kind: "p", text: "Als je auto van de zaak is en je rijdt er meer dan 500 km/jaar privé in: bijtelling. Voor 2026 is dat 22% van de catalogusprijs voor benzine/diesel en 17% voor de eerste €30K bij elektrisch (16% in 2026, gaat stapsgewijs omhoog). Reken dit altijd nét uit voor jouw situatie, want kleine cataloguswaarde-verschillen tikken aan." },
        { kind: "h2", text: "Milieuzones: toegang, geen geld" },
        { kind: "p", text: "Steden als Amsterdam, Utrecht en Rotterdam hebben zones waar bepaalde auto's niet meer in mogen. Het is geen extra belasting, het is een 'mag je hier rijden?'-vraag. In 2026: diesel Euro 5 en ouder uit de meeste centra. In 2030: alle fossiele brandstoffen in Amsterdam centrum verboden. Check vóór aankoop welke zones je auto vandaag mag en in 4 jaar nog mag." },
        { kind: "callout", tone: "info", title: "Auto Consul rekent dit uit", body: "In elk dossier zie je een maandlasten-schatting plus welke milieuzones gelden voor déze specifieke auto, met vooruitblik tot 2030. Geen Excel-formules nodig." },
      ],
      en: [
        { kind: "h2", text: "BPM: one-time, at first NL registration" },
        { kind: "p", text: "BPM is a one-time purchase tax paid when a car is first NL-registered. Used cars already registered in NL? BPM is already paid, you owe nothing on resale. Imports? You usually pay BPM at import (there's a depreciation schedule)." },
        { kind: "h2", text: "MRB: monthly, by weight and province" },
        { kind: "p", text: "Motor vehicle tax (road tax). Two parameters: car weight and your province (the 'opcenten' surcharge). A 1,300 kg petrol car in North Holland: about €60/month. Full electric: 25% of the standard rate (until 2030). Plug-in hybrid: 50%. LPG and diesel: significantly higher." },
        { kind: "h2", text: "Bijtelling: only with business use" },
        { kind: "p", text: "If the car is a company car and you drive >500 km/year privately: bijtelling tax. For 2026 it's 22% of list price for petrol/diesel and 17% on the first €30K for EV (16% in 2026, rising). Always run the numbers for your case, as small list-price differences add up." },
        { kind: "h2", text: "Emission zones: access, not money" },
        { kind: "p", text: "Cities like Amsterdam, Utrecht and Rotterdam have zones where certain cars are no longer welcome. It's not an extra tax, it's a 'are you allowed to drive here?' question. In 2026: diesel Euro 5 and older banned from most city centres. By 2030: all fossil-fuel cars banned from central Amsterdam. Check before purchase what zones the car can enter today AND in 4 years." },
        { kind: "callout", tone: "info", title: "Auto Consul does this math", body: "Every dossier shows a monthly-cost estimate plus which emission zones apply to THIS specific car, with a forward view to 2030. No spreadsheet required." },
      ],
    },
  },

  // Stub articles (titles only; bodies coming)
  {
    slug: "wok-status-explained",
    publishedAt: "2026-05-08",
    readMinutes: 4,
    tags: ["rdw", "wok", "red-flags"],
    draft: true,
    title: {
      nl: "WOK-status uitgelegd: waarom je nooit een 'Wacht Op Keuren'-auto koopt",
      en: "WOK status explained: why you never buy a car flagged 'awaiting inspection'",
    },
    subtitle: {
      nl: "RDW vlagt sommige auto's als onbetrouwbaar tot ze opnieuw gekeurd zijn. Hier is wat dat betekent voor jouw portemonnee, je verzekering en je kans op een soepele verkoop.",
      en: "RDW marks some cars as untrustworthy until they pass a fresh inspection. Here's what that means for your wallet, your insurance, and your odds of reselling later.",
    },
    body: stubBody(),
  },
  {
    slug: "bpm-2026-import-trap",
    publishedAt: "2026-05-05",
    readMinutes: 7,
    tags: ["bpm", "import", "taxes"],
    draft: true,
    title: {
      nl: "BPM 2026: de importval die kopers €3.000 kost",
      en: "BPM 2026: the import trap costing buyers €3,000",
    },
    subtitle: {
      nl: "De nieuwe BPM-tabel maakt sommige EU-imports een koopje en andere een ramp. Een eerlijke uitleg over wat er per 1 januari 2026 verandert en hoe je de val ontwijkt.",
      en: "The 2026 BPM tax schedule turns some EU imports into a steal and others into a disaster. An honest breakdown of what changes on 1 January 2026 and how to dodge the trap.",
    },
    body: stubBody(),
  },
  {
    slug: "milieuzone-2030-which-cars-locked-out",
    publishedAt: "2026-05-02",
    readMinutes: 6,
    tags: ["milieuzone", "ev", "planning"],
    draft: true,
    title: {
      nl: "Milieuzones 2030: welke auto's zijn straks uitgesloten?",
      en: "Emission zones 2030: which cars get locked out of which cities?",
    },
    subtitle: {
      nl: "Amsterdam, Utrecht, Rotterdam, Den Haag, Eindhoven en Tilburg hebben elk hun eigen tijdlijn. Een overzicht per emissieklasse, per stad, met de exacte datums.",
      en: "Amsterdam, Utrecht, Rotterdam, The Hague, Eindhoven and Tilburg each run their own timeline. A breakdown by emission class and city, with the exact dates.",
    },
    body: stubBody(),
  },
  {
    slug: "ev-tax-cliff-2026",
    publishedAt: "2026-04-28",
    readMinutes: 5,
    tags: ["ev", "taxes", "mrb"],
    draft: true,
    title: {
      nl: "De EV-belastingklif van 2026: wat verandert er voor elektrische rijders?",
      en: "The 2026 EV tax cliff: what changes for electric drivers?",
    },
    subtitle: {
      nl: "MRB-korting daalt, bijtelling stijgt, subsidies vervallen. Een rustige update over wat dit doet met de werkelijke maandlasten van een tweedehands EV.",
      en: "The MRB discount shrinks, bijtelling climbs, subsidies expire. A calm look at what this does to the real monthly cost of a used EV.",
    },
    body: stubBody(),
  },
];

function stubBody(): { nl: ArticleBlock[]; en: ArticleBlock[] } {
  return {
    nl: [
      {
        kind: "callout",
        tone: "info",
        title: "Binnenkort beschikbaar",
        body: "We schrijven dit artikel momenteel. Wil je iets specifieks behandeld zien? Mail support@autoconsul.nl met je vraag, dan staat het er voor je klaar.",
      },
      { kind: "p", text: "In de tussentijd: het bovenstaande onderwerp komt in elk volledig dossier op Auto Consul al langs. Voer een kenteken in om te zien hoe we het voor díe specifieke auto uitleggen." },
    ],
    en: [
      {
        kind: "callout",
        tone: "info",
        title: "Coming soon",
        body: "We're writing this article right now. Have a specific angle you want us to cover? Email support@autoconsul.nl with your question and we'll have it ready for you.",
      },
      { kind: "p", text: "In the meantime: the topic above already appears in every full dossier on Auto Consul. Look up a plate to see how we explain it for that specific car." },
    ],
  };
}

export function articleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export interface ArticleRendererProps {
  article: Article;
  lang: "nl" | "en";
}

/** Helper for renderer: converts a Block to a ReactNode. */
export function renderBlock(b: ArticleBlock, key: number): ReactNode {
  return undefined; // placeholder; ArticlePage owns the real renderer
  void b; void key;
}
