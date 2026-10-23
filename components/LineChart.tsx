import styles from "./LineChart.module.css";

export type Series = { name: string; tone: "teal" | "sun"; values: (number | null)[] };

const W = 340;
const H = 160;
const PAD = { top: 10, right: 8, bottom: 22, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const GRID = [0, 50, 100];

/**
 * Hand-rolled SVG line chart for 0–100% series. Gaps (null) break the line.
 * The SVG is decorative for assistive tech; a hidden table carries the data.
 */
export function LineChart({ labels, series, caption }: { labels: string[]; series: Series[]; caption: string }) {
  const step = labels.length > 1 ? PLOT_W / (labels.length - 1) : 0;
  const x = (i: number) => PAD.left + step * i;
  const y = (v: number) => PAD.top + PLOT_H * (1 - Math.min(Math.max(v, 0), 100) / 100);
  const labelEvery = labels.length > 8 ? 2 : 1;

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-hidden="true" focusable="false">
        {GRID.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} className={styles.grid} />
            <text x={PAD.left - 6} y={y(g) + 3.5} className={styles.axis} textAnchor="end">
              {g}%
            </text>
          </g>
        ))}
        {labels.map((label, i) =>
          (labels.length - 1 - i) % labelEvery === 0 ? (
            <text key={label} x={x(i)} y={H - 6} className={styles.axis} textAnchor="middle">
              {label}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          let d = "";
          let penDown = false;
          s.values.forEach((v, i) => {
            if (v === null) {
              penDown = false;
              return;
            }
            d += `${penDown ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
            penDown = true;
          });
          return (
            <g key={s.name} className={styles[s.tone]}>
              <path d={d} className={styles.line} />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r={3} className={styles.dot}>
                    <title>{`${labels[i]}: ${s.name} ${v}%`}</title>
                  </circle>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.legend}>
        {series.map((s) => (
          <span key={s.name} data-tone={s.tone}>
            {s.name}
          </span>
        ))}
      </figcaption>
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.name}>{s.values[i] == null ? "—" : `${s.values[i]}%`}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
