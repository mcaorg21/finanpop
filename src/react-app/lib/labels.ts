// Fonte única de rótulos e enums de lançamentos (antes duplicados em Registro, Relatorios e exports).

export type TransactionType = "REVENUE" | "EXPENSE";
export type TransactionStatus = "PENDING" | "PAID" | "CANCELED";
export type PaymentMethod =
  | "PIX"
  | "CARD"
  | "CASH"
  | "BOLETO"
  | "BOLETO_DDA"
  | "TRANSFER"
  | "PIX_PARCELADO";
export type DateField = "date" | "due_date" | "payment_date";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; short: string }[] = [
  { value: "PIX", label: "Pix", short: "Pix" },
  { value: "CARD", label: "Cartão", short: "Cartão" },
  { value: "CASH", label: "Dinheiro", short: "Dinheiro" },
  { value: "BOLETO", label: "Boleto", short: "Boleto" },
  { value: "BOLETO_DDA", label: "Boleto (DDA)", short: "DDA" },
  { value: "TRANSFER", label: "Transferência", short: "Transf." },
  { value: "PIX_PARCELADO", label: "Pix Parcelado", short: "Pix Parc." },
];

export const paymentMethodLabels: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
);

export const paymentMethodLabel = (value: string | null | undefined): string =>
  value ? paymentMethodLabels[value] ?? value : "—";

export const statusLabels: Record<
  TransactionStatus,
  { label: string; variant: "outline" | "success" | "secondary" }
> = {
  PENDING: { label: "Pendente", variant: "outline" },
  PAID: { label: "Pago", variant: "success" },
  CANCELED: { label: "Cancelado", variant: "secondary" },
};

export const statusLabel = (value: string): string =>
  statusLabels[value as TransactionStatus]?.label ?? value;

export const typeLabels: Record<TransactionType, { label: string; variant: "success" | "danger" }> = {
  REVENUE: { label: "Receita", variant: "success" },
  EXPENSE: { label: "Despesa", variant: "danger" },
};

export const typeLabel = (value: string): string =>
  typeLabels[value as TransactionType]?.label ?? value;

export const dateFieldLabels: Record<DateField, string> = {
  date: "Cadastro",
  due_date: "Vencimento",
  payment_date: "Pagamento",
};

export const DATE_FIELDS = (Object.keys(dateFieldLabels) as DateField[]);

export const isDateField = (v: unknown): v is DateField =>
  typeof v === "string" && (DATE_FIELDS as string[]).includes(v);
