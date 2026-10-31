// Gráficos do assistente do WhatsApp como SVG (string); charts/render.ts converte para PNG.
// Cores: mantidas em sincronia com src/react-app/lib/chart-colors.ts (o servidor não importa do front).

export const W = 1000;
export const H = 560;
const FONT = "DejaVu Sans, Arial, Helvetica, sans-serif";

export const CHART_COLORS = ["#526B94", "#478566", "#B85C63", "#A3853F", "#8A7BA8", "#49818F", "#AD6E52", "#5C7A46", "#A6708F", "#83888F"];
const SERIES = { receitas: "#327B59", despesas: "#B32D31", saldo: "#526B94" };
const INK = "#1F2937";
const MUTED = "#6B7280";
const GRID = "#E5E7EB";

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string);

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const num = (n: number) => Math.round(n * 10) / 10;

/** "R$ 1,2 mil", "R$ 3,4 mi" — rótulos curtos para eixos. */
export const compact = (n: number): string => {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}R$ ${(a / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (a >= 1e3) return `${sign}R$ ${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(".", ",")} mil`;
  return `${sign}R$ ${Math.round(a)}`;
};

/** Escala "bonita" com degraus redondos: de `lo` (≤ 0) a `hi`, de `step` em `step`. */
const niceScale = (min: number, max: number, ticks = 4): { lo: number; hi: number; step: number } => {
  const lo0 = Math.min(0, min);
  const hi0 = Math.max(0, max);
  const raw = (hi0 - lo0 || 1) / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  return { lo: Math.floor(lo0 / step + 1e-9) * step, hi: Math.ceil(hi0 / step - 1e-9) * step, step };
};

const shortMoney = (n: number) => compact(n).replace("R$ ", "");

const frame = (title: string, subtitle: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<text x="40" y="52" font-size="28" font-weight="bold" fill="${INK}">${esc(clip(title, 52))}</text>
<text x="40" y="82" font-size="16" fill="${MUTED}">${esc(clip(subtitle, 90))}</text>
${body}
<text x="${W - 24}" y="${H - 14}" font-size="12" text-anchor="end" fill="#9CA3AF">FinanPOP</text>
</svg>`;

const legend = (items: { label: string; color: string; line?: boolean }[], xRight: number, y: number): string => {
  let x = xRight;
  const out: string[] = [];
  for (const it of [...items].reverse()) {
    const w = it.label.length * 8.6 + 36;
    x -= w;
    out.push(
      it.line
        ? `<line x1="${x}" y1="${y}" x2="${x + 22}" y2="${y}" stroke="${it.color}" stroke-width="4" stroke-linecap="round"/>`
        : `<rect x="${x}" y="${y - 8}" width="16" height="16" rx="3" fill="${it.color}"/>`,
      `<text x="${x + 28}" y="${y + 5}" font-size="15" fill="${INK}">${esc(it.label)}</text>`
    );
  }
  return out.join("\n");
};

// ---------- evolução mensal: barras receitas x despesas + linha do saldo ----------

export interface EvolutionData {
  title: string;
  subtitle: string;
  points: { label: string; receitas: number; despesas: number }[];
}

export const evolutionSvg = (d: EvolutionData): string => {
  const left = 96, right = 30, top = 120, bottom = 70;
  const w = W - left - right, h = H - top - bottom;
  const saldos = d.points.map((p) => p.receitas - p.despesas);
  const { lo: minV, hi: maxV, step } = niceScale(Math.min(0, ...saldos), Math.max(1, ...d.points.flatMap((p) => [p.receitas, p.despesas, p.receitas - p.despesas])));
  const y = (v: number) => top + ((maxV - v) / (maxV - minV)) * h;
  const out: string[] = [];

  for (let v = minV; v <= maxV + step / 2; v += step) {
    out.push(
      `<line x1="${left}" y1="${num(y(v))}" x2="${W - right}" y2="${num(y(v))}" stroke="${GRID}"/>`,
      `<text x="${left - 10}" y="${num(y(v)) + 5}" font-size="14" text-anchor="end" fill="${MUTED}">${esc(compact(v))}</text>`
    );
  }
  if (minV < 0) out.push(`<line x1="${left}" y1="${num(y(0))}" x2="${W - right}" y2="${num(y(0))}" stroke="#9CA3AF"/>`);

  const n = Math.max(1, d.points.length);
  const slot = w / n;
  const bw = Math.min(46, slot * 0.34);
  const showValues = n <= 8;
  const line: string[] = [];
  d.points.forEach((p, i) => {
    const cx = left + slot * i + slot / 2;
    for (const [k, v, color] of [[-1, p.receitas, SERIES.receitas], [0, p.despesas, SERIES.despesas]] as const) {
      const x = cx + (k === -1 ? -bw - 2 : 2);
      const yy = y(Math.max(v, 0));
      out.push(`<rect x="${num(x)}" y="${num(yy)}" width="${num(bw)}" height="${num(Math.max(0, y(0) - yy))}" rx="3" fill="${color}"/>`);
      if (showValues && v > 0) out.push(`<text x="${num(x + bw / 2)}" y="${num(yy - 6)}" font-size="12" text-anchor="middle" fill="${INK}">${esc(shortMoney(v))}</text>`);
    }
    out.push(`<text x="${num(cx)}" y="${H - bottom + 28}" font-size="15" text-anchor="middle" fill="${INK}">${esc(p.label)}</text>`);
    line.push(`${num(cx)},${num(y(saldos[i]))}`);
  });
  if (line.length > 1) out.push(`<polyline points="${line.join(" ")}" fill="none" stroke="${SERIES.saldo}" stroke-width="3.5" stroke-linejoin="round"/>`);
  line.forEach((pt) => {
    const [px, py] = pt.split(",");
    out.push(`<circle cx="${px}" cy="${py}" r="5" fill="#FFFFFF" stroke="${SERIES.saldo}" stroke-width="3"/>`);
  });
  out.push(legend([{ label: "Receitas", color: SERIES.receitas }, { label: "Despesas", color: SERIES.despesas }, { label: "Saldo", color: SERIES.saldo, line: true }], W - right, 100));
  return frame(d.title, d.subtitle, out.join("\n"));
};

// ---------- rosca por categoria ----------

export interface SliceData {
  title: string;
  subtitle: string;
  total: number;
  slices: { label: string; value: number }[];
}

export const donutSvg = (d: SliceData): string => {
  const cx = 270, cy = 330, ro = 170, ri = 100;
  const total = d.slices.reduce((s, x) => s + x.value, 0) || 1;
  const out: string[] = [];
  let a0 = -Math.PI / 2;
  d.slices.forEach((s, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const sweep = (s.value / total) * Math.PI * 2;
    if (sweep >= Math.PI * 2 - 1e-6) {
      out.push(`<circle cx="${cx}" cy="${cy}" r="${(ro + ri) / 2}" fill="none" stroke="${color}" stroke-width="${ro - ri}"/>`);
    } else if (sweep > 0) {
      const a1 = a0 + sweep;
      const p = (r: number, a: number) => `${num(cx + r * Math.cos(a))},${num(cy + r * Math.sin(a))}`;
      const large = sweep > Math.PI ? 1 : 0;
      out.push(`<path d="M ${p(ro, a0)} A ${ro} ${ro} 0 ${large} 1 ${p(ro, a1)} L ${p(ri, a1)} A ${ri} ${ri} 0 ${large} 0 ${p(ri, a0)} Z" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>`);
    }
    a0 += sweep;
  });
  out.push(
    `<text x="${cx}" y="${cy - 4}" font-size="15" text-anchor="middle" fill="${MUTED}">Total</text>`,
    `<text x="${cx}" y="${cy + 24}" font-size="26" font-weight="bold" text-anchor="middle" fill="${INK}">${esc(compact(d.total))}</text>`
  );
  d.slices.slice(0, 10).forEach((s, i) => {
    const yy = 150 + i * 38;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    out.push(
      `<rect x="520" y="${yy - 13}" width="18" height="18" rx="4" fill="${color}"/>`,
      `<text x="550" y="${yy + 2}" font-size="17" fill="${INK}">${esc(clip(s.label, 24))}</text>`,
      `<text x="${W - 40}" y="${yy + 2}" font-size="17" text-anchor="end" fill="${INK}">${esc(compact(s.value))} · ${Math.round((s.value / total) * 100)}%</text>`
    );
  });
  return frame(d.title, d.subtitle, out.join("\n"));
};

// ---------- mês dia a dia: despesa acumulada vs. mês anterior ----------

export interface DailyData {
  title: string;
  subtitle: string;
  /** Acumulado por dia (índice 0 = dia 1). `null` depois de hoje. */
  current: (number | null)[];
  previous: number[];
  currentLabel: string;
  previousLabel: string;
}

export const dailySvg = (d: DailyData): string => {
  const left = 96, right = 60, top = 120, bottom = 70;
  const w = W - left - right, h = H - top - bottom;
  const days = Math.max(d.current.length, d.previous.length, 2);
  const { hi: maxV, step } = niceScale(0, Math.max(1, ...d.current.map((v) => v ?? 0), ...d.previous));
  const x = (day: number) => left + ((day - 1) / (days - 1)) * w;
  const y = (v: number) => top + ((maxV - v) / maxV) * h;
  const out: string[] = [];
  for (let v = 0; v <= maxV + step / 2; v += step) {
    out.push(
      `<line x1="${left}" y1="${num(y(v))}" x2="${W - right}" y2="${num(y(v))}" stroke="${GRID}"/>`,
      `<text x="${left - 10}" y="${num(y(v)) + 5}" font-size="14" text-anchor="end" fill="${MUTED}">${esc(compact(v))}</text>`
    );
  }
  for (let day = 1; day <= days; day++) {
    if (day === 1 || day % 5 === 0 || day === days) out.push(`<text x="${num(x(day))}" y="${H - bottom + 28}" font-size="14" text-anchor="middle" fill="${MUTED}">${day}</text>`);
  }
  const path = (vals: (number | null)[]) =>
    vals.flatMap((v, i) => (v == null ? [] : [`${num(x(i + 1))},${num(y(v))}`])).join(" ");
  if (d.previous.length > 1) out.push(`<polyline points="${path(d.previous)}" fill="none" stroke="#9CA3AF" stroke-width="3" stroke-dasharray="8 6" stroke-linejoin="round"/>`);
  const cur = path(d.current);
  if (cur.split(" ").length > 1) out.push(`<polyline points="${cur}" fill="none" stroke="${SERIES.despesas}" stroke-width="4" stroke-linejoin="round"/>`);
  const lastIdx = d.current.reduce<number>((acc, v, i) => (v == null ? acc : i), -1);
  if (lastIdx >= 0) {
    const v = d.current[lastIdx] as number;
    out.push(
      `<circle cx="${num(x(lastIdx + 1))}" cy="${num(y(v))}" r="6" fill="${SERIES.despesas}"/>`,
      `<text x="${num(Math.min(x(lastIdx + 1), W - right - 4))}" y="${num(y(v)) - 14}" font-size="15" font-weight="bold" text-anchor="end" fill="${SERIES.despesas}">${esc(compact(v))}</text>`
    );
  }
  out.push(legend([{ label: d.currentLabel, color: SERIES.despesas, line: true }, { label: d.previousLabel, color: "#9CA3AF", line: true }], W - right, 100));
  return frame(d.title, d.subtitle, out.join("\n"));
};

// ---------- ranking horizontal ----------

export interface RankData {
  title: string;
  subtitle: string;
  rows: { label: string; value: number }[];
}

export const rankingSvg = (d: RankData): string => {
  const total = d.rows.reduce((s, r) => s + r.value, 0) || 1;
  const max = Math.max(1, ...d.rows.map((r) => r.value));
  const rowH = Math.min(52, 400 / Math.max(1, d.rows.length));
  const labelW = 290, left = 40 + labelW, barMax = W - left - 200;
  const out: string[] = [];
  d.rows.forEach((r, i) => {
    const yy = 120 + i * rowH;
    const bw = Math.max(4, (r.value / max) * barMax);
    const color = CHART_COLORS[i % CHART_COLORS.length];
    out.push(
      `<text x="${left - 14}" y="${num(yy + rowH * 0.62)}" font-size="17" text-anchor="end" fill="${INK}">${esc(clip(r.label, 26))}</text>`,
      `<rect x="${left}" y="${num(yy + rowH * 0.12)}" width="${num(bw)}" height="${num(rowH * 0.62)}" rx="4" fill="${color}"/>`,
      `<text x="${num(left + bw + 10)}" y="${num(yy + rowH * 0.62)}" font-size="16" fill="${INK}">${esc(compact(r.value))} · ${Math.round((r.value / total) * 100)}%</text>`
    );
  });
  return frame(d.title, d.subtitle, out.join("\n"));
};
