# Changelog

All notable changes to **Engine Visualizer** will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/) and follows [Semantic Versioning](https://semver.org/).

---

## 2026-09-01

### fix: the RX-7 FD and RX-8 no longer select together

- The rotary preset picker matched on chamber geometry and rotor count alone — three fields the 13B-REW and the Renesis share exactly, because Mazda reused the same 105/15/80 trochoid across decades. Selecting either pressed both buttons. The results panel's output lookup already compared the full configuration; the picker now does too, so compression ratio and redline — the fields that actually distinguish the two engines — are part of "is this preset selected".
- The component also gained the test file it should have had: exactly one pressed button for every selection in the roster, and a preset unpresses once any distinguishing field is edited away. Full suite: 1,515 tests.

### feat: resizable side panel

- The panel between the viewport and the controls now has a **drag handle** in the two-column layout: drag to taste, arrow keys to step (Shift for larger steps, Home/End to the limits), Enter or double-click to reset. It follows the ARIA window-splitter pattern, so it is the app's first resizer and not its first inaccessible control.
- Dragging drives a CSS variable directly and commits to React state only on release, so a drag never re-renders the shell or the scene at pointer-move rate; the 3D viewport reflows through the canvas's own ResizeObserver and the camera refits automatically — verified against React Three Fiber's actual internals rather than assumed.
- The width is **session-local** and resets on reload, like every preference in the app; persisting it would be the app's first use of localStorage and is left as a deliberate follow-up.
- Two boundaries: comparison mode keeps its own panel split (the handle hides there rather than visibly dragging without effect), and the old auto-widen at very wide windows is gone — the drag replaces it, at any window size. Full suite: 1,511 tests.

### feat: rotary engines

- **The Wankel rotary joins as a second engine family** — four presets, all two-source verified: the RX-7 FD's 13B-REW, the RX-8's Renesis, the first-generation RX-7's 12A, and the Eunos Cosmo's three-rotor 20B-REW. The triangular rotor orbits inside its peritrochoid housing at one third of shaft speed, with the apexes riding the housing exactly — the apex-on-housing identity is proved in a comment and asserted numerically to 1e-12, the rotary's equivalent of the slider-crank's loop closure.
- **Firing and exhaust light up per face**, reusing the piston tint machinery: each of a rotor's three faces is a chamber firing once per shaft revolution, so a two-rotor fires every 180° and the three-rotor Cosmo every 120° — the tint makes visible how much more often a rotary fires than a four-cylinder at the same revs.
- Chamber displacement uses the exact closed form Vd = 3√3·e·R·b, checked against Mazda's published figures (654 cc for the 13B geometry, 573 cc for the 12A — both match to under 0.2%). Engine displacement is quoted by the industry convention, Vd × rotor count, stated as the convention it is. The K-factor R/e appears as the rotary's rod-ratio analog.
- Validation gained the rotary's version of the rod-clears-crank rule: **R > 3e**, below which the housing genuinely self-intersects — the trochoid cusps at exactly R = 3e, a constraint the spec had missed and an agent proved before shipping.
- Cross-family comparison works: an RX-7 against an S2000 shows the shared rows (compression, redline, displacement, verified peaks) and "—" where a metric belongs to one family only, and a rotary stacks against a piston engine at one shared zoom.
- Data notes in the roster's tradition: the RX-8 preset uses the original 238 hp 2004 SAE rating with the 2005 re-rating history explained in its comment; the JDM-only Cosmo's 280 PS is flagged as a PS figure, never silently converted; and since the Renesis differs from the 13B-REW only by porting — Mazda reused the same trochoid for decades — rotary preset matching compares all five config fields. Full suite: 1,500 tests.

## 2026-08-31

### feat: compression ratio in the results

- **Compression ratio** now appears as a row in both the comparison table and the single-engine panel, where it was previously only visible as an input field — so two engines' compression could not be read side by side.
- Placed directly above **Clearance volume**, so the three rows read as one group: the ratio, the clearance volume it implies, and the clearance height it leaves at top dead center. Grouping it with the other dimensionless ratios would have separated it from the two rows derived from it.
- The comparison it makes obvious: the boosted engines run markedly lower compression to leave room for boost — the EJ257 at 8.2:1 and the 2JZ-GTE at 8.5:1 against the ND Miata's 13.0:1 — so a WRX beside a BRZ inverts the usual expectation, the smaller and less powerful engine carrying by far the higher ratio. Full suite: 1,194 tests.

### fix: cylinder displacement and engine displacement are separate metrics

- The displacement row showed "X cc/cyl · Y cc total" but computed its difference from the **per-cylinder** figure alone. Comparing a Golf GTI (496 cc/cyl, 1,984 cc) against an RB26 (428 cc/cyl, 2,569 cc) therefore reported a _negative_ difference beside totals that plainly showed engine B as the larger engine. The percentage was arithmetically right for cylinder size and described neither number the reader was looking at.
- They are two different quantities and now get two rows: **Cylinder displacement**, per-cylinder with a per-cylinder difference, and **Engine displacement** directly beneath it, whole-engine swept volume with its difference computed on the totals. On that pairing the cylinder row reads −13.7% and the engine row +29.4% — both true, each now attached to the quantity it describes.
- The old row's own doc comment had already conceded the cause: one row cannot carry two labels for two different quantities.
- Engine displacement is hidden only when _both_ engines show a single cylinder, where it would merely repeat the row above; it appears whenever either side is multi-cylinder, since one engine studied per-cylinder against a whole engine is exactly the comparison that went wrong. Full suite: 1,190 tests.

### fix: stacked rows centered on their crank span; crank-direction arrow removed

- **Each stacked row is now centered on the midpoint between its first and last crank centers.** Anchoring both rows at their first throw left the shorter engine short of the far edge, which read as lopsided. Centering is measured from crank centers rather than drawn bounds on purpose: bounds swell with bank tilt and with the upright-flat rotation, so a V's wide tilted throws would otherwise drag the row off-center relative to the crankshaft it's built on.
- On the GT-R pairing (RB26DETT inline-6 over VR38DETT V6) the inline-6's crank-span center moves from −53.1 mm to 0.0 with the framed union unchanged, so the balance costs no zoom. Worth noting the inline-6 is the _shorter_ row there — six narrow cylinder planes span less than three wide V6 throw planes, which is much of why the R35 uses a V6.
- This gives up the cylinder-1-over-cylinder-1 datum between the two rows, a deliberate trade for symmetry.
- **The crank-direction arrow is gone.** The mechanism's motion already makes rotation direction obvious, so the ring was decoration. Removing it also removed the finite-difference test that pinned its handedness against the kinematics — which was only ever guarding the arrow itself.
- Honest note on that removal: it was expected to tighten the camera slightly, since the arrow's reach fed into the framing bounds. Measured across every preset and the default configuration, framing is **byte-identical** — the arrow was never the binding term, always dominated by the TDC/BDC marker reach on X and the crank web on Y. It only bound at all on synthetic test geometries no real engine reaches. Full suite: 1,187 tests.

### fix: a stacked row is never re-spaced to suit the other engine

- Comparing an inline-6 against a V engine stretched the inline-6 badly: both rows were forced to one shared slot spacing, the wider of the two, and a V's throw plane is wide because it holds two tilted cylinders. Measured on an inline-6 against a cross-plane V8, the six cylinders were being driven at **3.01×** their natural pitch — far enough apart to stop reading as one crankcase.
- Each row now keeps its own spacing. The stage may move a row; it may not stretch one, and that is asserted directly: every stacked row is a pure translation of the same engine's lone row, across seven layout pairings and six geometries.
- **Both engines also get bigger.** The old rule widened the framed union to fit spacing only one engine wanted, so the shared zoom shrank both. On the same pairing the union falls from 3,091 mm to 2,166 mm — a 1.43× zoom gain on every mismatched comparison.
- Column alignment survives where it means something: two engines of the same layout _and_ the same dimensions still line up exactly. Two same-layout engines of different sizes now drift, which is deliberate — spacing scales with each engine's own size everywhere else in the scene, and forcing the smaller to the larger's pitch is the stretch this fixes.
- Known trade: with rows of unequal length anchored at their first crank center, the shorter row no longer fills the frame, leaving space at one end. The alternative is centering each row, which would cost the throw-0 datum — cylinder 1 against cylinder 1 being the one correspondence that survives across different architectures. Full suite: 1,215 tests.

### feat: cylinders light up in their real firing order

- **Red while firing, blue on the exhaust stroke**, per cylinder, under the existing "Four-stroke cycle" option. An inline-6 and a cross-plane V8 now visibly differ in something you could previously only read about: the firing sequence travelling down the engine, at that engine's real intervals.
- This is only possible because each layout carries a published firing order. A cylinder's stroke genuinely cannot be derived from its crank phase — crank phase is modulo 360° while the cycle is 720°, so two cylinders whose pistons move identically can be a full revolution apart, one firing while the other is drawing in. Inline-4's cylinders 1 and 4 are exactly that case: same crank throw, always two strokes apart.
- **How it's kept honest.** A wrong offset would produce a rhythm that looks entirely plausible while describing an engine that doesn't exist, so the test sweeps a full cycle at 0.05° resolution, records the order cylinders actually enter the power stroke, and asserts it matches the layout's firing order — for all thirteen layouts, reading only what the renderer reports rather than restating the table it came from. A second, independent check confirms every power stroke begins at that cylinder's own top dead center, and the odd-fire V6 reproduces its real 150°/90° alternation. Flipping the offset's sign fails 22 tests; collapsing the cycle to 360° fails 37.
- Per-frame discipline holds: a material is written only when a cylinder's phase actually changes — a handful of writes per 720° cycle, not per frame — and with the option off no material is touched at all. Full suite: 1,207 tests.

### feat: upright single cylinders, and an option to stand flat engines up

- **Single-cylinder view now draws every cylinder upright**, whatever engine it came from. Comparing an S2000's cylinder against a boxer's used to mean comparing one standing up against one lying on its side, which makes judging their relative size unnecessarily hard. Isolating a single cylinder is already an abstraction — what's on show there is its proportions, not its installed angle — so the view now says so consistently. Full-engine view is unchanged and still draws real orientations.
- **"Stand flat engines upright"** (off by default) rotates a boxer 90° in full-engine view, putting one piston of each opposed pair above the crank and its partner below. The pair stays on the same crank and stays 180° opposed, so the boxer's defining motion still reads — but piston travel runs vertically, in the same orientation as every other engine, which makes it directly comparable.
- Drawn orientation is now a **presentation concern only**, resolved by a single function from the layout kind and the two view settings. `engineLayout.ts` still describes real engines: a boxer's bank offsets remain ±90° there whatever the view is set to, so the model never disagrees with the engine it describes.
- Guarded by test: whether a pair shares a crankpin, which cylinder draws the crank, the one-arrow-per-engine rule, and the stacked-versus-side-by-side comparison rule are all identical with the preference on or off — rotation changes nothing but what you see. Full suite: 1,139 tests.

### feat: an inline-five and a Golf GTI

- **Audi RS3 (8V.2) / TT RS — 2.5 TFSI "evo"**, the roster's first inline-five, firing 1-2-4-5-3 at even 144° intervals. Its geometry and compression come from Audi's own Self-Study Programme 920273, whose spec table names the DAZA engine code outright — the best-sourced entry in the roster.
- **Volkswagen Golf GTI (Mk7) — EA888 Gen 3**, and the reason it's worth having alongside the Audi: the two share an identical 82.5 × 92.8 mm bore and stroke on an identical 144 mm rod. Same cylinder, five of them versus four. Put them side by side and every difference on screen comes from cylinder count and compression alone.
- The GTI's 258 lb-ft arrives at 1,500 rpm, the lowest torque peak in the roster by a wide margin, against the RS3's 400 hp holding from 5,850 to 7,000 — two very different answers from one cylinder design.
- **A note on the RS3's power figure**: Audi quotes 400 PS in Europe and Audi of America quotes 400 hp, so both systems round to the same number even though 400 PS is really about 395 hp. The US SAE-net power and torque figures are used together here, so no PS-derived number is paired with an SAE one — the mistake that produced a wrong F20C figure earlier in this project.
- **Corrected**: the EJ257's redline note now records that some aggregate listings quote 6,700 rpm, which matches neither the tachometer marking nor the observed fuel cut on this variant; 7,000 rpm is what the model-specific sources agree on. Full suite: 1,123 tests.

### feat: three Subaru boxers, and a clearer cylinder-view switch

- **Subaru Impreza WRX STI (GD), Impreza WRX (GD), and BRZ / Toyota 86** — the first flat-4s in the roster, all two-source verified. The two Imprezas share the same 130.5 mm EJ-family rod, so the difference between the STI's 99.5 × 79 mm and the WRX's 92 × 75 mm is purely the crank — a clean rod-to-stroke comparison. The BRZ's FA20 is exactly square at 86 × 86 mm, the same bore and stroke as the app's default configuration but on a much shorter rod at 12.5:1, which makes the point that bore and stroke alone don't determine how a mechanism moves.
- **Not added, deliberately**: the FA24 (WRX 2022+) still fails the rod-length bar — every aftermarket listing quoting a length is for the FA20, and every FA24-specific rod is sold as a "+2 mm" stroker upgrade with no stated baseline, so the obvious ~131 mm inference has no source behind it. The VW VR5 and VR6 3.2 also missed: the VR6's geometry and output verify cleanly but its redline is forum-sourced only, and the VR5's compression, redline, and output all rest on a single source.
- **The cylinder-view switch now shows both states at once** — "Single cylinder" on the left, "Full engine" on the right, with the inactive side dimmed. Previously one label swapped text on click, so you couldn't tell whether it described what you were seeing or what clicking would do. Screen readers had the same problem for a subtler reason: the accessible name was built from that changing text, so the control announced as a different name in each state. It now has a fixed name with `aria-checked` carrying the state.

### fix: a 60° V6 does not have a split-pin crank

- Comments and design notes described the 60° V6 (`v6-60`) as a "split-pin (flying arm)" crank, conflating two different mechanisms. A true split pin is the **90°** V6's trick: one journal machined as two overlapping halves staggered 30°. At 60° the two pin surfaces would overlap too little to be strong enough, so a 60° V6 instead gives **each cylinder its own crankpin**, joined to its bank partner's by a flying-arm web 60° away. The rendering was already correct — it decides from pin geometry rather than from the label — but the prose was wrong. Split-pin references are kept where they are accurate, as the contrast that explains why the 60° V6 can't use one.
- The GT-R preset's note now states the general geometric requirement rather than asserting a Nissan-specific construction detail no source could back. Full suite: 1,099 tests.

### feat: the full layout roster — V, flat, inline-5, and odd-fire

- **Thirteen layouts**: inline-3/4/5/6, V6 at 60° and the odd-fire 90°, V8 in both cross-plane and flat-plane, V10, V12, and boxer flat-4/flat-6. All 16 presets now render their real architecture — the LS3 and LS7 as cross-plane V8s, the 458 as a flat-plane V8, the VR38DETT as a 60° V6.
- A cylinder **count** can no longer identify a layout (a V8 and an inline-8 share one), so a layout id identifies the architecture instead, carried in links as `l`/`bl`. Legacy `c`/`bc` links keep decoding exactly as before.
- **Firing behavior is derived and tested, not asserted in a comment.** Each table is built from crank geometry and checked by sorting its firing events across 720°: the odd-fire V6 comes out at the real alternating 150°/90°, and the flat-plane V8 stays even-fire at 90° overall while each of its banks fires evenly at 180° — the actual origin of that engine's sound, with a test asserting the cross-plane V8's banks are specifically _not_ even. `firingOrder` is stored as real data because a crank table alone cannot determine intervals: every cylinder reaches TDC twice per cycle, and which pass fires is not derivable from geometry.
- **Fixed**: the previously shipped inline-3 and inline-6 tables were mirrored — under the code's sign convention they implied firing orders 1-2-3 and 1-4-2-6-3-5, the reverse-rotation twins of the textbook 1-3-2 and 1-5-3-6-2-4. Same crank physically; the row now leads from the correct end.

### feat: V and flat engines draw one cutaway plane per throw

- A V8 previously drew as eight separate upright mechanisms in a row: very wide, very short, and shrunk to almost nothing once the camera fitted it. The two cylinders of a throw now share one plane, so a V8 reads as four V units — the row narrows by 47% and the fitted zoom grows 1.88×.
- The two cases are physically different and are drawn differently. Plain-pin V engines genuinely **share** a crankpin, so one crank is drawn with both rods hanging off the single shared pin. A **boxer is not a 180° V**: its paired cylinders run on separate throws 180° apart, which is exactly why the pistons move outward together, so both throws are drawn. The 60° V6 is a third case — each cylinder gets its own crankpin, joined to its bank partner's by a **flying arm** 60° apart (too little pin overlap for a split pin), which is what makes it even-fire. The renderer decides from the pin geometry itself rather than from the layout kind, so all three come out right.

### feat: single-cylinder / full-engine toggle

- Architecture and viewing depth are now separate questions. The layout picker says _which engine this is_; a new switch says _how much of it you're looking at_, so studying one cylinder no longer costs you the knowledge that it belongs to a V8. Per engine, shareable as `sv`/`bsv`, and legacy `?c=1` / `?l=single` links still open on a single cylinder.
- **Comparison stacks vertically** whenever either engine shows more than one cylinder, aligning corresponding throws in columns — the comparison a viewer actually wants is now the easy one to make, instead of cylinder 1 of each engine sitting at opposite ends of the frame. Two single cylinders still sit side by side. One shared zoom throughout, so a big engine still towers over a small one.
- **Fixed**: picking a layout left the view toggle alone, so selecting "Inline-4" while viewing a single cylinder showed one cylinder and made the control look broken. Choosing a layout now shows that whole engine; choosing a _preset_ still leaves your view untouched, since a car is an identity rather than a viewing choice.

### fix: torque and horsepower — sourced peaks only, no modeled curve

- **Removed the modeled torque/power curves.** Presets carry two verified peak figures, never dyno sweeps, and no shape drawn through two points can represent real delivery. Checked against dyno sheets for a stock S2000 AP1, the model was not merely imprecise but wrong in character: it held torque flat from idle to the peak, erasing the one thing an F20C is known for — that the torque isn't there until VTEC arrives near 6,000 rpm.
- Published dyno sheets can't stand in as the source either: they are single-source wheel figures (208 whp against Honda's 240 crank hp) from one car on one dyno, which would fail the two-source standard the rest of the roster is held to.
- The verified peaks remain as plain readouts — "240 hp @ 8,300 rpm", "153 lb-ft @ 7,500 rpm" — stated as manufacturer-published figures for the documented market variant, saying nothing about what happens between them. The piston kinematic curves are unaffected; those are exact closed-form geometry, not modeled data. Full suite: 1,061 tests.

### fix: review pass over the multi-cylinder work

- **A share link naming a preset now carries that engine's real layout.** `?a=s2000-ap1` with no `c` used to load the F20C's geometry but render it as a single cylinder, while clicking the same preset set inline-4 — the link silently misrepresented the engine it named. A preset id now implies its own cylinder count, and a numeric configuration implies 1, so a link stays a complete description of an engine. Encoding mirrors the rule exactly: `c` travels only when it disagrees with what decoding the config will infer, so viewing a real four deliberately as a single cylinder still round-trips (the naive fix would have decoded it back as an inline-4).
- **A preset button no longer claims to be selected after changing the cylinder count.** Picking a four-cylinder preset and then switching to "Single" left the button pressed, asserting a real engine's layout the app was no longer showing. Active state now requires the count to match too.
- **Removed an orphaned cylinder-count validation schema.** It had no callers, and its doc comment implied a validation path that did not exist — the type guard both real entry points use is the correct check for a closed select and a silently-dropped link parameter.
- **Known limitation, documented not fixed:** an arrow-key nudge during playback jumps rather than steps, because it reads the crank angle the loop mirrors at 10 Hz. The jump is not the shortcut's: stopping playback by any means already snaps the mechanism to that same mirrored angle. Fixing it means flushing the loop's live angle into the store as playback stops, reconciled with `scrubTo` writing an explicit angle at the same instant — a change to pause semantics app-wide, left as a deliberate decision rather than a side effect. Full suite: 827 tests.

### feat: keyboard shortcuts, crank-direction arrow, About dialog

- **Keyboard shortcuts.** Space toggles play/pause; ←/→ scrub the crank by 1° (10° with Shift), pausing playback per the scrub rule. Form controls, buttons, contentEditable regions, and open modal dialogs keep their native key handling untouched, and modifier combos are left to the browser. Hinted via `title`/`aria-keyshortcuts` on the play button and scrub slider.
- **Crank-direction arrow.** A dim partial-ring arrow around the front cylinder's crank center shows rotation direction. The handedness was derived from the actual kinematics — crankpin at (r·sinθ, r·cosθ) reads as clockwise from the front view — and is pinned by a finite-difference test against `calculateMechanismState`, so the arrow can never silently disagree with the motion.
- **About dialog.** An "About" button in the header opens an accessible modal covering what the app is, what the kinematics do and don't model, the two-independent-source data-sourcing discipline behind every preset figure, and the tech stack with a repo link. Hand-rolled focus trap (jsdom's `<dialog>` is a stub, so native `showModal` would be untestable); Esc, backdrop, and close button all dismiss; focus returns to the trigger. Full suite: 816 tests.

### feat: four-stroke cycle overlay

- **Stroke badge.** An optional "Four-stroke cycle" preference shows the current stroke (intake, compression, power, exhaust) and a 0–720° cycle counter beside the crank-angle readout. The textbook idealization — quarter boundaries exactly at the dead centers, no valve-overlap modeling — stated as such.
- The 720° cycle needs to know _which_ of the two crank revolutions it is on, which a wrapped 0–360° angle cannot say; a revolution-parity bit is integrated in the animation loop's ref state alongside the angle (multi-wrap-safe for clamped inactive-tab frames), mirrored to the store at the same throttled 10 Hz, assigned rather than integrated for engine B while speeds are linked — the same discipline as the angle itself. Scrubbing keeps the current half of the cycle; a 720° scrub control is future work.
- The badge reads cylinder 1 (crank-throw phase 0) — per-cylinder stroke display arrives with firing orders. Full suite: 757 tests.

### feat: piston kinematic curves

- **Position, velocity, and acceleration vs. crank angle** as three stacked SVG strips under the results, from the exact closed-form derivatives of the slider-crank displacement (dx/dθ and d²x/dθ² live in the engine layer in crank-angle units; the rpm-dependent conversion to m/s and m/s² happens only at the display boundary). Peak values are labeled in real units at the current rpm, and a live cursor follows the crank via the existing throttled 10 Hz readout mirror — the frame loop is untouched.
- **Comparison overlay.** Engine B's curves are drawn dashed over engine A's on shared per-quantity scales, so a short-rod engine's skewed velocity curve and harsher TDC acceleration are directly visible against a long-rod one.
- The closed forms are tested against central-difference numerical differentiation of the mechanism state across five rod ratios (velocity to ~1e-9, acceleration to ~2e-7 relative), plus exact identities: acceleration r(1 + r/l) at TDC and −r(1 − r/l) at BDC, and peak velocity landing earlier the shorter the rod.

### fix: honest label for the untouched default configuration

- The default 86 × 86 mm configuration now reads "Default engine (86 × 86 mm)" instead of "Custom engine", which wrongly implied edits had been made before the user touched anything. Editing any dimension still switches it to "Custom engine".

### feat: multi-cylinder engines — inline layouts

- **Inline-3, inline-4, and inline-6 layouts.** A "Cylinders" select per engine renders N copies of the proven slider-crank mechanism in a row, each driven at the engine's crank angle plus its cylinder's crank-throw phase (flat-plane 0-π-π-0 for a four, 120° pairings for a three and six) — so the phase relationships of a real crankshaft are visible at a glance. Each cylinder is drawn in its own cutaway plane; a true axial 3D crankshaft view remains future work (§24a).
- **Presets know their layout.** Selecting an inline engine (F20C, RB26DETT, 2JZ-GTE, S54, and the rest of the inline roster) applies its real cylinder count; V-engine presets stay in single-cylinder view until V layouts render.
- **Total displacement.** The displacement row shows per-cylinder and whole-engine figures ("499 cc/cyl · 1997 cc total") once an engine has more than one cylinder.
- **Cylinder counts are shareable** via new `c`/`bc` link params, append-only per the §25a contract; unsupported counts in hand-edited links are dropped at decode.
- Comparison mode composes unchanged: two rows placed and framed by the same union-bounds camera fit, so an inline-6 genuinely dwarfs a single. Cylinder 0 keeps phase 0, so scrubbing, the degree counter, and every readout stay referenced to cylinder 1.
- Architecture documented in §24a; the model deliberately stores phase/bank angles in radians rather than the §24 sketch's degree fields (§8.1 canonical-units rule). Full suite: 683 tests.

### fix: review pass over the independent-speeds work

- Running-speed range raised to 12,000 rpm to cover every legal redline — "At redline" could previously store a speed that the rpm validator, the rpm input's own HTML limit, and the share-link decoder all rejected. All three now read the same constant.
- A hand-edited share link carrying `brpm`/`bangle` without a usable engine B is now ignored entirely, instead of silently pre-unlinking a future comparison.
- Turning comparison on now seeds engine B's speed from the current speed, so the first-ever unlink starts both engines together instead of dropping B to the pristine default; a user-set speed is still remembered across link/unlink cycles.
- Share-link contract table in the design doc updated with `brpm`/`bangle`; §13 records the range alignment. 618 tests.

### feat: independent engine speeds, exposed and shareable

- **Speed controls for comparison mode.** A "Link engine speeds" toggle (linked by default) splits the two engines onto their own rpm inputs, each with an "At redline" button showing that engine's actual figure — so an S2000 at 9,000 rpm against an LS7 at 7,000 is two clicks, and the speed difference is visible in the animation rather than inferred from a table.
- **Split speeds are shareable.** `brpm` carries engine B's speed and its presence is what marks a link as unlinked (so "unlinked at matching speeds" survives the round trip); `bangle` carries engine B's crank angle when paused. A link without them leaves your current linking alone.
- **Fixed: engine B's metrics were computed at engine A's crank angle.** An audit while wiring the controls found that piston displacement from TDC, current piston-to-head distance, and connecting-rod angle all called the kinematics with the shared angle for both engines, and mean piston speed used the shared rpm — so every one of them was wrong for engine B the moment the speeds diverged. Each now resolves engine B's own angle and speed. The crank-angle row shows a real difference when unlinked and "—" when linked.
- **Repo hygiene**: added `.gitattributes` (`eol=lf`) so Windows checkouts stop producing CRLF files that fail the format check without anyone editing them.

### feat: shareable links, engine labels, power figures, independent redlines

- **Shareable links.** The current setup lives in the URL, so a comparison can be sent to someone: `?a=s2000-ap1&b=corvette-z06-c6-ls7&rpm=3000`. Configurations matching a known car are written as preset ids, others as raw numbers; pausing before copying captures the exact crank angle. Malformed or hand-edited links degrade gracefully, and every decoded configuration passes validation, so a link can never inject impossible geometry. The URL format is documented as an append-only contract in the design doc. A Copy-link button falls back to a selectable field if the clipboard is unavailable.
- **Labels under each mechanism** naming the matching car (or "Custom engine"), with `A`/`B` chips in comparison mode. They finally give the "Show component labels" checkbox something to control, and the camera reserves space for them only when shown.
- **Power and torque** for all 16 cars, two-source verified against each preset's documented market variant, with their peak rpms. Shown when the configuration matches a real engine, "—" otherwise. The F20C figure was corrected to 240 hp after a cross-check caught a European PS figure mismatched against a US torque number.
- **Independent engine speeds.** Comparison mode can unlink the two engines so each runs at its own rpm — the point being to watch a 9,000 rpm redline against a 7,000 rpm one in real time. Linked mode assigns rather than integrates engine B's angle, so the two can never drift apart in the low bits. Scrubbing phase-locks both; resuming lets them diverge.
- **Slower playback**: 1/100× and 1/250× added for high-revving engines, and the default is now 60 rpm at 1/2×, which is legible on load.
- **Fixed**: the stray divider and heading misalignment above Engine B when the two panels sat side by side — the separator now belongs to the layout that decides stacked-versus-columns.
- **Removed**: the prose mechanism-description sentences. Every value in them is a labeled row in the results table, and reflowing them on each update made the panel jump during playback.
- Full suite: 584 tests.

### feat: naturally aspirated 2.4 presets (KA24DE, K24A2)

- **Nissan 240SX (KA24DE)** — the US-market naturally aspirated twin-cam sibling to the JDM SR20DET Silvia already in the roster, so the two sides of the KA-to-SR swap story can be compared directly. 89 × 96 mm on a 165 mm rod: markedly undersquare, with the longest rod-to-stroke ratio of any four in the roster.
- **Acura TSX (K24A2)** — Honda's naturally aspirated 2.4, grouped under Honda. Its 10.5:1 compression and 7,100 rpm redline are TSX-specific; the Accord/Element/CR-V variants share the same 87 × 99 bottom end at different compression, noted in the source comments rather than added as near-duplicate entries.
- **New roster invariant**: no two presets may share an identical spec set, enforced by test — so cars that render identically can never pad the picker as the roster grows.
- Full suite: 410 tests, 16 presets across seven brands.

### feat: redlines, brand-grouped presets, metric explainers, squareness labels

- **Redline** is now part of every engine config (editable, validated 3,000–12,000 rpm), shown as a metric with a new **mean piston speed at redline** row — the equalizer stat (most performance engines converge on ~20–25 m/s at their limits). All preset redlines verified against two sources; F20C corrected to 9,000 rpm (8,900 was the US fuel cut) and B6 to 7,200.
- **Five new preset cars**: Ferrari 458 Italia (F136), Nissan Silvia (SR20DET), Skyline GT-R (RB26DETT), GT-R R35 (VR38DETT), and BMW M3 E46 (S54) — full sourced per-cylinder data. The Toyota GR86's FA24 was researched but dropped: its stock rod length could not be corroborated. The F136's rod length is flagged single-source in code.
- **Brand-grouped preset picker**: presets now organize under brand buttons with car counts (BMW, Chevrolet, Ferrari, Honda, Mazda, Nissan, Toyota); one brand expands at a time and the brand matching the current config auto-expands.
- **Clickable metric explainers**: every results/comparison metric label toggles an inline explanation of what the metric means and the difference it makes in an engine (keyboard accessible, Escape closes, one open at a time).
- **Bore-to-stroke squareness**: the ratio now carries its industry label — square, oversquare, or undersquare (±1% band for square), e.g. "1.12:1 · oversquare" for the LS3.
- Full suite: 395 tests.

### feat: piston-to-head distance and comparison difference table

- The results panel's static range row now shows what was actually asked for: **piston-to-head distance** — clearance height at TDC to clearance height + stroke at BDC (e.g. 9.05 – 95.05 mm at defaults) — plus a live current-distance-to-head readout. The live piston displacement from TDC remains. Backed by a new tested engine function `calculatePistonToHeadDistanceMm`.
- In comparison mode the two stacked results panels are replaced by a single accessible table — Metric | Engine A | Engine B | Difference — with signed percentage deltas ((B−A)/A, e.g. "+75.4%" for LS7 displacement vs the default engine). No winner highlighting by design: most metrics have no objectively better direction. Zero baselines and the shared crank angle show "—". The table scrolls in its own container on narrow screens; the page never scrolls horizontally.

### fix: responsive layout across all screen sizes

- Fixed the mobile viewport bug where the canvas inflated below a tall panel with the mechanism lost in dead space — the container now has a definite clamped height, so the auto-framing camera fills it correctly.
- Deliberate layouts per size range: compact single-line header and tightened control density on phones; two-column control/results arrangements on tablet portrait (600–900px) via container queries; a panel minimum width guard at the 900px side-by-side boundary; a wider panel with two-column results on ≥1600px desktops; and comparison mode showing Engine A/B panels side by side at 600–900px and ≥1200px (stacked on phones), mirroring the viewport's left/right arrangement.
- Verified with real headless-browser screenshots at 360, 768, 1024, 1440, and 1920px, in both single and comparison modes, with zero horizontal overflow at any width.

### chore: consolidate hosting on Vercel

- Removed the GitHub Pages deploy workflow and disabled Pages on the repo; Vercel (git-linked, auto-deploy on push to `main`) is now the sole host. The Vite `base` override is gone — the app serves from the domain root everywhere, including local dev (now `http://localhost:5173/`).

### feat: static piston-travel range readout

- The results panel now shows "Piston travel (from TDC): 0 – {stroke}" as a fixed reference directly above the live piston-displacement readout, in the selected display unit, per engine slot.

### chore: Vercel integration

- Vercel plugin for Claude Code enabled at project scope (`.claude/settings.json`), with the plugin's `AGENTS.md` conventions mirror.
- `vite.config.ts` base is now deploy-target aware: `/` on Vercel builds (`VERCEL=1`), `/engine-visualizer/` for GitHub Pages and local dev.

### feat: engine comparison mode and playback speed

- **Playback speed**: rendered motion can be slowed to 1/2×, 1/4×, 1/10× (new default), or 1/50× of real time — 600 RPM is 10 revs/second, which strobes at 60 fps. Slow-motion affects rendering only; every calculated readout still uses true RPM.
- **Comparison mode**: "Add comparison engine" renders a second complete mechanism beside the first at a strictly shared millimeter scale, driven by the same crank angle and RPM, so all visible differences are purely geometric. Engine B gets its own presets, geometry controls, and results panel ("Engine A" left, "Engine B" right, matching the viewport). The scene mechanism was refactored into a reusable per-config `CrankMechanism` component — the architectural stepping stone toward multi-cylinder layouts (§24).
- Full suite now 285 tests.

### feat: sports-car engine presets and compression ratio

- **Engine presets** (`src/engine/presets.ts`): one-click per-cylinder geometry for nine well-known engines — Honda S2000 AP1 (F20C) and AP2 (F22C1), Mazda Miata NA 1.6 (B6), NA/NB 1.8 (BP), and ND 2.0 (PE), Corvette C6 (LS3) and Z06 (LS7), Toyota Supra (2JZ-GTE), and Honda Type R (K20A). Bore and stroke come from factory specs; every rod length and stock compression ratio is corroborated by at least two independent sources (cited in code comments, market variants noted). Preset tests pin each engine's advertised displacement (within 2%) and factory compression ratio as independent literals.
- **Compression ratio** is now part of the engine configuration (dimensionless, validated 5–20:1). The clearance volume is modeled as a flat disc above the piston crown, so the rendered cylinder head sits exactly `stroke/(CR−1)` above TDC — a 13:1 Skyactiv visibly squeezes the piston while an 8.5:1 2JZ-GTE shows a tall gap — with the clearance band shaded distinctly and camera framing tracking the head position. New calculated results: clearance volume (cc) and clearance height at TDC. The compression-ratio input is unaffected by the mm/in display-unit toggle.
- Full suite now 221 tests.

### feat: first working single-cylinder visualizer (Phases 2–5)

- **Simulation** (`src/engine/`): slider-crank kinematics (`calculateMechanismState`), displacement/speed/ratio calculations, unit conversions, and Zod validation with mechanical-terms error messages and the authoritative `rodLength > stroke/2` cross-field rule. 57 unit tests covering known positions (TDC/90°/BDC/360°), invariant sweeps, and validation acceptance/rejection.
- **Scene** (`src/scene/`): React Three Fiber orthographic cutaway of the mechanism — piston, connecting rod, crank throw, cylinder guide with TDC/BDC markers. The frame loop owns the live crank angle in a ref, clamps tab-inactive deltas, and mirrors readouts to the store at 10 Hz; rod attachment is guaranteed structurally (local +Y from big end lands on the piston pin at every angle). Auto-framing derives bounds from config with a single shared zoom so axes are never distorted. WebGL-unavailable fallback and error boundary included. Transform mapping unit-tested over 48 angles × 3 configs without WebGL.
- **Interface** (`src/components/`): responsive two-region shell, geometry controls with per-field drafts (invalid values never reach the store; messages attach to the offending field via `aria-describedby`), play/pause/RPM/scrub controls, mm/in unit toggle that preserves physical dimensions, and a live calculation panel with a textual mechanism description. 30 component tests.
- **App**: viewport lazy-loaded so Three.js (~234 kB gzip) ships in its own chunk and controls render immediately. Full suite: 87 tests passing.

### chore: project foundation

- Technical design document (`TECHNICAL_DESIGN.md`) reviewed and amended: oxlint replaces ESLint (current Vite template default), rod-angle sign convention documented, live-readout throttling specified, reduced-motion behavior made explicit, and a Deployment/CI section added (GitHub Pages + GitHub Actions).
- Scaffolded Vite 8 + React 19 + TypeScript 6 project with Three.js, React Three Fiber, Drei, Zustand, Zod, Vitest, Testing Library, Prettier, and oxlint.
- Core domain types (`src/engine/types.ts`), constants and input ranges (`src/engine/constants.ts`), and the Zustand store (`src/state/engineStore.ts`) with play/pause/scrub semantics and reduced-motion-aware initial state.
- Repository documentation: README, CONTRIBUTING, CLAUDE.md, MIT license.
- CI workflow (lint, format check, test, build) and GitHub Pages deploy workflow.
