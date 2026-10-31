// Períodos de consulta do assistente do WhatsApp ("essa semana", "mês passado", "até hoje"...).
// Tudo é calculado em America/Sao_Paulo a partir de um "hoje" passado como parâmetro: o servidor e o banco
// rodam em UTC no Railway, então CURRENT_DATE / new Date() local erram à noite.

const TZ = "America/Sao_Paulo";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MAX_DAYS = 366 * 5;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export const todaySP = (now: Date = new Date()): string => now.toLocaleDateString("en-CA", { timeZone: TZ });

const pad = (n: number) => String(n).padStart(2, "0");
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);

export const addDays = (iso: string, days: number): string => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
};

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
};
const shiftMonth = (iso: string, months: number) => {
  const [y, m] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  return `${ty}-${pad(total - ty * 12 + 1)}-01`;
};
/** Segunda-feira da semana de `iso` (a semana vai de segunda a domingo). */
const weekStart = (iso: string) => addDays(iso, -((parse(iso).getUTCDay() + 6) % 7));

export const brDay = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
export const brFull = (iso: string) => `${brDay(iso)}/${iso.slice(0, 4)}`;
const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;

export type PeriodPreset =
  | "today" | "yesterday" | "tomorrow" | "next_7_days" | "next_30_days" | "this_week" | "last_week" | "last_7_days" | "last_30_days"
  | "this_month" | "last_month" | "this_year" | "last_year" | "all_time" | "month" | "custom";

export const PERIOD_PRESETS: PeriodPreset[] = [
  "today", "yesterday", "tomorrow", "next_7_days", "next_30_days", "this_week", "last_week", "last_7_days", "last_30_days",
  "this_month", "last_month", "this_year", "last_year", "all_time", "month", "custom",
];

export interface PeriodSpec {
  preset: PeriodPreset;
  /** YYYY-MM, para preset "month". */
  month?: string | null;
  /** YYYY-MM-DD, para preset "custom". */
  start?: string | null;
  end?: string | null;
}

export interface Period {
  preset: PeriodPreset;
  start: string;
  end: string;
  /** Texto para as respostas, ex.: "esta semana (02/11 a 08/11)". */
  label: string;
  /** O período inclui o dia de hoje e ainda não terminou. */
  inProgress: boolean;
}

const isISODate = (v: unknown): v is string => typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(v));
const isYearMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

const range = (preset: PeriodPreset, start: string, end: string, label: string, today: string): Period => ({
  preset,
  start,
  end,
  label,
  inProgress: start <= today && end >= today && preset !== "all_time" && !["last_7_days", "last_30_days", "today", "next_7_days", "next_30_days", "tomorrow"].includes(preset),
});

/** Converte a escolha do LLM em datas reais. Preset inválido vira "este mês". */
export const resolvePeriod = (spec: PeriodSpec | null | undefined, today: string): Period => {
  const preset = spec && PERIOD_PRESETS.includes(spec.preset) ? spec.preset : "this_month";
  switch (preset) {
    case "today":
      return range(preset, today, today, `hoje (${brDay(today)})`, today);
    case "yesterday": {
      const y = addDays(today, -1);
      return range(preset, y, y, `ontem (${brDay(y)})`, today);
    }
    case "tomorrow": {
      const t = addDays(today, 1);
      return range(preset, t, t, `amanhã (${brDay(t)})`, today);
    }
    case "next_7_days":
      return range(preset, today, addDays(today, 6), `próximos 7 dias (até ${brDay(addDays(today, 6))})`, today);
    case "next_30_days":
      return range(preset, today, addDays(today, 29), `próximos 30 dias (até ${brDay(addDays(today, 29))})`, today);
    case "this_week": {
      const s = weekStart(today);
      return range(preset, s, addDays(s, 6), `esta semana (${brDay(s)} a ${brDay(addDays(s, 6))})`, today);
    }
    case "last_week": {
      const s = addDays(weekStart(today), -7);
      return range(preset, s, addDays(s, 6), `semana passada (${brDay(s)} a ${brDay(addDays(s, 6))})`, today);
    }
    case "last_7_days":
      return range(preset, addDays(today, -6), today, "últimos 7 dias", today);
    case "last_30_days":
      return range(preset, addDays(today, -29), today, "últimos 30 dias", today);
    case "this_month":
      return range(preset, monthStart(today), monthEnd(today), `este mês (${monthLabel(today)})`, today);
    case "last_month": {
      const s = shiftMonth(today, -1);
      return range(preset, s, monthEnd(s), `mês passado (${monthLabel(s)})`, today);
    }
    case "this_year": {
      const y = today.slice(0, 4);
      return range(preset, `${y}-01-01`, `${y}-12-31`, `este ano (${y})`, today);
    }
    case "last_year": {
      const y = String(Number(today.slice(0, 4)) - 1);
      return range(preset, `${y}-01-01`, `${y}-12-31`, `ano passado (${y})`, today);
    }
    case "all_time":
      return range(preset, "1970-01-01", today, "do início até hoje", today);
    case "month": {
      if (!isYearMonth(spec?.month)) return resolvePeriod({ preset: "this_month" }, today);
      const s = `${spec!.month}-01`;
      return range(preset, s, monthEnd(s), monthLabel(s), today);
    }
    case "custom": {
      if (!isISODate(spec?.start) || !isISODate(spec?.end)) return resolvePeriod({ preset: "this_month" }, today);
      let [s, e] = spec!.start! <= spec!.end! ? [spec!.start!, spec!.end!] : [spec!.end!, spec!.start!];
      if (diffDays(s, e) > MAX_DAYS) s = addDays(e, -MAX_DAYS);
      return range(preset, s, e, s === e ? brFull(s) : `${brFull(s)} a ${brFull(e)}`, today);
    }
  }
};

/**
 * Período imediatamente anterior, para a variação ("▲ 12% vs ..."). Mês e ano comparam com o mês/ano anterior;
 * os demais com a janela de mesma duração logo antes. Se o período atual ainda está em andamento, o anterior
 * é cortado nos mesmos dias já decorridos (comparar meio mês com um mês inteiro enganaria).
 */
export const previousPeriod = (p: Period, today: string): Period | null => {
  if (p.preset === "all_time") return null;
  let start: string;
  let end: string;
  let label: string;
  if (["this_month", "last_month", "month"].includes(p.preset)) {
    start = shiftMonth(p.start, -1);
    end = monthEnd(start);
    label = monthLabel(start);
  } else if (["this_year", "last_year"].includes(p.preset)) {
    const y = String(Number(p.start.slice(0, 4)) - 1);
    start = `${y}-01-01`;
    end = `${y}-12-31`;
    label = y;
  } else {
    const len = diffDays(p.start, p.end) + 1;
    start = addDays(p.start, -len);
    end = addDays(p.start, -1);
    label = "";
  }
  if (p.inProgress) {
    const elapsed = diffDays(p.start, today);
    const cut = addDays(start, elapsed);
    if (cut < end) {
      end = cut;
      label = label ? `${label}, até ${brDay(end)}` : "";
    }
  }
  if (!label) label = start === end ? brDay(start) : `${brDay(start)} a ${brDay(end)}`;
  return { preset: p.preset, start, end, label, inProgress: false };
};

/** Lista de meses (YYYY-MM) terminando no mês de `today`, do mais antigo ao mais recente. */
export const lastMonths = (today: string, count: number): string[] => {
  const n = Math.min(24, Math.max(1, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => shiftMonth(today, i - (n - 1)).slice(0, 7));
};

export const monthShort = (ym: string): string => `${MONTHS[Number(ym.slice(5, 7)) - 1].slice(0, 3)}/${ym.slice(2, 4)}`;
export const monthEndOf = monthEnd;
