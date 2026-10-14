// Formatadores e helpers de data/dinheiro compartilhados por toda a área interna.
// Datas no app são strings "YYYY-MM-DD" (DATE do Postgres) — nunca Date com fuso.

const pad = (n: number) => String(n).padStart(2, "0");

// ───────────── dinheiro ─────────────

export const formatCurrency = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

/** Versão curta para eixos de gráfico: R$ 1,2k · R$ 3,4M */
export const formatCompactBRL = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const fmt = (n: number, digits = 1) =>
    n.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) return `${sign}R$ ${fmt(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}R$ ${fmt(abs / 1_000)}k`;
  return `${sign}R$ ${fmt(abs, 0)}`;
};

/** Máscara de centavos para input: "123456" -> "1.234,56" */
export const formatInputCurrency = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  const cents = parseInt(numbers, 10);
  const reais = (cents / 100).toFixed(2);
  const [intPart, decPart] = reais.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedInt},${decPart}`;
};

/** "1.234,56" -> 1234.56 (0 quando vazio) */
export const parseCurrencyToNumber = (value: string): number => {
  if (!value) return 0;
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return 0;
  return parseInt(numbers, 10) / 100;
};

/** number -> valor mascarado para preencher o input ("1234.56" -> "1.234,56") */
export const numberToInputCurrency = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "";
  return formatInputCurrency(Math.round(n * 100).toString());
};

/** Divide um total em n parcelas sem perder centavos; o resto vai para a primeira. */
export const splitCents = (total: number, n: number): number[] => {
  const count = Math.max(1, Math.floor(n));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i === 0 ? remainder : 0)) / 100);
};

// ───────────── datas ─────────────

export const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Hoje no fuso local (não usa toISOString, que vira amanhã depois das 21h no Brasil). */
export const todayISO = (): string => toISODate(new Date());

export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/** Soma meses mantendo o dia, limitado ao último dia do mês de destino (31/01 + 1 = 28/02). */
export const addMonths = (iso: string, months: number): string => {
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12; // 0-based
  const lastDay = new Date(ty, tm + 1, 0).getDate();
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(day, lastDay))}`;
};

export const formatDate = (
  iso: string | null | undefined,
  opts?: { year?: "numeric" | "2-digit" | false }
): string => {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  if (opts?.year === false) return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: opts?.year ?? "numeric" });
};

/** Pendente com vencimento ANTES de hoje (vencer hoje ainda não é atraso). */
export const isOverdue = (dueDate: string | null | undefined, status: string): boolean =>
  status === "PENDING" && !!dueDate && dueDate.slice(0, 10) < todayISO();

// ───────────── meses (YYYY-MM) ─────────────

export const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const currentMonth = (): string => todayISO().slice(0, 7);

export const shiftMonth = (ym: string, delta: number): string => {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ty = Math.floor(total / 12);
  return `${ty}-${pad(total - ty * 12 + 1)}`;
};

export const monthRange = (ym: string): { start: string; end: string } => {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${pad(lastDay)}` };
};

/** "2026-10" -> "Outubro 2026" (ou "out/26" com short) */
export const formatMonthLabel = (ym: string, opts?: { short?: boolean }): string => {
  const [y, m] = ym.split("-").map(Number);
  const name = MONTHS_PT[m - 1] ?? "";
  if (opts?.short) return `${name.slice(0, 3)}/${String(y).slice(-2)}`;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
};

// ───────────── máscaras ─────────────

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  let weight = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weight[i];
  let remainder = sum % 11;
  const checkDigit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12]) !== checkDigit1) return false;

  sum = 0;
  weight = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weight[i];
  remainder = sum % 11;
  const checkDigit2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(digits[13]) === checkDigit2;
}

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

export function formatCEP(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}

/** Iniciais para avatar: "Marcelo Amancio" -> "MA" */
export const initials = (name: string | null | undefined): string =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

// ───────────── anexos ─────────────

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileTypeLabel = (contentType: string): string => {
  if (contentType.startsWith("image/")) return "IMG";
  if (contentType === "application/pdf") return "PDF";
  return "DOC";
};
