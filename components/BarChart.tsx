import styles from "./BarChart.module.css";

export type Bar = {
  key: string;
  label: string; // x-axis label, e.g. "19 Oct"
  ratio: number; // 0..1 of the bar's own max, so weeks with different maxima compare fairly
  tone: "done" | "current" | "missed";
  description: string; // tooltip + screen-reader table text, e.g. "7 / 12 pts · Submitted"
};

const W = 340;
const H = 160;
const PAD = { top: 10, right: 4, bottom: 22, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const GRID = [0, 0.5, 1];

/**
 * Hand-rolled SVG bar chart (no JS shipped). The SVG is decorative for assistive
 * tech; a visually hidden table carries the same data.
 */
export function BarChart({ bars, caption }: { bars: Bar[]; caption: string }) {
  const slot = PLOT_W / Math.max(bars.length, 1);
  const barW = Math.min(slot * 0.62, 22);
  const labelEvery = bars.length > 8 ? 2 : 1;

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-hidden="true" focusable="false">
        {GRID.map((g) => {
          const y = PAD.top + PLOT_H * (1 - g);
          return (
            <g key={g}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className={styles.grid} />
              <text x={PAD.left - 6} y={y + 3.5} className={styles.axis} textAnchor="end">
                {Math.round(g * 100)}%
              </text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const h = Math.max(PLOT_H * Math.min(Math.max(b.ratio, 0), 1), 2); // 2px stub keeps empty weeks visible
          const x = PAD.left + slot * i + (slot - barW) / 2;
          return (
            <g key={b.key}>
              <rect x={x} y={PAD.top + PLOT_H - h} width={barW} height={h} rx={4} className={styles[b.tone]}>
                <title>{`${b.label}: ${b.description}`}</title>
              </rect>
              {(bars.length - 1 - i) % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} className={styles.axis} textAnchor="middle">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.legend}>
        <span data-tone="done">Submitted</span>
        <span data-tone="current">This week</span>
        <span data-tone="missed">Not submitted</span>
      </figcaption>
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{b.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
