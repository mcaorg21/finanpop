import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  CheckCircle2,
  Copy,
  Download,
  Filter,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/react-app/components/ui/input-group";
import { Label } from "@/react-app/components/ui/label";
import { Pagination } from "@/react-app/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/react-app/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/react-app/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/react-app/components/ui/dropdown-menu";
import { MonthNavigator } from "@/react-app/components/app/MonthNavigator";
import { MultiSelectPopover } from "@/react-app/components/app/MultiSelectPopover";
import { PageHeader } from "@/react-app/components/app/PageHeader";
import { ResponsiveList, type Column } from "@/react-app/components/app/ResponsiveList";
import { RowActionsMenu } from "@/react-app/components/app/RowActionsMenu";
import { StatCard } from "@/react-app/components/app/StatCard";
import { useAlert } from "@/react-app/hooks/use-alert";
import { useToast } from "@/react-app/hooks/use-toast";
import { useReferenceData } from "@/react-app/hooks/use-reference-data";
import { useTransactionSheet, type TransactionRecord } from "@/react-app/hooks/use-transaction-sheet";
import { exportRows } from "@/react-app/lib/export";
import { currentMonth, formatCurrency, formatDate, formatMonthLabel, isOverdue } from "@/react-app/lib/format";
import {
  PAYMENT_METHODS,
  dateFieldLabels,
  isDateField,
  paymentMethodLabel,
  statusLabels,
  typeLabels,
  type DateField,
} from "@/react-app/lib/labels";

const PAGE_SIZE = 25;
const DATE_FIELD_KEY = "finanpop_lancamentos_date_field";
const ALL = "ALL";
const isMonth = (v: string | null): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

interface Summary {
  receitas: number;
  despesas: number;
  saldo: number;
  receitas_pendentes: number;
  despesas_pendentes: number;
  atrasados: number;
  atrasados_total: number;
}

const emptySummary: Summary = {
  receitas: 0, despesas: 0, saldo: 0, receitas_pendentes: 0, despesas_pendentes: 0, atrasados: 0, atrasados_total: 0,
};

export default function RegistroPage() {
  const { toast } = useToast();
  const { confirm } = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();

  const categories = useReferenceData((s) => s.categories);
  const homes = useReferenceData((s) => s.homes);
  const loadReference = useReferenceData((s) => s.load);

  const openCreate = useTransactionSheet((s) => s.openCreate);
  const openEdit = useTransactionSheet((s) => s.openEdit);
  const openDuplicate = useTransactionSheet((s) => s.openDuplicate);
  const notifySaved = useTransactionSheet((s) => s.notifySaved);
  const version = useTransactionSheet((s) => s.version);

  // ── Estado na URL ─────────────────────────────────────────────
  const month = isMonth(searchParams.get("month")) ? searchParams.get("month")! : currentMonth();
  const dateField: DateField = (() => {
    const fromUrl = searchParams.get("date_field");
    if (isDateField(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(DATE_FIELD_KEY);
    return isDateField(saved) ? saved : "date";
  })();
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const status = searchParams.get("status") ?? "";
  const paymentMethod = searchParams.get("payment_method") ?? "";
  const categoryIds = searchParams.getAll("category_ids");
  const homeIds = searchParams.getAll("home_ids");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);

  const update = (patch: Record<string, string | string[] | null>, opts: { keepPage?: boolean } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
    }
    if (!opts.keepPage) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const setDateField = (v: DateField) => {
    localStorage.setItem(DATE_FIELD_KEY, v);
    update({ date_field: v });
  };

  // ── Busca com debounce ────────────────────────────────────────
  const [searchText, setSearchText] = useState(q);
  useEffect(() => setSearchText(q), [q]);
  useEffect(() => {
    if (searchText === q) return;
    const t = setTimeout(() => update({ q: searchText.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // ── Dados ─────────────────────────────────────────────────────
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);

  const buildParams = (withPage: boolean) => {
    const p = new URLSearchParams();
    p.set("month", month);
    p.set("date_field", dateField);
    if (q) p.set("q", q);
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    if (paymentMethod) p.set("payment_method", paymentMethod);
    categoryIds.forEach((id) => p.append("category_ids[]", id));
    homeIds.forEach((id) => p.append("home_ids[]", id));
    p.set("sort", dateField === "due_date" ? "due_date_desc" : dateField === "payment_date" ? "payment_date_desc" : "date_desc");
    if (withPage) {
      p.set("page", String(page));
      p.set("page_size", String(PAGE_SIZE));
    }
    return p;
  };

  const filterKey = [month, dateField, q, type, status, paymentMethod, categoryIds.join(","), homeIds.join(","), page].join("|");

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(`/app/api/transactions?${buildParams(true)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setSummary({ ...emptySummary, ...(data.summary ?? {}) });
      })
      .catch(() => {
        if (!cancelled) toast({ title: "Erro ao carregar lançamentos", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, version]);

  // ── Ações ─────────────────────────────────────────────────────
  const markPaid = async (t: TransactionRecord) => {
    try {
      const res = await fetch(`/app/api/transactions/${t.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Marcado como pago" });
      notifySaved();
    } catch {
      toast({ title: "Erro ao atualizar lançamento", variant: "destructive" });
    }
  };

  const remove = async (t: TransactionRecord) => {
    const ok = await confirm({
      title: "Excluir lançamento?",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/app/api/transactions/${t.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "Lançamento excluído" });
      notifySaved();
    } catch {
      toast({ title: "Erro ao excluir lançamento", variant: "destructive" });
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: "xls" | "csv") => {
    setIsExporting(true);
    try {
      const res = await fetch(`/app/api/transactions?${buildParams(false)}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const rows = await res.json();
      exportRows(rows, format, `lancamentos_${month}`);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const actionsFor = (t: TransactionRecord) => [
    { label: "Editar", icon: Pencil, onSelect: () => openEdit(t) },
    { label: "Duplicar", icon: Copy, onSelect: () => openDuplicate(t) },
    { label: "Marcar como pago", icon: CheckCircle2, onSelect: () => markPaid(t), hidden: t.status !== "PENDING" },
    { label: "Anexos", icon: Paperclip, onSelect: () => openEdit(t, { expandDetails: true }) },
    { label: "Excluir", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => remove(t) },
  ];

  // ── Opções de filtro ──────────────────────────────────────────
  const categoryOptions = useMemo(() => {
    const parents = categories.filter((c) => c.parent_id == null);
    const out: { value: string; label: string; indent?: boolean }[] = [];
    for (const p of parents.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
      out.push({ value: String(p.id), label: p.name });
      categories
        .filter((c) => c.parent_id === p.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .forEach((c) => out.push({ value: String(c.id), label: c.name, indent: true }));
    }
    return out;
  }, [categories]);
  const homeOptions = useMemo(() => homes.map((h) => ({ value: String(h.id), label: h.name })), [homes]);

  const activeFilters = [type, status, paymentMethod].filter(Boolean).length + (categoryIds.length ? 1 : 0) + (homeIds.length ? 1 : 0);
  const hasAnyFilter = activeFilters > 0 || !!q;
  const clearFilters = () => update({ type: null, status: null, payment_method: null, category_ids: null, home_ids: null, q: null });

  // ── Colunas ───────────────────────────────────────────────────
  const describe = (t: TransactionRecord) => t.description || t.category_name || "—";
  const amountCell = (t: TransactionRecord) => (
    <span className={cn("font-semibold tabular-nums", t.type === "REVENUE" ? "text-success" : "text-danger", t.status === "CANCELED" && "line-through opacity-60")}>
      {t.type === "REVENUE" ? "+" : "-"} {formatCurrency(t.amount)}
    </span>
  );
  const groupTag = (t: TransactionRecord) =>
    t.group_index && t.group_count && t.group_count > 1 ? (
      <span className="rounded border border-border px-1 text-[10px] text-muted-foreground tabular-nums">{t.group_index}/{t.group_count}</span>
    ) : null;

  const columns: Column<TransactionRecord>[] = [
    { key: "date", header: "Data", cell: (t) => <span className="tabular-nums">{formatDate(t.date)}</span> },
    {
      key: "due",
      header: "Vencimento",
      cell: (t) =>
        t.due_date ? (
          <span className={cn("inline-flex items-center gap-1.5 tabular-nums", isOverdue(t.due_date, t.status) && "text-danger")}>
            {formatDate(t.due_date)}
            {isOverdue(t.due_date, t.status) && <Badge variant="danger">Atrasado</Badge>}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "type", header: "Tipo", cell: (t) => <Badge variant={typeLabels[t.type].variant}>{typeLabels[t.type].label}</Badge> },
    {
      key: "description",
      header: "Descrição",
      className: "max-w-[240px]",
      cell: (t) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate">{describe(t)}</span>
          {Number(t.attachment_count) > 0 && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />}
          {groupTag(t)}
        </span>
      ),
    },
    { key: "home", header: "Centro", cell: (t) => <span className="text-muted-foreground">{t.home_name}</span> },
    { key: "category", header: "Categoria", className: "max-w-[200px] truncate", cell: (t) => <span className="text-muted-foreground">{t.category_name}</span> },
    { key: "method", header: "Forma", cell: (t) => <span className="text-muted-foreground">{paymentMethodLabel(t.payment_method)}</span> },
    { key: "status", header: "Status", cell: (t) => <Badge variant={statusLabels[t.status].variant}>{statusLabels[t.status].label}</Badge> },
    { key: "amount", header: "Valor", align: "right", cell: amountCell },
    { key: "actions", header: "", align: "right", className: "w-12", cell: (t) => <RowActionsMenu actions={actionsFor(t)} /> },
  ];

  const renderCard = (t: TransactionRecord) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={typeLabels[t.type].variant}>{typeLabels[t.type].label}</Badge>
          <span className="truncate text-sm font-medium">{describe(t)}</span>
          {Number(t.attachment_count) > 0 && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />}
          {groupTag(t)}
        </div>
        <p className="truncate text-xs text-muted-foreground">{t.home_name} • {t.category_name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatDate(t.date)}
          {t.due_date && <> • Venc. {formatDate(t.due_date, { year: false })}</>}
          {isOverdue(t.due_date, t.status) && <span className="ml-1 font-medium text-danger">Atrasado</span>}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {amountCell(t)}
        <Badge variant={statusLabels[t.status].variant}>{statusLabels[t.status].label}</Badge>
      </div>
      <RowActionsMenu actions={actionsFor(t)} className="-mr-2" />
    </div>
  );

  const pendente = summary.receitas_pendentes + summary.despesas_pendentes;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lançamentos"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting}>
                  <Download /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleExport("xls")}>Excel (.xls)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleExport("csv")}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="hidden lg:inline-flex" onClick={() => openCreate()}>
              <Plus /> Novo lançamento
            </Button>
          </>
        }
        toolbar={
          <>
            <MonthNavigator value={month} onChange={(m) => update({ month: m })} />
            <InputGroup className="w-full sm:w-72">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar descrição, categoria, empresa..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <InputGroupAddon align="inline-end">
                  <button type="button" aria-label="Limpar busca" onClick={() => setSearchText("")}>
                    <X className="size-4" />
                  </button>
                </InputGroupAddon>
              )}
            </InputGroup>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter /> Filtros
                  {activeFilters > 0 && <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5">{activeFilters}</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(92vw,22rem)] gap-4">
                <div className="space-y-1.5">
                  <Label>Mês por</Label>
                  <ToggleGroup type="single" full size="sm" value={dateField} onValueChange={(v) => { if (isDateField(v)) setDateField(v); }}>
                    {(Object.keys(dateFieldLabels) as DateField[]).map((f) => (
                      <ToggleGroupItem key={f} value={f}>{dateFieldLabels[f]}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <ToggleGroup type="single" full size="sm" value={type || ALL} onValueChange={(v) => { if (v) update({ type: v === ALL ? null : v }); }}>
                    <ToggleGroupItem value={ALL}>Todos</ToggleGroupItem>
                    <ToggleGroupItem value="EXPENSE">Despesas</ToggleGroupItem>
                    <ToggleGroupItem value="REVENUE">Receitas</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <ToggleGroup type="single" full size="sm" value={status || ALL} onValueChange={(v) => { if (v) update({ status: v === ALL ? null : v }); }}>
                    <ToggleGroupItem value={ALL}>Todos</ToggleGroupItem>
                    <ToggleGroupItem value="PENDING">Pendente</ToggleGroupItem>
                    <ToggleGroupItem value="PAID">Pago</ToggleGroupItem>
                    <ToggleGroupItem value="CANCELED">Cancel.</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
                  <Select value={paymentMethod || ALL} onValueChange={(v) => update({ payment_method: v === ALL ? null : v })}>
                    <SelectTrigger className="w-full" size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todas</SelectItem>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Categorias</Label>
                  <MultiSelectPopover size="sm" options={categoryOptions} value={categoryIds} onChange={(v) => update({ category_ids: v })} placeholder="Todas" />
                </div>
                <div className="space-y-1.5">
                  <Label>Centros de custo</Label>
                  <MultiSelectPopover size="sm" options={homeOptions} value={homeIds} onChange={(v) => update({ home_ids: v })} placeholder="Todos" searchable={false} />
                </div>
                {hasAnyFilter && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
                )}
              </PopoverContent>
            </Popover>
          </>
        }
      />

      {activeFilters > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {type && <FilterChip label={typeLabels[type as "REVENUE" | "EXPENSE"]?.label ?? type} onRemove={() => update({ type: null })} />}
          {status && <FilterChip label={statusLabels[status as keyof typeof statusLabels]?.label ?? status} onRemove={() => update({ status: null })} />}
          {paymentMethod && <FilterChip label={paymentMethodLabel(paymentMethod)} onRemove={() => update({ payment_method: null })} />}
          {categoryIds.length > 0 && <FilterChip label={`${categoryIds.length} categoria${categoryIds.length > 1 ? "s" : ""}`} onRemove={() => update({ category_ids: null })} />}
          {homeIds.length > 0 && <FilterChip label={`${homeIds.length} centro${homeIds.length > 1 ? "s" : ""}`} onRemove={() => update({ home_ids: null })} />}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Receitas" tone="success" value={formatCurrency(summary.receitas)} loading={isLoading} hint={summary.receitas_pendentes > 0 ? `a receber ${formatCurrency(summary.receitas_pendentes)}` : undefined} />
        <StatCard label="Despesas" tone="danger" value={formatCurrency(summary.despesas)} loading={isLoading} hint={summary.despesas_pendentes > 0 ? `a pagar ${formatCurrency(summary.despesas_pendentes)}` : undefined} />
        <StatCard label="Saldo" tone={summary.saldo >= 0 ? "success" : "danger"} value={formatCurrency(summary.saldo)} loading={isLoading} />
        <StatCard
          label="Pendente"
          tone={pendente > 0 ? "warning" : "muted"}
          value={formatCurrency(pendente)}
          loading={isLoading}
          hint={summary.atrasados > 0 ? <span className="text-danger">{summary.atrasados} atrasado{summary.atrasados > 1 ? "s" : ""} · {formatCurrency(summary.atrasados_total)}</span> : undefined}
          onClick={status !== "PENDING" ? () => update({ status: "PENDING" }) : undefined}
        />
      </div>

      <ResponsiveList
        rows={items}
        columns={columns}
        rowKey={(t) => t.id}
        renderCard={renderCard}
        isLoading={isLoading}
        rowClassName={(t) => cn(t.status === "CANCELED" && "opacity-60", isOverdue(t.due_date, t.status) && "border-l-2 border-l-danger")}
        emptyState={
          hasAnyFilter ? (
            <EmptyState icon={Search} title="Nenhum resultado para os filtros" description="Ajuste a busca ou limpe os filtros." action={<Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>} />
          ) : (
            <EmptyState icon={Receipt} title={`Nenhum lançamento em ${formatMonthLabel(month)}`} description="Registre a primeira receita ou despesa deste mês." action={<Button size="sm" onClick={() => openCreate()}><Plus /> Novo lançamento</Button>} />
          )
        }
        footer={total > 0 ? <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => update({ page: String(p) }, { keepPage: true })} /> : undefined}
      />
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="h-6 gap-1 pr-1">
      {label}
      <button type="button" aria-label={`Remover filtro ${label}`} onClick={onRemove} className="rounded p-0.5 hover:bg-background/60">
        <X className="size-3" />
      </button>
    </Badge>
  );
}
