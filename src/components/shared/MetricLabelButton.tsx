import styles from "./MetricLabelButton.module.css";

export interface MetricLabelButtonProps {
  /** The row's `METRIC_INFO` id — also used to build `aria-controls`. */
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  /** id of the element this button reveals/hides (the explainer text). */
  panelId: string;
  /**
   * Extra class(es) from the caller, so the button can inherit whatever
   * typography the row label already used (`CalculationPanel`'s `.term` or
   * `ComparisonTable`'s row-header styling) — this component only resets
   * button chrome and adds the info affordance.
   */
  className?: string;
}

/**
 * A results-row label that doubles as the trigger for its metric's info
 * explainer (Task 2). Deliberately not sized to the app's usual 44px
 * touch-target minimum: inside a dense results list/table, that would
 * roughly double every row's height. WCAG's target-size success criterion
 * explicitly exempts controls presented inline within a block of text —
 * which is exactly this case — so normal row padding plus a comfortable
 * click/tap area on the label text itself is the right tradeoff here.
 */
export function MetricLabelButton({
  id,
  label,
  isOpen,
  onToggle,
  panelId,
  className,
}: MetricLabelButtonProps) {
  return (
    <button
      type="button"
      className={[styles.trigger, className].filter(Boolean).join(" ")}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={() => onToggle(id)}
    >
      <span>{label}</span>
      <span className={styles.icon} aria-hidden="true">
        ⓘ
      </span>
    </button>
  );
}
