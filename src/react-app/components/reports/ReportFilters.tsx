import { useMemo } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/react-app/components/ui/toggle-group";
import { MultiSelectPopover } from "@/react-app/components/app/MultiSelectPopover";
import type { Category, Company, Employee, Home } from "@/react-app/hooks/use-reference-data";
import { DATE_FIELDS, dateFieldLabels, isDateField } from "@/react-app/lib/labels";
import { PRESETS, hasDimensionFilters, isPreset, presetRange, type ReportFilterState } from "./report-params";

const ALL = "ALL";

/** Filtros do relatório: uma única marcação responsiva, aplicação automática. */
export function ReportFilters({
  value,
  onChange,
  onClear,
  homes,
  categories,
  employees,
  companies,
  isFetching = false,
}: {
  value: ReportFilterState;
  onChange: (patch: Partial<ReportFilterState>) => void;
  onClear: () => void;
  homes: Home[];
  categories: Category[];
  employees: Employee[];
  companies: Company[];
  isFetching?: boolean;
}) {
  const categoryOptions = useMemo(() => {
    const parents = categories.filter((c) => c.parent_id == null).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const out: { value: string; label: string; indent?: boolean }[] = [];
    for (const p of parents) {
      out.push({ value: String(p.id), label: p.name });
      categories
        .filter((c) => c.parent_id === p.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .forEach((c) => out.push({ value: String(c.id), label: c.name, indent: true }));
    }
    return out;
  }, [categories]);
  const homeOptions = useMemo(() => homes.map((h) => ({ value: String(h.id), label: h.name })), [homes]);

  const setPreset = (v: string) => {
    if (!isPreset(v)) return;
    if (v === "custom") onChange({ preset: v });
    else onChange({ preset: v, ...presetRange(v) });
  };

  return (
    <Card size="sm" className="gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-0.5">
          <ToggleGroup type="single" size="sm" value={value.preset} onValueChange={setPreset}>
            {PRESETS.map((p) => (
              <ToggleGroupItem key={p.value} value={p.value}>{p.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Data de</span>
          <ToggleGroup type="single" size="sm" value={value.dateField} onValueChange={(v) => { if (isDateField(v)) onChange({ dateField: v }); }}>
            {DATE_FIELDS.map((f) => (
              <ToggleGroupItem key={f} value={f}>{dateFieldLabels[f]}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isFetching && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Atualizando…
            </span>
          )}
          {hasDimensionFilters(value) && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <X /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">{dateFieldLabels[value.dateField]} de</Label>
          <Input type="date" className="h-9 md:h-8" value={value.start} max={value.end || undefined} onChange={(e) => onChange({ preset: "custom", start: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{dateFieldLabels[value.dateField]} até</Label>
          <Input type="date" className="h-9 md:h-8" value={value.end} min={value.start || undefined} onChange={(e) => onChange({ preset: "custom", end: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Centros de custo</Label>
          <MultiSelectPopover size="sm" options={homeOptions} value={value.homeIds} onChange={(v) => onChange({ homeIds: v })} placeholder="Todos" searchable={false} className="h-9 md:h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categorias</Label>
          <MultiSelectPopover size="sm" options={categoryOptions} value={value.categoryIds} onChange={(v) => onChange({ categoryIds: v })} placeholder="Todas" className="h-9 md:h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Funcionário</Label>
          <Select value={value.employeeId || ALL} onValueChange={(v) => onChange({ employeeId: v === ALL ? "" : v })}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Empresa</Label>
          <Select value={value.companyId || ALL} onValueChange={(v) => onChange({ companyId: v === ALL ? "" : v })}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={value.type || ALL} onValueChange={(v) => onChange({ type: v === ALL ? "" : v })}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="EXPENSE">Despesas</SelectItem>
              <SelectItem value="REVENUE">Receitas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={value.status || ALL} onValueChange={(v) => onChange({ status: v === ALL ? "" : v })}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="PAID">Pago</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="CANCELED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
