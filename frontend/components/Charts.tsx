"use client";

// hand-built SVG charts. no charting dependency, so nothing to ship, theme or
// keep in sync - the charts read the same CSS variables as everything else.

export interface Series {
  label: string;
  color: string;
  points: { x: string; y: number }[];
}

/**
 * given a number of dollars
 * return a short human form - $391.0B, $26.3M - because a financial tile that
 * reads 391035000000 is not a fact anyone can use
 */
export function money(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * given one or more series over the same x axis
 * render a multi-series line chart with a baseline, end-point dots and a
 * legend. the y axis starts at zero so relative heights stay honest.
 */
export function LineChart({
  series,
  height = 210,
}: {
  series: Series[];
  height?: number;
}) {
  const xs = series[0]?.points.map((p) => p.x) ?? [];
  if (xs.length < 2) return null;

  const values = series.flatMap((s) => s.points.map((p) => p.y));
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  // A viewBox-based coordinate space keeps the chart fluid at any width.
  const W = 600;
  const H = height;
  const padX = 8;
  const padY = 16;
  const x = (i: number) => padX + (i * (W - padX * 2)) / (xs.length - 1);
  const y = (v: number) => H - padY - ((v - min) / span) * (H - padY * 2);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={series.map((s) => s.label).join(", ")}
      >
        <line
          x1={padX}
          y1={y(min)}
          x2={W - padX}
          y2={y(min)}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              points={s.points.map((p, i) => `${x(i)},${y(p.y)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(s.points.length - 1)}
              cy={y(s.points[s.points.length - 1].y)}
              r="4"
              fill={s.color}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>

      <div className="chart-axis">
        {xs.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * given labelled values
 * render a vertical bar chart with the value printed above each bar
 */
export function BarChart({
  points,
  color = "var(--ink)",
  format = (v: number) => String(v),
  height = 190,
}: {
  points: { x: string; y: number }[];
  color?: string;
  format?: (value: number) => string;
  height?: number;
}) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.y), 0) || 1;

  return (
    <div>
      <div className="bars-v" style={{ height }}>
        {points.map((point) => (
          <div className="bars-v__col" key={point.x}>
            <span className="bars-v__value">{format(point.y)}</span>
            <div
              className="bars-v__bar"
              style={{
                height: `${Math.max((point.y / max) * 100, 1)}%`,
                background: color,
              }}
            />
          </div>
        ))}
      </div>
      <div className="chart-axis">
        {points.map((point) => (
          <span key={point.x}>{point.x}</span>
        ))}
      </div>
    </div>
  );
}

export interface Leader {
  name: string;
  title: string;
}

/**
 * given a company's ranked leadership (most senior first)
 * render a root-and-reports org chart: the first leader as the root box,
 * every other leader as a report beneath it. the connecting lines are
 * plain CSS borders (a stem below the root, a rail above the reports),
 * so the layout needs no coordinate math and reflows at any width like
 * the rest of the app.
 */
export function OrgChart({ leaders }: { leaders: Leader[] }) {
  if (leaders.length === 0) return null;
  const [root, ...reports] = leaders;

  return (
    <div className="org-chart">
      <div className="org-chart__node org-chart__node--root">
        <strong>{root.name}</strong>
        <span>{root.title}</span>
      </div>
      {reports.length > 0 && (
        <>
          <div className="org-chart__stem" aria-hidden />
          <div className="org-chart__rail" aria-hidden />
          <div className="org-chart__reports">
            {reports.map((leader) => (
              <div key={leader.name} className="org-chart__report">
                <div className="org-chart__branch" aria-hidden />
                <div className="org-chart__node">
                  <strong>{leader.name}</strong>
                  <span>{leader.title}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
