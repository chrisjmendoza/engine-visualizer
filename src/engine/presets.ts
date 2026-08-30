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
 * Sources are noted per engine below.
 *
 * This module is pure data: no React, Three.js, or browser imports.
 */

import type { CrankMechanismConfig } from "./types";

export interface EnginePreset {
  /** Kebab-case identifier, stable across releases. */
  id: string;
  /** Display name, e.g. "Honda S2000 (AP1)". */
  name: string;
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
    engineCode: "F20C",
    layoutLabel: "2.0 L inline-4",
    // rod 153.0 mm — corroborated by Wiseco piston specs (cartel-aus.com),
    // FCP Engineering (fcp-engineering.com), and ZRP (zrp-rods.com).
    // CR 11.0:1 — US/European-spec F20C, confirmed by Wikipedia ("Honda
    // F20C engine") and jdmbuysell.com; the JDM F20C is higher, at 11.7:1.
    config: {
      boreMm: 87.0,
      strokeMm: 84.0,
      rodLengthMm: 153.0,
      compressionRatio: 11.0,
    },
  },
  {
    id: "s2000-ap2",
    name: "Honda S2000 (AP2)",
    engineCode: "F22C1",
    layoutLabel: "2.2 L inline-4",
    // rod 149.7 mm — CP Pistons spec sheet (realstreetperformance.com) and
    // Eagle/Brian Crower part numbers denoting 5.893 in (drifthq.com,
    // briancrower.com) both give 149.68 mm center-to-center.
    // CR 11.1:1 — same figure for both NA and JDM F22C1, confirmed by
    // Wikipedia ("Honda F20C engine") and S2KI forum consensus
    // (s2ki.com "Compression numbers for F22C").
    config: {
      boreMm: 87.0,
      strokeMm: 90.7,
      rodLengthMm: 149.7,
      compressionRatio: 11.1,
    },
  },
  {
    id: "miata-na-nb-1-8",
    name: "Mazda MX-5 Miata (NA/NB)",
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
    config: {
      boreMm: 83.0,
      strokeMm: 85.0,
      rodLengthMm: 132.9,
      compressionRatio: 9.0,
    },
  },
  {
    id: "miata-na-1-6",
    name: "Mazda MX-5 Miata (NA, 1.6)",
    engineCode: "B6",
    layoutLabel: "1.6 L inline-4",
    // rod 132.9 mm (5.233 in) — same Manley/Eagle B6/BP catalog entry as the
    // BP above, corroborated by Wiseco's B6 turbo piston spec
    // (cartel-aus.com), which lists a 133 mm (5.234 in) rod.
    // CR 9.4:1 — 5-speed-manual B6ZE figure (the automatic-transmission
    // version used a lower 9.0:1 piston), confirmed by enginetechspecs.com
    // ("Mazda B6ZE Engine") and mx5world.com ("Miatapower List Archive:
    // Compression ratio of 1.6").
    config: {
      boreMm: 78.0,
      strokeMm: 83.6,
      rodLengthMm: 132.9,
      compressionRatio: 9.4,
    },
  },
  {
    id: "corvette-c6-ls3",
    name: "Chevrolet Corvette (C6)",
    engineCode: "LS3",
    layoutLabel: "6.2 L V8",
    // rod 154.9 mm (6.098 in) — GM Performance part 12649190 spec, listed
    // consistently across JEGS (jegs.com) and K1 Technologies
    // (k1technologies.com).
    // CR 10.7:1 — confirmed by Chevrolet's own LS3 crate-engine page
    // (chevrolet.com) and lsdepotottawa.com's LS3 spec sheet.
    config: {
      boreMm: 103.25,
      strokeMm: 92.0,
      rodLengthMm: 154.9,
      compressionRatio: 10.7,
    },
  },
  {
    id: "corvette-z06-c6-ls7",
    name: "Chevrolet Corvette Z06 (C6)",
    engineCode: "LS7",
    layoutLabel: "7.0 L V8",
    // rod 154.1 mm (6.067 in) stock titanium rod — Wiseco piston spec
    // listing "6.067 Rod" for LS7 stock rods (briantooleyracing.com),
    // corroborated by LS-engine community references to GM's 6.067 in
    // titanium rod (LS1TECH, Yellow Bullet Forums).
    // CR 11.0:1 — confirmed by GM Authority (gmauthority.com) and
    // CorvetteForum's LS7 engine writeup (corvetteforum.com); some sources
    // round this to 11.1:1, but 11.0:1 is the figure GM itself publishes.
    config: {
      boreMm: 104.8,
      strokeMm: 101.6,
      rodLengthMm: 154.1,
      compressionRatio: 11.0,
    },
  },
  {
    id: "supra-2jzgte",
    name: "Toyota Supra",
    engineCode: "2JZ-GTE",
    layoutLabel: "3.0 L inline-6",
    // rod 142.0 mm — Tomei Powered (products.tomeiusa.com), CXRacing, and
    // Boostline (boostlineproducts.com) all list 142.00 mm as the
    // OEM-length replacement rod for 2JZ-GE/GTE.
    // CR 8.5:1 — the turbo GTE's recessed-crown pistons give this figure
    // for both US and JDM markets, confirmed by speedwaymotors.com and
    // 8020automotive.com's 2JZ-GTE guide.
    config: {
      boreMm: 86.0,
      strokeMm: 86.0,
      rodLengthMm: 142.0,
      compressionRatio: 8.5,
    },
  },
  {
    id: "k20a-type-r",
    name: "Honda Civic / Integra Type R",
    engineCode: "K20A",
    layoutLabel: "2.0 L inline-4",
    // rod 139.0 mm — K1 Technologies, Manley, and Eagle each catalog
    // 139 mm stock-length H-beam rods for K20A/K20A2.
    // CR 11.5:1 — JDM K20A figure, as used in the DC5 Integra Type R and
    // EP3 Civic Type R this preset represents; confirmed by Wikipedia
    // ("Honda Integra (fourth generation)") and autoevolution.com. The
    // USDM K20A2 (RSX Type-S) is lower, at 11.0:1.
    config: {
      boreMm: 86.0,
      strokeMm: 86.0,
      rodLengthMm: 139.0,
      compressionRatio: 11.5,
    },
  },
  {
    id: "miata-nd-2-0",
    name: "Mazda MX-5 Miata (ND)",
    engineCode: "PE",
    layoutLabel: "2.0 L Skyactiv-G inline-4",
    // rod 154.8 mm — consistently published stock-length replacement-rod
    // dimension across Maxpeedingrods (maxpeedingrods.co.uk) and Clegg
    // Engine (cleggengine.com).
    // CR 13.0:1 — US-spec PE-VPS figure, confirmed by motor1.com and
    // australiancar.reviews; premium-fuel markets (e.g. Europe) run a
    // higher 14.0:1 on the same engine, per Wikipedia ("Mazda MX-5 (ND)").
    config: {
      boreMm: 83.5,
      strokeMm: 91.2,
      rodLengthMm: 154.8,
      compressionRatio: 13.0,
    },
  },
];
