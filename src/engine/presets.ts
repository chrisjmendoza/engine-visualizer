/**
 * Preset per-cylinder geometries for famous sports-car engines.
 *
 * Every value is stock (factory) geometry for one cylinder, in millimeters,
 * matching `CrankMechanismConfig` (§8). Bore and stroke come from published
 * factory specifications. Connecting-rod center-to-center length is the hard
 * value to source — it is not always published by the OEM — so each rod
 * length below is corroborated by at least two independent aftermarket
 * connecting-rod manufacturers or engine-parts catalogs (Wiseco, Manley,
 * Eagle, K1 Technologies, CP Pistons, Tomei, Brian Crower, etc.), which
 * machine stock-length replacement/upgrade rods and publish exact
 * center-to-center dimensions. `compressionRatio` is the factory static
 * ratio, also corroborated by at least two independent sources; where a
 * market or model-year variant changed it (e.g. JDM vs. US F20C, NA8 vs.
 * NB Miata 1.8, US vs. premium-fuel-market ND Skyactiv-G), the comment
 * names the variant this preset represents and the alternate figure(s).
 * `redlineRpm` is the manufacturer's stated (tachometer) redline for that
 * same variant — where a factory fuel cut or rev-limiter sits at a
 * different figure than the published redline, the comment notes both.
 * One exception is noted explicitly where it occurs: the Ferrari 458
 * Italia's rod length could not be corroborated by a second independent
 * source despite an extensive search, and rests on a single sourced
 * figure. Sources are noted per engine below.
 *
 * This module is pure data: no React, Three.js, or browser imports.
 */

import type { CrankMechanismConfig } from "./types";

export interface EnginePreset {
  /** Kebab-case identifier, stable across releases. */
  id: string;
  /** Display name, e.g. "Honda S2000 (AP1)". */
  name: string;
  /** Manufacturer, used to group the preset picker. */
  brand: string;
  /** Manufacturer engine code, e.g. "F20C". */
  engineCode: string;
  /** Short displacement/layout label, e.g. "2.0 L inline-4". */
  layoutLabel: string;
  /** Per-cylinder stock geometry. */
  config: CrankMechanismConfig;
}

export const ENGINE_PRESETS: readonly EnginePreset[] = [
  {
    id: "s2000-ap1",
    name: "Honda S2000 (AP1)",
    brand: "Honda",
    engineCode: "F20C",
    layoutLabel: "2.0 L inline-4",
    // rod 153.0 mm — corroborated by Wiseco piston specs (cartel-aus.com),
    // FCP Engineering (fcp-engineering.com), and ZRP (zrp-rods.com).
    // CR 11.0:1 — US/European-spec F20C, confirmed by Wikipedia ("Honda
    // F20C engine") and jdmbuysell.com; the JDM F20C is higher, at 11.7:1.
    // Redline 9000 rpm — Honda's stated tachometer redline for both JDM and
    // US/EU F20C, confirmed by jdmbuysell.com ("F20C Engine — Specs, Tuning
    // & Chassis Guide") and carbuzz.com ("How Honda Engineered The F20C For
    // 9,000 RPM"); the US ECU's fuel cut trims in slightly earlier, around
    // 8,900 rpm.
    config: {
      boreMm: 87.0,
      strokeMm: 84.0,
      rodLengthMm: 153.0,
      compressionRatio: 11.0,
      redlineRpm: 9000,
    },
  },
  {
    id: "s2000-ap2",
    name: "Honda S2000 (AP2)",
    brand: "Honda",
    engineCode: "F22C1",
    layoutLabel: "2.2 L inline-4",
    // rod 149.7 mm — CP Pistons spec sheet (realstreetperformance.com) and
    // Eagle/Brian Crower part numbers denoting 5.893 in (drifthq.com,
    // briancrower.com) both give 149.68 mm center-to-center.
    // CR 11.1:1 — same figure for both NA and JDM F22C1, confirmed by
    // Wikipedia ("Honda F20C engine") and S2KI forum consensus
    // (s2ki.com "Compression numbers for F22C").
    // Redline 8000 rpm — the AP2's piston-friendly reduction from the AP1's
    // 9000 rpm, confirmed by an honda-tech.com discussion ("ap1 9k rpm, ap2
    // 8k rpm why is that?") and an s2ki.com thread ("Exact redline for
    // ap2"); the fuel cutoff sits slightly higher, around 8,200 rpm.
    config: {
      boreMm: 87.0,
      strokeMm: 90.7,
      rodLengthMm: 149.7,
      compressionRatio: 11.1,
      redlineRpm: 8000,
    },
  },
  {
    id: "miata-na-nb-1-8",
    name: "Mazda MX-5 Miata (NA/NB)",
    brand: "Mazda",
    engineCode: "BP",
    layoutLabel: "1.8 L inline-4",
    // rod 132.9 mm (5.233 in) — Manley (lmperformance.com) and Eagle
    // (eaglerod.com) both catalog stock-length B6/BP replacement rods at
    // 5.233 in center-to-center.
    // CR 9.0:1 — this BP variant spans multiple factory CRs (NA8, 1994-97:
    // 9.0:1; NB8A, 1999-2000: 9.5:1; NB8B, 2001-05: 10.0:1); this preset
    // uses the original NA8 figure to match the "NA/NB" label's earliest
    // and most-cited variant, confirmed by gwracing.altervista.org and
    // mx5nutz.com ("Na8 Compression Ratios").
    // Redline 7000 rpm — matches the NA8 1.8 figure, confirmed by
    // auto-data.net ("Mazda MX-5 I (NA) 1.8 (130 Hp)", max rev 7000) and
    // Mazda's own 2004 NB Miata spec sheet (news.mazdausa.com).
    config: {
      boreMm: 83.0,
      strokeMm: 85.0,
      rodLengthMm: 132.9,
      compressionRatio: 9.0,
      redlineRpm: 7000,
    },
  },
  {
    id: "miata-na-1-6",
    name: "Mazda MX-5 Miata (NA, 1.6)",
    brand: "Mazda",
    engineCode: "B6",
    layoutLabel: "1.6 L inline-4",
    // rod 132.9 mm (5.233 in) — same Manley/Eagle B6/BP catalog entry as the
    // BP above, corroborated by Wiseco's B6 turbo piston spec
    // (cartel-aus.com), which lists a 133 mm (5.234 in) rod.
    // CR 9.4:1 — 5-speed-manual B6ZE figure (the automatic-transmission
    // version used a lower 9.0:1 piston), confirmed by enginetechspecs.com
    // ("Mazda B6ZE Engine") and mx5world.com ("Miatapower List Archive:
    // Compression ratio of 1.6").
    // Redline 7200 rpm — confirmed by enginetechspecs.com ("Mazda B6ZE
    // Engine") and a grassrootsmotorsports.com forum discussion of the
    // B6's rev limiter; the tachometer face is famously marked to 7500 on
    // some trims even though the factory-rated limiter is 7200.
    config: {
      boreMm: 78.0,
      strokeMm: 83.6,
      rodLengthMm: 132.9,
      compressionRatio: 9.4,
      redlineRpm: 7200,
    },
  },
  {
    id: "corvette-c6-ls3",
    name: "Chevrolet Corvette (C6)",
    brand: "Chevrolet",
    engineCode: "LS3",
    layoutLabel: "6.2 L V8",
    // rod 154.9 mm (6.098 in) — GM Performance part 12649190 spec, listed
    // consistently across JEGS (jegs.com) and K1 Technologies
    // (k1technologies.com).
    // CR 10.7:1 — confirmed by Chevrolet's own LS3 crate-engine page
    // (chevrolet.com) and lsdepotottawa.com's LS3 spec sheet.
    // Redline 6600 rpm — confirmed by Chevrolet's own LS3 long-block
    // installation guide (chevrolet.com) and a CorvetteForum discussion
    // ("Why is the LS3's Redline 6600 RPM").
    config: {
      boreMm: 103.25,
      strokeMm: 92.0,
      rodLengthMm: 154.9,
      compressionRatio: 10.7,
      redlineRpm: 6600,
    },
  },
  {
    id: "corvette-z06-c6-ls7",
    name: "Chevrolet Corvette Z06 (C6)",
    brand: "Chevrolet",
    engineCode: "LS7",
    layoutLabel: "7.0 L V8",
    // rod 154.1 mm (6.067 in) stock titanium rod — Wiseco piston spec
    // listing "6.067 Rod" for LS7 stock rods (briantooleyracing.com),
    // corroborated by LS-engine community references to GM's 6.067 in
    // titanium rod (LS1TECH, Yellow Bullet Forums).
    // CR 11.0:1 — confirmed by GM Authority (gmauthority.com) and
    // CorvetteForum's LS7 engine writeup (corvetteforum.com); some sources
    // round this to 11.1:1, but 11.0:1 is the figure GM itself publishes.
    // Redline 7000 rpm — confirmed by CorvetteForum ("Fuel shut-off limit
    // vs redline") and vette-vues.com ("The Corvette LS7 Engine"); the
    // rev-limiter sits just above it, at 7100 rpm.
    config: {
      boreMm: 104.8,
      strokeMm: 101.6,
      rodLengthMm: 154.1,
      compressionRatio: 11.0,
      redlineRpm: 7000,
    },
  },
  {
    id: "supra-2jzgte",
    name: "Toyota Supra",
    brand: "Toyota",
    engineCode: "2JZ-GTE",
    layoutLabel: "3.0 L inline-6",
    // rod 142.0 mm — Tomei Powered (products.tomeiusa.com), CXRacing, and
    // Boostline (boostlineproducts.com) all list 142.00 mm as the
    // OEM-length replacement rod for 2JZ-GE/GTE.
    // CR 8.5:1 — the turbo GTE's recessed-crown pistons give this figure
    // for both US and JDM markets, confirmed by speedwaymotors.com and
    // 8020automotive.com's 2JZ-GTE guide.
    // Redline 6800 rpm — the early, non-VVT-i JZA80 (1993-97) figure that
    // matches this preset's bore/stroke/CR, confirmed by jz-engine.blogspot.com
    // ("Toyota Supra JZA80 (2JZ-GTE)") and jdmbuysell.com's 2JZ-GTE guide.
    config: {
      boreMm: 86.0,
      strokeMm: 86.0,
      rodLengthMm: 142.0,
      compressionRatio: 8.5,
      redlineRpm: 6800,
    },
  },
  {
    id: "k20a-type-r",
    name: "Honda Civic / Integra Type R",
    brand: "Honda",
    engineCode: "K20A",
    layoutLabel: "2.0 L inline-4",
    // rod 139.0 mm — K1 Technologies, Manley, and Eagle each catalog
    // 139 mm stock-length H-beam rods for K20A/K20A2.
    // CR 11.5:1 — JDM K20A figure, as used in the DC5 Integra Type R and
    // EP3 Civic Type R this preset represents; confirmed by Wikipedia
    // ("Honda Integra (fourth generation)") and autoevolution.com. The
    // USDM K20A2 (RSX Type-S) is lower, at 11.0:1.
    // Redline 8400 rpm — JDM K20A Type R figure, confirmed by a k20a.org
    // forum thread ("Stock K20A PRC-023 Type-R redline (EM2)") and
    // drifted.com's K20 guide.
    config: {
      boreMm: 86.0,
      strokeMm: 86.0,
      rodLengthMm: 139.0,
      compressionRatio: 11.5,
      redlineRpm: 8400,
    },
  },
  {
    id: "tsx-k24a2",
    name: "Acura TSX (K24A2)",
    brand: "Honda",
    engineCode: "K24A2",
    layoutLabel: "2.4 L inline-4",
    // Acura-badged (2004-2008 Acura TSX); grouped under brand "Honda" here
    // so it sits with the other Honda-family cars rather than starting a
    // one-car "Acura" brand.
    // bore/stroke 87.0/99.0 mm — this bottom end is shared across most of
    // the naturally aspirated K24 family (Accord, Element, CR-V, and later
    // Civic Si all use the same 87x99 architecture), confirmed by
    // motorreviewer.com ("Honda 2.4L K24A/K24Z/K24W Engine Specs") and a
    // honda-tech.com forum thread ("K24A1 vs K24A2 vs K24A4 Short Blocks").
    // rod 152.0 mm (5.984 in) — also shared architecture-wide (a k20a.org
    // forum thread confirms K24A1 and K24A2 use the same length), and
    // confirmed by stock-length replacement rods from Manley
    // (manleyperformance.com, realstreetperformance.com) and K1
    // Technologies (vividracing.com, lethalperformance.com — distinct from
    // K1's separate 143.4 mm stroker-length part for the same block).
    // CR 10.5:1 and redline 7100 rpm are K24A2/TSX-specific, NOT shared
    // with the rest of the family: the Accord's K24A4/K24A8 run a lower
    // 9.7:1 with a lower redline, and the later K24Z3 (2009+ TSX) runs a
    // higher 11.0:1 — both are genuinely different spec sets and are
    // deliberately not folded into this entry. CR confirmed by
    // drifted.com ("Ultimate Honda K24 Guide") and a honda-tech.com forum
    // thread; redline confirmed by an acurazine.com forum thread ("a tiny
    // bit confused on the stock rpm range") and Hondata's TSX reflash
    // product pages (hondata.com, evasivemotorsports.com), which document
    // the stock 7100 rpm limit their reflash raises to 7600.
    config: {
      boreMm: 87.0,
      strokeMm: 99.0,
      rodLengthMm: 152.0,
      compressionRatio: 10.5,
      redlineRpm: 7100,
    },
  },
  {
    id: "miata-nd-2-0",
    name: "Mazda MX-5 Miata (ND)",
    brand: "Mazda",
    engineCode: "PE",
    layoutLabel: "2.0 L Skyactiv-G inline-4",
    // rod 154.8 mm — consistently published stock-length replacement-rod
    // dimension across Maxpeedingrods (maxpeedingrods.co.uk) and Clegg
    // Engine (cleggengine.com).
    // CR 13.0:1 — US-spec PE-VPS figure, confirmed by motor1.com and
    // australiancar.reviews; premium-fuel markets (e.g. Europe) run a
    // higher 14.0:1 on the same engine, per Wikipedia ("Mazda MX-5 (ND)").
    // Redline 7500 rpm — the 2019+ 181 hp US-spec update's figure,
    // confirmed by Wikipedia ("Mazda MX-5 (ND)") and
    // automotivepowertraintechnologyinternational.com's engine-on-test
    // writeup.
    config: {
      boreMm: 83.5,
      strokeMm: 91.2,
      rodLengthMm: 154.8,
      compressionRatio: 13.0,
      redlineRpm: 7500,
    },
  },
  {
    id: "ferrari-458-italia",
    name: "Ferrari 458 Italia",
    brand: "Ferrari",
    engineCode: "F136 FB",
    layoutLabel: "4.5 L V8",
    // bore/stroke 94.0/81.0 mm, CR 12.5:1 — confirmed by Wikipedia
    // ("Ferrari F136 engine") and encycarpedia.com's 458 Italia spec page.
    // rod 144.0 mm (5.669 in), rod/stroke 1.778 — despite an extensive
    // search (Wikipedia, MAHLE, JE Pistons, Wossner, FerrariChat, Italian
    // technical press, FIA GT3 homologation docs, engine-teardown sites),
    // only ONE identifiable source could be found: a nastyz28.com forum
    // post ("Opinion on a long rod engine") giving "5.669in Rod to its
    // 3.189in stroke" — note 3.189 in = 81.0 mm, matching the confirmed
    // stroke exactly, which is why this figure is used despite falling
    // short of this file's usual two-source bar. Flagged for whoever
    // reviews this data; a second source would be welcome.
    // Redline 9000 rpm — confirmed by hotcars.com ("The 9,000 RPM V8 That
    // Defined Ferrari's Golden Era") and whichcar.com.au ("Great V8s:
    // Ferrari F136").
    config: {
      boreMm: 94.0,
      strokeMm: 81.0,
      rodLengthMm: 144.0,
      compressionRatio: 12.5,
      redlineRpm: 9000,
    },
  },
  {
    id: "silvia-sr20det",
    name: "Nissan Silvia (S13/S14)",
    brand: "Nissan",
    engineCode: "SR20DET",
    layoutLabel: "2.0 L turbo inline-4",
    // bore/stroke 86.0/86.0 mm (square), CR 8.5:1 — confirmed by
    // hpacademy.com ("Everything You Need to Know About the SR20DET") and
    // Wikipedia ("Nissan SR20DET").
    // rod 136.25 mm (5.365 in) — stock-length replacement rods from Wiseco
    // (wiseco.com product catalog) and Eagle (goldeneaglemfg.com,
    // extremepsi.com) both list this length for the SR20/SR20DET.
    // Redline 7500 rpm — the S13/early-S14 "Redtop" figure, confirmed by
    // low-offset.com ("Nissan SR20DET: Engine Specs, Horsepower &
    // Reliability") and drifted.com ("15 SR20DET Specs..."); later ECU
    // revisions lowered this to 7250, then 7100 rpm.
    config: {
      boreMm: 86.0,
      strokeMm: 86.0,
      rodLengthMm: 136.25,
      compressionRatio: 8.5,
      redlineRpm: 7500,
    },
  },
  {
    id: "skyline-gtr-rb26dett",
    name: "Nissan Skyline GT-R (R32-R34)",
    brand: "Nissan",
    engineCode: "RB26DETT",
    layoutLabel: "2.6 L twin-turbo inline-6",
    // bore/stroke 86.0/73.7 mm, CR 8.5:1 — confirmed by drifted.com
    // ("RB26DETT - Nissan's Ultimate Engine?") and 8020automotive.com
    // ("Nissan RB26DETT Engine Guide").
    // rod 121.5 mm — stock-length replacement rods from Tomei
    // (kuremotorsport.com, listed "STD") and Boostline (ojperformance.com)
    // both give 121.50 mm center-to-center.
    // Redline 8000 rpm — the JDM "gentleman's agreement" figure, confirmed
    // by drifted.com and jdmbuysell.com's RB26DETT guide.
    config: {
      boreMm: 86.0,
      strokeMm: 73.7,
      rodLengthMm: 121.5,
      compressionRatio: 8.5,
      redlineRpm: 8000,
    },
  },
  {
    id: "gtr-r35-vr38dett",
    name: "Nissan GT-R (R35)",
    brand: "Nissan",
    engineCode: "VR38DETT",
    layoutLabel: "3.8 L twin-turbo V6",
    // bore/stroke 95.5/88.4 mm, CR 9.0:1 — confirmed by a MAHLE Motorsports
    // spec sheet (mahle.com) and Wikipedia ("Nissan VR engine").
    // rod 165.0 mm (6.500 in) — stock-length replacement rods from
    // CP-Carrillo (t1racedevelopment.com, realstreetperformance.com) and
    // Manley (manleyperformance.com) both give 165 mm / 6.500 in
    // center-to-center.
    // Redline 7100 rpm — confirmed by mywikimotors.com ("Nissan VR38DETT
    // Engine") and jspec-garage.com's R35 build guide; some sources round
    // this to 7000 rpm.
    config: {
      boreMm: 95.5,
      strokeMm: 88.4,
      rodLengthMm: 165.0,
      compressionRatio: 9.0,
      redlineRpm: 7100,
    },
  },
  {
    id: "240sx-ka24de",
    name: "Nissan 240SX (S13/S14)",
    brand: "Nissan",
    engineCode: "KA24DE",
    layoutLabel: "2.4 L inline-4",
    // Twin-cam KA24DE (1991+), not the earlier single-cam KA24E — this is
    // the naturally aspirated US-market engine that stood in for the
    // JDM-only turbo SR20DET Silvia preset above; swapping an SR20DET into
    // a KA24DE-powered 240SX ("KA-to-SR") is a long-running enthusiast
    // tradition precisely because the two cars are otherwise the same
    // S13/S14 chassis with different home-market engines.
    // bore/stroke 89.0/96.0 mm — confirmed by Wikipedia ("Nissan KA
    // engine") and a nissanclub.com forum thread ("KA24DE specs").
    // rod 165.0 mm (6.495 in) — stock-length replacement rods from Manley
    // (both I-Beam and H-Beam catalog listings, manleyperformance.com) and
    // Eagle (enjukuracing.com) both give 165 mm center-to-center.
    // CR 9.5:1 — the 1994-98 figure (covers all S14 production plus
    // late S13), confirmed by a nissanclub.com forum thread ("KA24DE
    // compression ratios?") and a ka-t.org forum thread citing the factory
    // service manual (page EM-43); the earlier 1991-93 S13 KA24DE ran a
    // lower 9.0:1.
    // Redline 6900 rpm — confirmed by drifted.com ("KA24DE - The Ultimate
    // Motor Guide") and 180sx.club ("Nissan KA24DE – Complete Engine
    // Guide"); its single-cam KA24E predecessor was limited to 6500 rpm.
    config: {
      boreMm: 89.0,
      strokeMm: 96.0,
      rodLengthMm: 165.0,
      compressionRatio: 9.5,
      redlineRpm: 6900,
    },
  },
  {
    id: "bmw-e46-m3-s54",
    name: "BMW M3 (E46)",
    brand: "BMW",
    engineCode: "S54",
    layoutLabel: "3.2 L inline-6",
    // bore/stroke 87.0/91.0 mm, CR 11.5:1, redline 8000 rpm — all three
    // confirmed by a MAHLE Motorsports spec sheet (us.mahle.com) and
    // bmwtuning.co's S54 engine guide.
    // rod 139.0 mm — this is the S54-specific rod length (longer than the
    // 135 mm used by the related, lower-output M52/M54 family), confirmed
    // by three independent stock-length-replacement catalogs: Boostline
    // (boostlineproducts.com), ZRP (zrp-rods.com), and FCP Engineering
    // (fcp-engineering.com), all listing "S54B32 ... 139mm".
    config: {
      boreMm: 87.0,
      strokeMm: 91.0,
      rodLengthMm: 139.0,
      compressionRatio: 11.5,
      redlineRpm: 8000,
    },
  },
];
