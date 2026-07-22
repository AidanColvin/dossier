"use client";

// One financial metric with a link to the filing it came from. A number
// without a source breaks the provenance covenant, so the parent hides the
// whole row when no filing is present rather than showing an unsourced value.

/** Takes a metric and its source. Returns the card. */
export function FinancialCard({
  label,
  value,
  delta,
  sourceUrl,
  sourceLabel,
}: {
  label: string;
  value: string;
  delta?: string;
  sourceUrl: string;
  sourceLabel: string;
}) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      {delta && (
        <div className="metric__delta" style={{ color: "var(--muted)" }}>
          {delta}
        </div>
      )}
      <a
        className="metric__source"
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {sourceLabel}
      </a>
    </div>
  );
}
