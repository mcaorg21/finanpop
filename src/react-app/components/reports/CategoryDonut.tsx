import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/react-app/lib/utils";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { Label } from "@/react-app/components/ui/label";
import { Switch } from "@/react-app/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/react-app/components/ui/toggle-group";
import { chartColor } from "@/react-app/lib/chart-colors";
import { formatCurrency } from "@/react-app/lib/format";
import { TopCategoriesList, type CategorySlice } from "./TopCategoriesList";
import type { CategoryTotal } from "./types";

const TOP_N = 8;

/** Monta as fatias: top-N + "Outros", opcionalmente somando as filhas no pai. */
export function buildSlices(rows: CategoryTotal[], type: "REVENUE" | "EXPENSE", groupByParent: boolean): { slices: CategorySlice[]; total: number; parentIds: Map<number, number[]> } {
  const filtered = rows.filter((r) => r.type === type && r.value > 0);
  const parentIds = new Map<number, number[]>();
  const agg = new Map<number, { name: string; value: number }>();
  for (const r of filtered) {
    const id = groupByParent && r.parent_id != null ? r.parent_id : r.category_id;
    const name = groupByParent && r.parent_id != null ? r.parent_name ?? r.name : r.parent_name ? `${r.parent_name} › ${r.name}` : r.name;
    const cur = agg.get(id) ?? { name, value: 0 };
    cur.value += r.value;
    agg.set(id, cur);
    const members = parentIds.get(id) ?? [];
    members.push(r.category_id);
    parentIds.set(id, members);
  }
  const sorted = [...agg.entries()].sort((a, b) => b[1].value - a[1].value);
  const total = sorted.reduce((s, [, v]) => s + v.value, 0);
  const top = sorted.slice(0, TOP_N).map(([id, v], i) => ({ id, name: v.name, value: v.value, color: chartColor(i) }));
  const rest = sorted.slice(TOP_N);
  const slices: CategorySlice[] = top;
  if (rest.length > 0) {
    slices.push({ id: null, name: `Outros (${rest.length})`, value: rest.reduce((s, [, v]) => s + v.value, 0), color: "#C4C8CF" });
  }
  return { slices, total, parentIds };
}

/**
 * Donut por categoria com abas Despesas | Receitas, sem rótulos dentro do gráfico
 * (a legenda é a lista ao lado/abaixo, que também filtra a tabela).
 */
export function CategoryDonut({
  rows,
  selectedIds,
  onSelect,
  className,
}: {
  rows: CategoryTotal[];
  /** ids de categoria atualmente selecionados (um pai selecionado = seus filhos). */
  selectedIds: number[];
  onSelect: (ids: number[] | null, label: string | null) => void;
  className?: string;
}) {
  const hasExpense = rows.some((r) => r.type === "EXPENSE" && r.value > 0);
  const hasRevenue = rows.some((r) => r.type === "REVENUE" && r.value > 0);
  const [type, setType] = useState<"REVENUE" | "EXPENSE">(hasExpense || !hasRevenue ? "EXPENSE" : "REVENUE");
  const [groupByParent, setGroupByParent] = useState(false);

  useEffect(() => {
    if (type === "EXPENSE" && !hasExpense && hasRevenue) setType("REVENUE");
    if (type === "REVENUE" && !hasRevenue && hasExpense) setType("EXPENSE");
  }, [hasExpense, hasRevenue, type]);

  const { slices, total, parentIds } = useMemo(() => buildSlices(rows, type, groupByParent), [rows, type, groupByParent]);

  const selectedSliceId = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const key = selectedIds.slice().sort().join(",");
    for (const [id, members] of parentIds) {
      if (members.slice().sort().join(",") === key) return id;
    }
    return null;
  }, [selectedIds, parentIds]);

  const handleSelect = (id: number | null) => {
    if (id == null) { onSelect(null, null); return; }
    const slice = slices.find((s) => s.id === id);
    onSelect(parentIds.get(id) ?? [id], slice?.name ?? null);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup type="single" size="sm" value={type} onValueChange={(v) => { if (v === "EXPENSE" || v === "REVENUE") setType(v); }}>
          <ToggleGroupItem value="EXPENSE" disabled={!hasExpense}>Despesas</ToggleGroupItem>
          <ToggleGroupItem value="REVENUE" disabled={!hasRevenue}>Receitas</ToggleGroupItem>
        </ToggleGroup>
        <label className="flex cursor-pointer items-center gap-2">
          <Switch size="sm" checked={groupByParent} onCheckedChange={setGroupByParent} />
          <Label className="cursor-pointer text-xs font-normal text-muted-foreground">Agrupar por categoria pai</Label>
        </label>
      </div>

      {slices.length === 0 ? (
        <EmptyState compact title="Sem dados para o período" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[200px_1fr] lg:items-center">
          <div className="relative mx-auto h-[200px] w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={1.5}
                  stroke="none"
                  isAnimationActive={false}
                  onClick={(_, index) => handleSelect(slices[index]?.id ?? null)}
                  style={{ cursor: "pointer" }}
                >
                  {slices.map((s) => (
                    <Cell
                      key={s.id ?? "others"}
                      fill={s.color}
                      opacity={selectedSliceId != null && selectedSliceId !== s.id ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#E5E7EB" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
          <TopCategoriesList slices={slices} total={total} selectedId={selectedSliceId} onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
}
