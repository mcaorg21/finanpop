import { cn } from "@/react-app/lib/utils";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { SERIES_COLORS } from "@/react-app/lib/chart-colors";
import { formatCurrency } from "@/react-app/lib/format";
import { paymentMethodLabel } from "@/react-app/lib/labels";
import type { PaymentMethodTotal } from "./types";

function Group({ title, rows, color }: { title: string; rows: PaymentMethodTotal[]; color: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {rows.map((r) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        return (
          <div key={r.payment_method} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{paymentMethodLabel(r.payment_method)}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{formatCurrency(r.value)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PaymentMethodList({ rows, className }: { rows: PaymentMethodTotal[]; className?: string }) {
  const expenses = rows.filter((r) => r.type === "EXPENSE" && r.value > 0);
  const revenues = rows.filter((r) => r.type === "REVENUE" && r.value > 0);
  if (expenses.length === 0 && revenues.length === 0) {
    return <EmptyState compact title="Sem dados para o período" className={className} />;
  }
  return (
    <div className={cn("space-y-4", className)}>
      <Group title="Despesas" rows={expenses} color={SERIES_COLORS.despesas} />
      <Group title="Receitas" rows={revenues} color={SERIES_COLORS.receitas} />
    </div>
  );
}
