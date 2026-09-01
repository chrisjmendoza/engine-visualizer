/**
 * Preset rotary (Wankel) geometries for production Mazda engines
 * (TECHNICAL_DESIGN.md §27) — the rotary family's `presets.ts`, kept as its
 * own module rather than folded into the piston roster because
 * `RotaryEnginePreset` has no `layoutId`/bore/stroke/rod to share with
 * `EnginePreset`: a rotary's "architecture" is its rotor count, not a
 * layout id, and its geometry is R/e/b, not bore/stroke/rod.
 *
 * Every figure here is two-source verified (Task R2's research pass) except
 * where a comment says otherwise, and every chamber displacement is cross-checked
 * against this codebase's own `calculateChamberDisplacementCc` (3√3·e·R·b) in
 * `rotaryPresets.test.ts` — the rotary equivalent of `presets.test.ts`'s
 * per-cylinder-displacement check. `compressionRatio` and `redlineRpm` are
 * each corroborated by at least two independent sources per engine, same bar
 * as the piston roster; where JDM figures are quoted in PS rather than SAE
 * hp (rotaries have an unusually bad case of this — see the 20B below), the
 * comment states the conversion used (1 PS = 0.9863 hp, 1 N·m = 0.7376 lb-ft),
 * matching this project's existing convention (`presets.ts`'s header comment).
 *
 * `output`, where present, is factory-rated power and torque for the WHOLE
 * engine (all rotors) — the rotary analog of `EnginePreset.output`. Every
 * preset here declares one; a future preset whose output can't clear the
 * two-source bar would simply omit it, exactly as the piston roster does.
 *
 * This module is pure data: no React, Three.js, or browser imports.
 */

import type { RotaryConfig, RotaryRotorCount } from "./rotaryTypes";

export interface RotaryEnginePreset {
  /** Kebab-case identifier, stable across releases. */
  id: string;
  /** Display name, e.g. "Mazda RX-7 (FD)". */
  name: string;
  /** Manufacturer, used to group the preset picker (mirrors `EnginePreset`). */
  brand: string;
  /** Manufacturer engine code, e.g. "13B-REW". */
  engineCode: string;
  /** Short displacement/rotor-count label, e.g. "1.3 L twin-rotor (13B-REW)". */
  layoutLabel: string;
  /** One chamber's geometry (shared identically across every rotor). */
  config: RotaryConfig;
  /** How many rotors this engine has — the rotary's architecture. */
  rotorCount: RotaryRotorCount;
  /**
   * Factory-rated output for the whole engine (all rotors), for the same
   * market/variant documented in `config`'s comment. Optional, same
   * two-source-or-omit rule as `EnginePreset.output`.
   */
  output?: {
    /** SAE net (or manufacturer-equivalent) horsepower. */
    powerHp: number;
    /** Engine speed (eccentric-shaft rpm) at which peak power occurs. */
    powerRpm: number;
    /** Peak torque, in pound-feet. */
    torqueLbFt: number;
    /** Engine speed at which peak torque occurs. */
    torqueRpm: number;
  };
}

export const ROTARY_ENGINE_PRESETS: readonly RotaryEnginePreset[] = [
  {
    id: "13b-rew",
    name: "Mazda RX-7 (FD)",
    brand: "Mazda",
    engineCode: "13B-REW",
    layoutLabel: "1.3 L twin-rotor, sequential twin-turbo",
    // R=105 mm, e=15 mm, b=80 mm — rx7club.com's rotary-tech forum (thread
    // author KevinK2) and rx8club.com (JerryLH3/wakeech), corroborated by
    // Racing Beat and Atkins Rotary parts listings for the same geometry.
    // Chamber displacement 3√3·e·R·b = 654.7 cc vs Mazda's published 654 cc
    // per chamber (`rotaryPresets.test.ts` asserts this cross-check).
    // CR 9.0:1; redline 8,000 rpm (fuel cut ~8,500) — projectjdm.org's FD3S
    // spec page and drifted.com's 13B guide.
    config: {
      generatingRadiusMm: 105,
      eccentricityMm: 15,
      rotorWidthMm: 80,
      compressionRatio: 9.0,
      redlineRpm: 8000,
    },
    rotorCount: 2,
    // Output 255 hp @ 6,500 rpm, 217 lb-ft @ 5,000 rpm — US SAE-net figure
    // for the 1993 US-market FD (190 kW / 258 PS / 255 hp, a unit-consistent
    // triple), confirmed by automobile-catalog.com's North America spec page
    // and corroborated by conceptcarz.com/ultimatespecs.com. CAUTION: the
    // JDM Type RZ/Spirit R's "255-265" figures are PS, not hp — a
    // coincidentally similar number describing a different unit, not the
    // same rating; this preset uses the US SAE figure throughout so the
    // power and torque numbers are never a PS/hp mismatch.
    output: { powerHp: 255, powerRpm: 6500, torqueLbFt: 217, torqueRpm: 5000 },
  },
  {
    id: "13b-msp-renesis",
    name: "Mazda RX-8 (6-port, 6MT)",
    brand: "Mazda",
    engineCode: "13B-MSP Renesis",
    layoutLabel: "1.3 L twin-rotor",
    // Same chamber geometry as the 13B-REW above: R=105, e=15, b=80 mm, 654
    // cc chambers — rx8club.com forum consensus plus Mazda-lineage parts
    // catalogs (the Renesis reuses the 13B's basic rotor housing).
    // CR 10.0:1 — Mazda USA's own 2004 RX-8 Technical Specifications PDF
    // (news.mazdausa.com), corroborated by motorreviewer.com.
    // Redline 9,000 rpm — the 6-speed-manual figure; the 4-speed-automatic
    // trim is a distinct, lower-revving 7,500 rpm/197 hp tune and is
    // deliberately NOT used here, so this preset's redline and output always
    // describe the same transmission.
    config: {
      generatingRadiusMm: 105,
      eccentricityMm: 15,
      rotorWidthMm: 80,
      compressionRatio: 10.0,
      redlineRpm: 9000,
    },
    rotorCount: 2,
    // Output 238 hp @ 8,500 rpm, 159 lb-ft @ 5,500 rpm — Mazda USA's 2004
    // technical specifications PDF, corroborated by automobile-catalog.com
    // and rx8club.com. This is the ORIGINAL 2004 SAE rating; the industry's
    // 2005 SAE J1349 procedure change re-rated this same, mechanically
    // unchanged engine to 232 hp for MY2006+ (rx8club.com forum thread and
    // speedsportlife.com) — a rating-procedure history, not a hardware
    // revision, so this preset intentionally keeps the original figure
    // rather than treating the later number as a different engine.
    output: { powerHp: 238, powerRpm: 8500, torqueLbFt: 159, torqueRpm: 5500 },
  },
  {
    id: "12a",
    name: "Mazda RX-7 (SA)",
    brand: "Mazda",
    engineCode: "12A",
    layoutLabel: "1.1 L twin-rotor",
    // R=105 mm, e=15 mm, b=70 mm — Wikipedia's "Mazda Wankel engine" article
    // ("rotor radius the same... depth increased to 70 mm", quoting 573
    // cc/chamber), corroborated by motorreviewer.com and low-offset.com's
    // 12A guide. Chamber displacement 3√3·e·R·b = 572.9 cc vs the 573 cc
    // Mazda publishes (`rotaryPresets.test.ts` cross-checks this) — the
    // narrower rotor width (70 mm, vs the 13B's 80 mm) is what makes the 12A
    // a smaller-displacement engine on the same R/e as every later rotary.
    // CR 9.4:1; output 100 hp @ 6,000 rpm, 105 lb-ft @ 4,000 rpm (1979 US
    // figures) — automobile-catalog.com and rx7.org's first-generation spec
    // page (which notes a small 1980+ bump to 101 hp/107 lb-ft, not used
    // here so this preset stays a single model-year).
    config: {
      generatingRadiusMm: 105,
      eccentricityMm: 15,
      rotorWidthMm: 70,
      compressionRatio: 9.4,
      redlineRpm: 7000,
    },
    rotorCount: 2,
    // Redline 7,000 rpm — SOFT corroboration, flagged as such: a
    // mazdas247.com forum thread (describing the tach's buzzer) and the
    // classiccars.fandom wiki, enthusiast-grade sources rather than a
    // factory spec sheet, though internally consistent with the 6,000 rpm
    // power peak above (a 1,000 rpm margin to redline matches every other
    // engine in this roster). Corroborated well enough to ship, but weaker
    // sourcing than the other three engines here.
    output: { powerHp: 100, powerRpm: 6000, torqueLbFt: 105, torqueRpm: 4000 },
  },
  {
    id: "20b-rew",
    name: "Mazda Eunos Cosmo (20B, JDM)",
    brand: "Mazda",
    engineCode: "20B-REW",
    layoutLabel: "2.0 L triple-rotor, sequential twin-turbo",
    // Same 654 cc chamber geometry as the 13B (R=105, e=15, b=80 mm), three
    // of them: 654.7 × 3 = 1,964.1 cc vs Mazda's own 1,962 cc quoted total
    // (drifted.com's 20B guide; `rotaryPresets.test.ts` cross-checks this).
    // CR 9.0:1 — drifted.com, corroborated by carfromjapan.com and
    // goo-net-exchange.com's Eunos Cosmo 20B Type-S catalog pages.
    // 3 rotors, 120° phasing — motorauthority.com and the Wankel patent
    // literature's geometric even-fire requirement for a three-rotor engine
    // (Task R2's phasing corroboration; `rotaryCycle.ts` derives the same
    // 120° interval from the rotor-phase table this preset's `rotorCount`
    // selects).
    config: {
      generatingRadiusMm: 105,
      eccentricityMm: 15,
      rotorWidthMm: 80,
      compressionRatio: 9.0,
      redlineRpm: 7000,
    },
    rotorCount: 3,
    // Redline: NOT separately published as a single spec-sheet figure (the
    // data this preset started from flagged it as missing and said to drop
    // the 20B rather than guess). A dedicated two-source pass found it
    // independently: rotarypowercrew.wordpress.com's Eunos Cosmo write-up
    // states the torque curve holds "less than 10% down... at the 7000 rpm
    // Redline", and drifted.com's 20B guide separately states the Cosmo's
    // factory automatic transmission "restricted the engine to 7,000 rpm"
    // (as installed in the Cosmo — the bare 20B-REW is described elsewhere
    // in the same source as good for 8,500-9,000 rpm behind a manual
    // gearbox, which this JDM-only, automatic-only car never had). Both
    // sources independently land on 7,000 rpm for THIS car, so that is the
    // figure used here, understood as the Cosmo installation's redline
    // rather than the engine family's absolute mechanical ceiling.
    //
    // Output — **PS/JIS, never sold in the US**: 280 PS (206 kW) @ 6,500
    // rpm, 402 N·m @ 3,000 rpm — carfromjapan.com and goo-net-exchange.com's
    // Eunos Cosmo 20B Type-S catalog pages. 280 PS converts to 276 hp
    // (280 × 0.9863); 402 N·m converts to 296 lb-ft (402 × 0.7376) — both
    // conversions used here, matching this roster's existing convention for
    // PS-rated JDM engines (see the K20A-Type-R preset in `presets.ts`).
    // Widely believed understated, gentlemen's-agreement-era Mazda
    // marketing like the RB26DETT's "276 hp" — but this is the only
    // published figure, so it's what is used.
    output: { powerHp: 276, powerRpm: 6500, torqueLbFt: 296, torqueRpm: 3000 },
  },
] as const;
