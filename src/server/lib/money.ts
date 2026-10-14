// Mantido em sincronia com src/react-app/lib/format.ts (o servidor não importa de src/shared).

const pad = (n: number) => String(n).padStart(2, "0");

/** Soma meses mantendo o dia, limitado ao último dia do mês de destino. */
export const addMonths = (iso: string, months: number): string => {
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12;
  const lastDay = new Date(ty, tm + 1, 0).getDate();
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(day, lastDay))}`;
};

/** Divide um total em n parcelas sem perder centavos; o resto vai para a primeira. */
export const splitCents = (total: number, n: number): number[] => {
  const count = Math.max(1, Math.floor(n));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i === 0 ? remainder : 0)) / 100);
};

export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const monthRange = (ym: string): { start: string; end: string } => {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${pad(lastDay)}` };
};

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
