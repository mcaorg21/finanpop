import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Download, FileText, Loader2, Search, X } from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { Pagination } from "@/react-app/components/ui/pagination";
import { Skeleton } from "@/react-app/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/react-app/components/ui/dropdown-menu";
import { PageHeader } from "@/react-app/components/app/PageHeader";
import { ResponsiveList, type Column } from "@/react-app/components/app/ResponsiveList";
import { StatCard } from "@/react-app/components/app/StatCard";
import { CategoryDonut } from "@/react-app/components/reports/CategoryDonut";
import { EvolutionChart } from "@/react-app/components/reports/EvolutionChart";
import { PaymentMethodList } from "@/react-app/components/reports/PaymentMethodList";
import { ReportFilters } from "@/react-app/components/reports/ReportFilters";
import { exportReportPdf } from "@/react-app/components/reports/export-pdf";
import {
  DATE_FIELD_KEY,
  buildReportParams,
  describeFilters,
  readFiltersFromSearch,
  type ReportFilterState,
} from "@/react-app/components/reports/report-params";
import { emptyTotals, type ReportData } from "@/react-app/components/reports/types";
import { useReferenceData } from "@/react-app/hooks/use-reference-data";
import { useToast } from "@/react-app/hooks/use-toast";
import { useTransactionSheet, type TransactionRecord } from "@/react-app/hooks/use-transaction-sheet";
import { exportRows } from "@/react-app/lib/export";
import { formatCurrency, formatDate, isOverdue } from "@/react-app/lib/format";
import { paymentMethodLabel, statusLabels, typeLabels } from "@/react-app/lib/labels";

const PAGE_SIZE = 25;
const DEBOUNCE_MS = 400;

export default function RelatoriosPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const homes = useReferenceData((s) => s.homes);
  const categories = useReferenceData((s) => s.categories);
  const employees = useReferenceData((s) => s.employees);
  const companies = useReferenceData((s) => s.companies);
  const loadReference = useReferenceData((s) => s.load);

  const openEdit = useTransactionSheet((s) => s.openEdit);
  const version = useTransactionSheet((s) => s.version);

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  // ── Estado na URL ─────────────────────────────────────────────
  const filters = useMemo(() => readFiltersFromSearch(searchParams), [searchParams]);
  const selectedCat = searchParams.getAll("cat");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);

  const updateSearch = (patch: Record<string, string | string[] | null>, opts: { keepPage?: boolean } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
    }
    if (!opts.keepPage) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const onFiltersChange = (patch: Partial<ReportFilterState>) => {
    const next = { ...filters, ...patch };
    if (patch.dateField) localStorage.setItem(DATE_FIELD_KEY, patch.dateField);
    updateSearch({
      preset: next.preset,
      date_field: next.dateField,
      start: next.preset === "custom" ? next.start : null,
      end: next.preset === "custom" ? next.end : null,
      home_ids: next.homeIds,
      category_ids: next.categoryIds,
      employee_id: next.employeeId || null,
      company_id: next.companyId || null,
      type: next.type || null,
      status: next.status || null,
      cat: null,
    });
  };

  const clearFilters = () =>
    updateSearch({ home_ids: null, category_ids: null, employee_id: null, company_id: null, type: null, status: null, cat: null });

  const selectedCatLabel = useMemo(() => {
    if (selectedCat.length === 0) return null;
    const byId = new Map(categories.map((c) => [String(c.id), c]));
    if (selectedCat.length === 1) {
      const c = byId.get(selectedCat[0]);
      if (!c) return null;
      const parent = c.parent_id != null ? categories.find((p) => p.id === c.parent_id) : null;
      return parent ? `${parent.name} › ${c.name}` : c.name;
    }
    const first = byId.get(selectedCat[0]);
    const parent = first?.parent_id != null ? categories.find((p) => p.id === first.parent_id) : null;
    return parent?.name ?? `${selectedCat.length} categorias`;
  }, [selectedCat, categories]);

  // ── Dados ─────────────────────────────────────────────────────
  const [report, setReport] = useState<ReportData | null>(null);
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const reportParams = buildReportParams(filters);
  const tableParams = (withPage: boolean) => {
    const p = buildReportParams(filters);
    if (selectedCat.length > 0) {
      p.delete("category_ids[]");
      selectedCat.forEach((id) => p.append("category_ids[]", id));
    }
    p.set("sort", filters.dateField === "due_date" ? "due_date_desc" : filters.dateField === "payment_date" ? "payment_date_desc" : "date_desc");
    if (withPage) {
      p.set("page", String(page));
      p.set("page_size", String(PAGE_SIZE));
    }
    return p;
  };

  const reportKey = reportParams.toString();
  const tableKey = tableParams(true).toString();

  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    const timer = setTimeout(async () => {
      try {
        const [repRes, txRes] = await Promise.all([
          fetch(`/app/api/reports?${reportKey}`, { credentials: "include" }),
          fetch(`/app/api/transactions?${tableKey}`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (!repRes.ok || !txRes.ok) throw new Error();
        const rep = (await repRes.json()) as ReportData;
        const tx = (await txRes.json()) as { items: TransactionRecord[]; total: number };
        if (cancelled) return;
        setReport(rep);
        setItems(tx.items ?? []);
        setTotal(tx.total ?? 0);
      } catch {
        if (!cancelled) toast({ title: "Erro ao carregar o relatório", variant: "destructive" });
      } finally {
        if (!cancelled) {
          setIsFetching(false);
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, tableKey, version]);

  const totals = report?.totals ?? emptyTotals;

  // ── Exports ───────────────────────────────────────────────────
  const captureRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState<"xls" | "csv" | "pdf" | null>(null);
  const filterLines = describeFilters(filters, { homes, categories, employees, companies }, selectedCatLabel);
  const filenameBase = `relatorio_${filters.start}_${filters.end}`;

  const fetchAllRows = async (): Promise<TransactionRecord[]> => {
    const res = await fetch(`/app/api/transactions?${tableParams(false)}`, { credentials: "include" });
    if (!res.ok) throw new Error();
    return res.json();
  };

  const handleExport = async (format: "xls" | "csv") => {
    setIsExporting(format);
    try {
      exportRows(await fetchAllRows(), format, filenameBase);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!captureRef.current) return;
    setIsExporting("pdf");
    try {
      const rows = await fetchAllRows();
      await exportReportPdf({
        captureEl: captureRef.current,
        filterLines,
        summaryLine: `${totals.lancamentos} lançamentos${totals.cancelados > 0 ? ` (${totals.cancelados} cancelados)` : ""} · Receitas ${formatCurrency(totals.receitas)} · Despesas ${formatCurrency(totals.despesas)} · Saldo ${formatCurrency(totals.saldo)}`,
        rows,
        filename: `${filenameBase}.pdf`,
      });
    } catch {
      toast({ title: "Erro ao exportar PDF. Tente novamente.", variant: "destructive" });
    } finally {
      setIsExporting(null);
    }
  };

  // ── Tabela ────────────────────────────────────────────────────
  const describe = (t: TransactionRecord) => t.description || t.category_name || "—";
  const amountCell = (t: TransactionRecord) => (
    <span className={cn("font-semibold tabular-nums", t.type === "REVENUE" ? "text-success" : "text-danger", t.status === "CANCELED" && "line-through opacity-60")}>
      {t.type === "REVENUE" ? "+" : "-"} {formatCurrency(t.amount)}
    </span>
  );

  const columns: Column<TransactionRecord>[] = [
    { key: "date", header: "Data", cell: (t) => <span className="tabular-nums">{formatDate(t.date)}</span> },
    {
      key: "due",
      header: "Vencimento",
      cell: (t) => (
        <span className={cn("tabular-nums", isOverdue(t.due_date, t.status) && "text-danger")}>{t.due_date ? formatDate(t.due_date) : "—"}</span>
      ),
    },
    { key: "type", header: "Tipo", cell: (t) => <Badge variant={typeLabels[t.type].variant}>{typeLabels[t.type].label}</Badge> },
    { key: "category", header: "Categoria", className: "max-w-[200px] truncate", cell: (t) => t.category_name },
    { key: "description", header: "Descrição", className: "max-w-[240px] truncate", cell: (t) => describe(t) },
    { key: "home", header: "Centro", cell: (t) => <span className="text-muted-foreground">{t.home_name}</span> },
    { key: "company", header: "Empresa", className: "max-w-[160px] truncate", cell: (t) => <span className="text-muted-foreground">{t.company_name || "—"}</span> },
    { key: "method", header: "Forma", cell: (t) => <span className="text-muted-foreground">{paymentMethodLabel(t.payment_method)}</span> },
    { key: "status", header: "Status", cell: (t) => <Badge variant={statusLabels[t.status].variant}>{statusLabels[t.status].label}</Badge> },
    { key: "amount", header: "Valor", align: "right", cell: amountCell },
  ];

  const renderCard = (t: TransactionRecord) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={typeLabels[t.type].variant}>{typeLabels[t.type].label}</Badge>
          <span className="truncate text-sm font-medium">{describe(t)}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{t.home_name} • {t.category_name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatDate(t.date)}
          {t.due_date && <> • Venc. {formatDate(t.due_date, { year: false })}</>}
          {t.company_name && <> • {t.company_name}</>}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {amountCell(t)}
        <Badge variant={statusLabels[t.status].variant}>{statusLabels[t.status].label}</Badge>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatórios"
        description="Análise de receitas e despesas com filtros"
        actions={
          <>
            <Button variant="outline" onClick={handleExportPdf} disabled={isExporting !== null || isLoading}>
              {isExporting === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting !== null || isLoading}>
                  {isExporting === "xls" || isExporting === "csv" ? <Loader2 className="animate-spin" /> : <Download />} Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleExport("xls")}>Excel (.xls)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleExport("csv")}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <ReportFilters
        value={filters}
        onChange={onFiltersChange}
        onClear={clearFilters}
        homes={homes}
        categories={categories}
        employees={employees}
        companies={companies}
        isFetching={isFetching && !isLoading}
      />

      {/* Área capturada no PDF: KPIs + gráficos */}
      <div ref={captureRef} className="space-y-4 bg-background">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Receitas"
            tone="success"
            value={formatCurrency(totals.receitas)}
            loading={isLoading}
            hint={totals.receitas_pendentes > 0 ? `a receber ${formatCurrency(totals.receitas_pendentes)}` : undefined}
          />
          <StatCard
            label="Despesas"
            tone="danger"
            value={formatCurrency(totals.despesas)}
            loading={isLoading}
            hint={totals.despesas_pendentes > 0 ? `a pagar ${formatCurrency(totals.despesas_pendentes)}` : undefined}
          />
          <StatCard
            label="Saldo"
            tone={totals.saldo >= 0 ? "success" : "danger"}
            value={formatCurrency(totals.saldo)}
            loading={isLoading}
            hint={`realizado ${formatCurrency(totals.realizado)}`}
          />
          <StatCard
            label="A pagar"
            tone={totals.despesas_pendentes > 0 ? "warning" : "muted"}
            value={formatCurrency(totals.despesas_pendentes)}
            loading={isLoading}
            hint={totals.atrasados > 0 ? <span className="text-danger">{totals.atrasados} atrasado{totals.atrasados > 1 ? "s" : ""} · {formatCurrency(totals.atrasados_total)}</span> : undefined}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          {isLoading ? <Skeleton className="h-3 w-40" /> : (
            <>{totals.lancamentos} lançamento{totals.lancamentos === 1 ? "" : "s"}{totals.cancelados > 0 ? ` (${totals.cancelados} cancelado${totals.cancelados > 1 ? "s" : ""})` : ""} · {filterLines[0]}</>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Evolução mensal</CardTitle>
              <CardDescription>Receitas e despesas (pago e pendente) por mês</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[260px] w-full" /> : <EvolutionChart data={report?.evolution ?? []} />}
            </CardContent>
          </Card>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Por categoria</CardTitle>
              <CardDescription>Clique numa categoria para filtrar a lista abaixo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <CategoryDonut
                  rows={report?.byCategory ?? []}
                  selectedIds={selectedCat.map(Number)}
                  onSelect={(ids) => updateSearch({ cat: ids ? ids.map(String) : null })}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Por forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="lg:max-w-xl">
                <PaymentMethodList rows={report?.byPaymentMethod ?? []} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lançamentos */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Lançamentos</h2>
          {!isLoading && <span className="text-sm text-muted-foreground tabular-nums">({total})</span>}
          {selectedCatLabel && (
            <Badge variant="secondary" className="h-6 gap-1 pr-1">
              Categoria: {selectedCatLabel}
              <button type="button" aria-label="Remover filtro de categoria" onClick={() => updateSearch({ cat: null })} className="rounded p-0.5 hover:bg-background/60">
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>
        <ResponsiveList
          rows={items}
          columns={columns}
          rowKey={(t) => t.id}
          renderCard={renderCard}
          isLoading={isLoading}
          onRowClick={(t) => openEdit(t)}
          rowClassName={(t) => cn(t.status === "CANCELED" && "opacity-60")}
          emptyState={<EmptyState icon={Search} title="Nenhum lançamento para os filtros" description="Ajuste o período ou limpe os filtros." />}
          footer={total > 0 ? <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => updateSearch({ page: String(p) }, { keepPage: true })} /> : undefined}
        />
      </div>
    </div>
  );
}
