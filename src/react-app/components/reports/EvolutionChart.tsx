import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/react-app/lib/utils";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { SERIES_COLORS } from "@/react-app/lib/chart-colors";
import { formatCompactBRL, formatCurrency, formatMonthLabel, shiftMonth } from "@/react-app/lib/format";
import type { EvolutionPoint } from "./types";

const SERIES = [
  { key: "receitas_pagas", name: "Receitas", color: SERIES_COLORS.receitas, stack: "r" },
  { key: "receitas_pendentes", name: "A receber", color: SERIES_COLORS.receitasPendentes, stack: "r" },
  { key: "despesas_pagas", name: "Despesas pagas", color: SERIES_COLORS.despesas, stack: "d" },
  { key: "despesas_pendentes", name: "A pagar", color: SERIES_COLORS.despesasPendentes, stack: "d" },
] as const;

/** Preenche meses sem lançamentos com zero para o eixo ficar contínuo. */
export function fillMonths(points: EvolutionPoint[], from: string, to: string): EvolutionPoint[] {
  const byMonth = new Map(points.map((p) => [p.date, p]));
  const out: EvolutionPoint[] = [];
  for (let ym = from; ym <= to; ym = shiftMonth(ym, 1)) {
    out.push(
      byMonth.get(ym) ?? {
        date: ym, receitas: 0, despesas: 0,
        receitas_pagas: 0, receitas_pendentes: 0, despesas_pagas: 0, despesas_pendentes: 0,
      }
    );
    if (out.length > 60) break;
  }
  return out;
}

/**
 * Evolução mensal em barras (receitas e despesas lado a lado, pago/pendente empilhado).
 * Legenda nativa do recharts quebra linha sozinha no celular.
 */
export function EvolutionChart({
  data,
  compact = false,
  className,
}: {
  data: EvolutionPoint[];
  compact?: boolean;
  className?: string;
}) {
  const rows = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        label: formatMonthLabel(p.date, { short: true }),
      })),
    [data]
  );

  const hasValues = rows.some((r) => r.receitas > 0 || r.despesas > 0);
  if (!hasValues) {
    return (
      <EmptyState
        compact
        title="Sem movimentação no período"
        description="Os gráficos aparecem assim que houver lançamentos."
        className={className}
      />
    );
  }

  return (
    <div className={cn("flex w-full flex-col", compact ? "h-[240px] lg:h-full lg:min-h-[240px]" : "h-[280px] sm:h-[340px]", className)}>
      <ResponsiveContainer width="100%" height="100%" className="min-h-0 flex-1">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            interval={compact ? 0 : "preserveStartEnd"}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactBRL(v)}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
            labelFormatter={(label) => String(label)}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#E5E7EB" }}
          />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId={s.stack} fill={s.color} radius={0} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {/* legenda própria: quebra linha no celular e mantém a ordem das séries */}
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
