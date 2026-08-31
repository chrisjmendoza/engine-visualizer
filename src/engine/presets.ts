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
 * `output`, where present, is factory-rated power and torque for the WHOLE
 * engine (all cylinders) — unlike every other field here, which is
 * per-cylinder geometry. It therefore lives on `EnginePreset` rather than
 * on `CrankMechanismConfig`: a hand-typed custom configuration has no
 * associated power figure, and the UI shows "—" in that case. Every
 * `output` value describes the SAME market/variant already documented in
 * that preset's `config` comment (e.g. the US/EU F20C, not the higher-output
 * JDM one) and is corroborated by at least two independent sources, same as
 * the rest of this file. Where a source reports PS or kW, the comment notes
 * the original figure and the conversion used (1 PS = 0.9863 hp; 1 kW =
 * 1.341 hp; 1 Nm = 0.7376 lb-ft). Presets whose output could not clear the
 * two-source bar for the documented variant simply omit `output`.
 *
 * This module is pure data: no React, Three.js, or browser imports.
 */

import type { CrankMechanismConfig } from "./types";
import type { EngineLayoutId } from "./engineLayout";

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
  /**
   * The engine's real layout (§24a). Every preset here declares one — the
   * roster covers V and flat engines. It stays optional only so a future
   * preset whose layout this module cannot yet express (a W12, a rotary) can
   * omit it and fall back to `DEFAULT_LAYOUT_ID`. Wherever a preset is
   * applied, this value (or that default when absent) is what
   * `setLayoutId`/`setComparisonLayoutId` is called with, so picking a real
   * engine shows its real architecture. How much of it is drawn is a separate
   * preference (`singleCylinderView`) that a preset never touches.
   *
   * Where the layout is not obvious from `layoutLabel` — which V8 crank, how
   * a V6 achieves even firing — the reason is noted with that preset's
   * sourcing comments.
   */
  layoutId?: EngineLayoutId;
  /** Per-cylinder stock geometry. */
  config: CrankMechanismConfig;
  /**
   * Factory-rated output for the whole engine (all cylinders), for the same
   * market/variant documented in `config`'s comment. Optional: omitted
   * where a verifiable, two-source figure for that exact variant could not
   * be found.
   */
  output?: {
    /** SAE net (or manufacturer-equivalent) horsepower. */
    powerHp: number;
    /** Engine speed at which peak power occurs. */
    powerRpm: number;
    /** Peak torque, in pound-feet. */
    torqueLbFt: number;
    /** Engine speed at which peak torque occurs. */
    torqueRpm: number;
  };
}

export const ENGINE_PRESETS: readonly EnginePreset[] = [
  {
    id: "s2000-ap1",
    name: "Honda S2000 (AP1)",
    brand: "Honda",
    engineCode: "F20C",
    layoutLabel: "2.0 L inline-4",
    layoutId: "inline-4",
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
    // Output 240 hp @ 8300 rpm, 153 lb-ft @ 7500 rpm — the US SAE-net figure
    // (matching the 11.0:1 CR above and the 153 lb-ft torque figure), which
    // Honda quoted unchanged for the entire 1999-2003 AP1 run; it was never
    // re-rated (that only happened to the AP2/F22C1 after the industry-wide
    // 2005 SAE-certification change, which post-dates AP1 production).
    // Confirmed by jdmbuysell.com's AP1 buyer's guide (explicitly notes the
    // rating "remained unchanged throughout the entire AP1 production
    // cycle... never re-rated") and automobile-catalog.com's North America
    // spec pages (179 kW / 243 PS / 240 hp). Europe quotes this same tune
    // in PS rather than hp — 240 PS, which converts to ~237 hp (240 x
    // 0.9863) — a different unit convention for essentially the same
    // engine, not a separate lower-power model; that PS-derived ~237 hp is
    // the source of an earlier, incorrect 234 hp figure here (234 hp was
    // itself a rounding of 237 PS, mismatched against the US-hp torque
    // figure it was paired with). The JDM F20C, with its higher 11.7:1 CR,
    // makes 247 hp instead.
    output: { powerHp: 240, powerRpm: 8300, torqueLbFt: 153, torqueRpm: 7500 },
  },
  {
    id: "s2000-ap2",
    name: "Honda S2000 (AP2)",
    brand: "Honda",
    engineCode: "F22C1",
    layoutLabel: "2.2 L inline-4",
    layoutId: "inline-4",
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
    // Output 240 hp @ 7800 rpm, 162 lb-ft @ 6500 rpm — US spec, confirmed by
    // Wikipedia ("Honda F20C engine") and hotcars.com ("1999-2009 Honda
    // S2000 AP1-AP2: Costs, Facts, And Figures").
    output: { powerHp: 240, powerRpm: 7800, torqueLbFt: 162, torqueRpm: 6500 },
  },
  {
    id: "miata-na-nb-1-8",
    name: "Mazda MX-5 Miata (NA/NB)",
    brand: "Mazda",
    engineCode: "BP",
    layoutLabel: "1.8 L inline-4",
    layoutId: "inline-4",
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
    // Output 133 hp @ 6500 rpm, 114 lb-ft @ 5500 rpm — the 1996(late)-1997
    // NA8 figure, matching the "NA/NB" preset's most-cited NA8 CR above;
    // the earlier 1994-mid96 NA8 made less (128 hp / 110 lb-ft @ 5000 rpm).
    // Confirmed by kbb.com (1997 spec) and hotcars.com ("1990-1997 Mazda
    // MX-5 Miata: Costs, Facts, And Figures"); torque rpm cross-checked
    // against conceptcarz.com's 1996 spec page.
    output: { powerHp: 133, powerRpm: 6500, torqueLbFt: 114, torqueRpm: 5500 },
  },
  {
    id: "miata-na-1-6",
    name: "Mazda MX-5 Miata (NA, 1.6)",
    brand: "Mazda",
    engineCode: "B6",
    layoutLabel: "1.6 L inline-4",
    layoutId: "inline-4",
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
    // Output 116 hp @ 6500 rpm, 100 lb-ft @ 5500 rpm — confirmed by
    // automobile-catalog.com (1990 US-spec review) and enginetechspecs.com
    // ("Mazda B6ZE Engine").
    output: { powerHp: 116, powerRpm: 6500, torqueLbFt: 100, torqueRpm: 5500 },
  },
  {
    id: "corvette-c6-ls3",
    name: "Chevrolet Corvette (C6)",
    brand: "Chevrolet",
    engineCode: "LS3",
    layoutLabel: "6.2 L V8",
    // Layout: 90° V8 on a cross-plane crank (§24a's `v8-cross`) — four
    // crankpins at 90°, two cylinders per pin, firing order 1-8-7-2-6-5-4-3.
    // That is the GM small-block architecture the LS family inherits, and the
    // source of the American V8 burble.
    layoutId: "v8-cross",
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
    // Output 430 hp @ 5900 rpm, 424 lb-ft @ 4600 rpm — the base LS3 crate
    // engine figure (the Corvette's optional dual-mode exhaust raises this
    // to 436 hp / 428 lb-ft, not used here). Confirmed by Chevrolet
    // Performance's own crate-engine listings (tpsmotorsports.com,
    // ictbillet.com) and enginetechspecs.com.
    output: { powerHp: 430, powerRpm: 5900, torqueLbFt: 424, torqueRpm: 4600 },
  },
  {
    id: "corvette-z06-c6-ls7",
    name: "Chevrolet Corvette Z06 (C6)",
    brand: "Chevrolet",
    engineCode: "LS7",
    layoutLabel: "7.0 L V8",
    // Layout: the same 90° cross-plane V8 crank as the LS3 above (§24a's
    // `v8-cross`); the LS7 differs in displacement and internals, not in
    // crank architecture.
    layoutId: "v8-cross",
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
    // Output 505 hp @ 6300 rpm, 470 lb-ft @ 4800 rpm — the SAE-certified
    // figure GM published for the LS7. Confirmed by GM Authority
    // ("Chevrolet Corvette Z06 Info, Specs, Pictures, Wiki & More") and
    // vette-vues.com ("The Corvette LS7 Engine").
    output: { powerHp: 505, powerRpm: 6300, torqueLbFt: 470, torqueRpm: 4800 },
  },
  {
    id: "supra-2jzgte",
    name: "Toyota Supra",
    brand: "Toyota",
    engineCode: "2JZ-GTE",
    layoutLabel: "3.0 L inline-6",
    layoutId: "inline-6",
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
    // Output 320 hp @ 5600 rpm, 315 lb-ft @ 4000 rpm — the US 6-speed-manual
    // Supra Turbo figure (1993-97, matching this preset's US-documented
    // redline); Toyota famously underreported this. Confirmed by
    // conceptcarz.com ("1994 Toyota Supra Specifications & Dimensions") and
    // supercars.net ("1993 Toyota Supra Turbo"). The JDM gentleman's-
    // agreement figure is lower, at 276 hp (280 PS).
    output: { powerHp: 320, powerRpm: 5600, torqueLbFt: 315, torqueRpm: 4000 },
  },
  {
    id: "k20a-type-r",
    name: "Honda Civic / Integra Type R",
    brand: "Honda",
    engineCode: "K20A",
    layoutLabel: "2.0 L inline-4",
    layoutId: "inline-4",
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
    // Output 217 hp (220 PS) @ 8000 rpm, 152 lb-ft (206 Nm) @ 7000 rpm —
    // the JDM K20A DC5 Integra Type R figure, matching the CR/redline
    // above. Confirmed by jdmbuysell.com's K20A guide and
    // integradc5.com's DC5 Type R spec page. 220 PS converts to 217 hp
    // (220 x 0.9863); 206 Nm converts to 152 lb-ft (206 x 0.7376).
    output: { powerHp: 217, powerRpm: 8000, torqueLbFt: 152, torqueRpm: 7000 },
  },
  {
    id: "tsx-k24a2",
    name: "Acura TSX (K24A2)",
    brand: "Honda",
    engineCode: "K24A2",
    layoutLabel: "2.4 L inline-4",
    layoutId: "inline-4",
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
    // Output 200 hp @ 6800 rpm, 166 lb-ft @ 4500 rpm — the 2004-2005 TSX
    // figure (2006-2008's revised intake raised this to 205 hp @ 7000 rpm;
    // not used here since a single power/torque pair should match a single
    // model-year). Confirmed by Acura's own press specifications
    // (acuranews.com, "2005 Acura TSX Specifications") and
    // conceptcarz.com's 2004 TSX spec page.
    output: { powerHp: 200, powerRpm: 6800, torqueLbFt: 166, torqueRpm: 4500 },
  },
  {
    id: "miata-nd-2-0",
    name: "Mazda MX-5 Miata (ND)",
    brand: "Mazda",
    engineCode: "PE",
    layoutLabel: "2.0 L Skyactiv-G inline-4",
    layoutId: "inline-4",
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
    // Output 181 hp @ 7000 rpm, 151 lb-ft (205 Nm) @ 4000 rpm — the 2019+
    // US-spec figure matching the CR/redline above. Confirmed by Wikipedia
    // ("Mazda MX-5 (ND)") and automotivepowertraintechnologyinternational.com
    // ("Engines on test: 2019 Mazda MX-5 2.0-liter Skyactiv-G").
    output: { powerHp: 181, powerRpm: 7000, torqueLbFt: 151, torqueRpm: 4000 },
  },
  {
    id: "ferrari-458-italia",
    name: "Ferrari 458 Italia",
    brand: "Ferrari",
    engineCode: "F136 FB",
    layoutLabel: "4.5 L V8",
    // Layout: 90° V8 on a FLAT-plane crank (§24a's `v8-flat`) — all four
    // throws in one plane, like an inline-4's, which is what makes each bank
    // fire evenly every 180° and gives the 458 its wail. Still even-fire at
    // 90° overall, exactly like the cross-plane LS engines above; the crank
    // plane, not the firing interval, is the difference.
    layoutId: "v8-flat",
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
    // Output 562 hp @ 9000 rpm, 398 lb-ft (540 Nm) @ 6000 rpm — confirmed
    // by thetorquereport.com ("Ferrari 458 Italia Officially Unveiled")
    // and encycarpedia.com's 458 Italia spec page. Note the power peak
    // sits exactly AT the 9000 rpm redline, not below it — unusual among
    // this file's presets but consistent with how Ferrari itself quotes
    // the figure.
    output: { powerHp: 562, powerRpm: 9000, torqueLbFt: 398, torqueRpm: 6000 },
  },
  {
    id: "silvia-sr20det",
    name: "Nissan Silvia (S13/S14)",
    brand: "Nissan",
    engineCode: "SR20DET",
    layoutLabel: "2.0 L turbo inline-4",
    layoutId: "inline-4",
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
    // Output 201 hp @ 6000 rpm, 202 lb-ft @ 4000 rpm — the "Redtop" figure
    // matching this preset's CR/redline. Confirmed by drifted.com ("15
    // SR20DET Specs...") and multiple independent JDM-engine importers'
    // spec pages (jdmenginedirect.com, redlinejdm.com) quoting the same
    // Garrett T25G-equipped Redtop figures.
    output: { powerHp: 201, powerRpm: 6000, torqueLbFt: 202, torqueRpm: 4000 },
  },
  {
    id: "skyline-gtr-rb26dett",
    name: "Nissan Skyline GT-R (R32-R34)",
    brand: "Nissan",
    engineCode: "RB26DETT",
    layoutLabel: "2.6 L twin-turbo inline-6",
    layoutId: "inline-6",
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
    // Output 276 hp @ 6800 rpm, 260 lb-ft @ 4400 rpm — the JDM
    // "gentleman's agreement" figure matching the redline comment above
    // (widely believed understated; actual output was higher). Confirmed
    // by autoevolution.com ("Nissan RB26DETT: The Skyline GT-R's Legendary
    // Turbocharged Inline-Six") and axleaddict.com ("RB26 Engine: Specs,
    // History & Nissan Skyline GT-R Legacy").
    output: { powerHp: 276, powerRpm: 6800, torqueLbFt: 260, torqueRpm: 4400 },
  },
  {
    id: "gtr-r35-vr38dett",
    name: "Nissan GT-R (R35)",
    brand: "Nissan",
    engineCode: "VR38DETT",
    layoutLabel: "3.8 L twin-turbo V6",
    // Layout: 60° V6 (§24a's `v6-60`). Even-fire at 120° requires the pair's
    // crankpins offset a further 60° apart from the bank angle — too little
    // pin overlap for a true split pin, so any even-fire 60° V6 needs
    // separate crankpins joined by a flying arm, not a split journal.
    layoutId: "v6-60",
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
    // Output 480 hp @ 6400 rpm, 434 lb-ft @ 3200 rpm — the 2009 launch-year
    // figure (later model years raised output considerably; not used
    // here). Torque is a plateau from 3200-5200 rpm; 3200 rpm (the onset)
    // is recorded as torqueRpm. Confirmed by autoblog.com ("Nissan GT-R
    // R35 (2009-2024) collectible buyer's guide") and
    // automobile-catalog.com's 2009 Nissan GT-R spec review.
    output: { powerHp: 480, powerRpm: 6400, torqueLbFt: 434, torqueRpm: 3200 },
  },
  {
    id: "240sx-ka24de",
    name: "Nissan 240SX (S13/S14)",
    brand: "Nissan",
    engineCode: "KA24DE",
    layoutLabel: "2.4 L inline-4",
    layoutId: "inline-4",
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
    // Output 155 hp @ 5600 rpm, 160 lb-ft @ 4400 rpm — consistent across
    // 1994-98 (matching the CR variant above); confirmed by Wikibooks
    // ("Nissan 240SX Performance Modification/KA24DE and KA24E") and
    // drifted.com ("KA24DE - The Ultimate Motor Guide").
    output: { powerHp: 155, powerRpm: 5600, torqueLbFt: 160, torqueRpm: 4400 },
  },
  {
    id: "bmw-e46-m3-s54",
    name: "BMW M3 (E46)",
    brand: "BMW",
    engineCode: "S54",
    layoutLabel: "3.2 L inline-6",
    layoutId: "inline-6",
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
    // Output 333 hp @ 7900 rpm, 262 lb-ft (355 Nm) @ 4900 rpm — US SAE-net
    // spec (US-market cars ran extra catalytic converters that trimmed
    // output versus Europe's 343 PS/338 hp DIN rating). Confirmed by
    // bmwtuning.co's S54 engine guide and an e46fanatics.com forum thread
    // ("Euro M3 vs US M3"). Power peak (7900 rpm) sits only 100 rpm below
    // the 8000 rpm redline — a tight margin worth flagging, but not an
    // ordering violation.
    output: { powerHp: 333, powerRpm: 7900, torqueLbFt: 262, torqueRpm: 4900 },
  },
  {
    id: "wrx-sti-ej257",
    name: "Subaru Impreza WRX STI (GD)",
    brand: "Subaru",
    engineCode: "EJ257",
    layoutLabel: "2.5 L turbo flat-4",
    // Layout: horizontally-opposed boxer (§24a's `flat-4`), firing order
    // 1-3-2-4. A boxer gives each cylinder its own crankpin, an opposed
    // pair's pins 180° apart — which is what makes the opposed pistons move
    // outward together, and what distinguishes it from a 180° V.
    layoutId: "flat-4",
    // 2004-2006 USDM STI. The most undersquare engine in this roster after
    // the KA24DE: a 99.5 mm bore on a 79 mm stroke.
    // rod 130.5 mm — the shared EJ20/EJ25 short-deck rod, listed as 5.137 in
    // (130.48 mm) by Manley Performance (manleyperformance.com) and as
    // 130.50 mm by FCP Engineering (fcp-engineering.com); Eagle and Carrillo
    // publish the same length for the family.
    // CR 8.2:1 — the low compression that makes room for boost. Confirmed by
    // Wikipedia ("Subaru EJ engine") and cars101.com's 2004 WRX/STI spec
    // page. European STI variants ran ~8.71:1: a different market, not a
    // source conflict.
    // Redline 7000 rpm — autoevolution.com's 2005-2007 Impreza WRX STi spec
    // page and auto123.com's 2005 technical specifications; fuel cut lands
    // slightly later, around 7100-7200 rpm.
    config: {
      boreMm: 99.5,
      strokeMm: 79.0,
      rodLengthMm: 130.5,
      compressionRatio: 8.2,
      redlineRpm: 7000,
    },
    // Output 300 hp @ 6000 rpm, 300 lb-ft @ 4000 rpm — native SAE-net
    // figures for the 2004-2006 USDM car (no PS conversion involved).
    // Confirmed by automobile-catalog.com and cars101.com.
    output: { powerHp: 300, powerRpm: 6000, torqueLbFt: 300, torqueRpm: 4000 },
  },
  {
    id: "wrx-ej205",
    name: "Subaru Impreza WRX (GD)",
    brand: "Subaru",
    engineCode: "EJ205",
    layoutLabel: "2.0 L turbo flat-4",
    layoutId: "flat-4",
    // 2002-2005 USDM WRX — the non-STI car, and a direct bore/stroke
    // contrast with the EJ257 above on an identical 130.5 mm rod, so the
    // rod-to-stroke difference between the two is purely the crank.
    // rod 130.5 mm — the same shared EJ-family rod: Eagle's listing covers
    // "EJ205 EJ207 EJ255 EJ257" (via realstreetperformance.com) and FCP
    // Engineering (fcp-engineering.com) gives 130.50 mm with explicit EJ205
    // fitment.
    // CR 8.0:1 — cars101.com's 2002-2005 WRX spec pages, 8020automotive.com's
    // EJ205 guide, and OAKOS Automotive's 2002-2005 WRX piston listing all
    // tie 8.0:1 to this market and model-year range. Aggregate sources
    // quoting 9.0:1 (or a "8:1-9:1" range) describe other-market tunes.
    // Redline 7000 rpm — 8020automotive.com's EJ205 guide, corroborated by
    // cars101.com's spec pages.
    config: {
      boreMm: 92.0,
      strokeMm: 75.0,
      rodLengthMm: 130.5,
      compressionRatio: 8.0,
      redlineRpm: 7000,
    },
    // Output 227 hp @ 6000 rpm, 217 lb-ft @ 4000 rpm — native SAE-net
    // figures for the 2002-2005 USDM WRX. Confirmed by
    // automobile-catalog.com and auto123.com.
    output: { powerHp: 227, powerRpm: 6000, torqueLbFt: 217, torqueRpm: 4000 },
  },
  {
    id: "brz-fa20",
    name: "Subaru BRZ / Toyota 86",
    brand: "Subaru",
    engineCode: "FA20",
    layoutLabel: "2.0 L flat-4",
    layoutId: "flat-4",
    // 2013-2016 USDM BRZ. The same engine Toyota calls the 4U-GSE in the
    // FR-S/86, so one entry covers both cars. Naturally aspirated and
    // exactly square at 86 x 86 mm — the same bore and stroke as this app's
    // default configuration, but on a much shorter rod and far higher
    // compression, which makes it a useful demonstration that bore and
    // stroke alone do not determine how a mechanism moves.
    // rod 129.30 mm — K1 Technologies (k1technologies.com) and Manley
    // Performance (manleyperformance.com, 5.090 in = 129.29 mm).
    // CR 12.5:1 — unusually high for a naturally aspirated production
    // engine, enabled by its direct injection. Confirmed by Wikipedia
    // ("Subaru FA engine") and Crawford Performance
    // (crawfordperformance.com).
    // Redline 7400 rpm — Subaru's own 2013 BRZ press kit
    // (media.subaru.com) and xcceleration.com's FA20 spec page; fuel cut
    // follows at about 7450 rpm.
    config: {
      boreMm: 86.0,
      strokeMm: 86.0,
      rodLengthMm: 129.3,
      compressionRatio: 12.5,
      redlineRpm: 7400,
    },
    // Output 200 hp @ 7000 rpm, 151 lb-ft @ 6400 rpm — Subaru's own figure
    // for the 2013 USDM BRZ, from its press kit (media.subaru.com) and
    // xcceleration.com. Some references quote 197 hp instead; that is the
    // automatic-transmission car's rating, not the manual's, and the torque
    // figure is unchanged between them.
    output: { powerHp: 200, powerRpm: 7000, torqueLbFt: 151, torqueRpm: 6400 },
  },
];
