"use client";

// Small dependency-free SVG charts for the admin overview. Colours come from
// the theme variables so they follow the rest of the admin UI.

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function LineChart({ labels, series }: { labels: string[]; series: LineSeries[] }) {
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const labelAt = [0, Math.floor((labels.length - 1) / 2), labels.length - 1].filter(
    (v, i, all) => labels.length > 0 && all.indexOf(v) === i,
  );

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} style={{ stroke: "var(--color-emerald)", opacity: 0.15 }} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: "var(--color-sage)" }}>
              {t}
            </text>
          </g>
        ))}
        {labelAt.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={HEIGHT - 6}
            textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
            fontSize="11"
            style={{ fill: "var(--color-sage)" }}
          >
            {labels[i]}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              fill="none"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ stroke: s.color }}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
            {s.values.length <= 40 &&
              s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="3" style={{ fill: s.color }}>
                  <title>{`${labels[i]} — ${s.name}: ${v}`}</title>
                </circle>
              ))}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-sage">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  // Shown as a darker part of the bar (e.g. how many of the value paid).
  highlight?: number;
  // Right-hand text; defaults to the value.
  display?: string;
  href?: string;
}

export function BarList({
  items,
  color = "var(--color-emerald)",
  empty = "Nothing to show yet.",
}: {
  items: BarItem[];
  color?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-sage">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
              <span className="truncate text-ink">{item.label}</span>
              <span className="shrink-0 font-mono text-xs text-sage">{item.display ?? item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-emerald/10 overflow-hidden">
              <div className="h-full rounded-full relative" style={{ width: `${(item.value / max) * 100}%`, background: color, opacity: item.highlight === undefined ? 1 : 0.35 }}>
                {item.highlight !== undefined && item.value > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(item.highlight / item.value) * 100}%`, background: color, opacity: 1 }}
                  />
                )}
              </div>
            </div>
          </>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <a href={item.href} className="block hover:bg-emerald/5 -mx-2 px-2 py-0.5 rounded-lg transition-colors">
                {row}
              </a>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ColumnChart({
  items,
  color = "var(--color-coral)",
  empty = "No data yet.",
}: {
  items: { label: string; value: number }[];
  color?: string;
  empty?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-sage">{empty}</p>;
  const max = niceMax(Math.max(...items.map((i) => i.value)));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / items.length;
  const barW = Math.min(36, slot * 0.7);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img">
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} style={{ stroke: "var(--color-emerald)", opacity: 0.2 }} />
      {items.map((item, i) => {
        const h = (item.value / max) * innerH;
        const cx = PAD.left + slot * i + slot / 2;
        return (
          <g key={item.label}>
            <rect x={cx - barW / 2} y={PAD.top + innerH - h} width={barW} height={h} rx="3" style={{ fill: color }}>
              <title>{`${item.label}: ${item.value}`}</title>
            </rect>
            <text x={cx} y={PAD.top + innerH - h - 4} textAnchor="middle" fontSize="11" style={{ fill: "var(--color-ink)" }}>
              {item.value}
            </text>
            <text x={cx} y={HEIGHT - 6} textAnchor="middle" fontSize="10" style={{ fill: "var(--color-sage)" }}>
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
