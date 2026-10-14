import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, Clock, Plus, Receipt } from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { EmptyState } from "@/react-app/components/ui/empty-state";
import { Skeleton } from "@/react-app/components/ui/skeleton";
import { MonthNavigator } from "@/react-app/components/app/MonthNavigator";
import { PageHeader } from "@/react-app/components/app/PageHeader";
import { StatCard } from "@/react-app/components/app/StatCard";
import { EvolutionChart, fillMonths } from "@/react-app/components/reports/EvolutionChart";
import type { EvolutionPoint } from "@/react-app/components/reports/types";
import { useSession } from "@/react-app/hooks/use-session";
import { useToast } from "@/react-app/hooks/use-toast";
import { useTransactionSheet, type TransactionRecord } from "@/react-app/hooks/use-transaction-sheet";
import { currentMonth, formatCurrency, formatDate, formatMonthLabel, isOverdue, monthRange, shiftMonth } from "@/react-app/lib/format";
import { typeLabels } from "@/react-app/lib/labels";

interface Stats {
  month: string;
  centrosCusto: number;
  funcionarios: number;
  categorias: number;
  lancamentos: number;
  receitas: number;
  despesas: number;
  saldo: number;
  receitas_pendentes: number;
  despesas_pendentes: number;
  atrasados_count: number;
  atrasados_total: number;
  has_transactions: boolean;
}

const MONTH_KEY = "finanpop_dashboard_month";
const EVOLUTION_MONTHS = 6;

const getJson = async <T,>(url: string): Promise<T | null> => {
  const res = await fetch(url, { credentials: "include" });
  return res.ok ? ((await res.json()) as T) : null;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useSession((s) => s.user);
  const openCreate = useTransactionSheet((s) => s.openCreate);
  const openEdit = useTransactionSheet((s) => s.openEdit);
  const notifySaved = useTransactionSheet((s) => s.notifySaved);
  const version = useTransactionSheet((s) => s.version);

  const [month, setMonthState] = useState<string>(() => {
    const saved = sessionStorage.getItem(MONTH_KEY);
    return saved && /^\d{4}-\d{2}$/.test(saved) ? saved : currentMonth();
  });
  const setMonth = (m: string) => {
    sessionStorage.setItem(MONTH_KEY, m);
    setMonthState(m);
  };

  const [stats, setStats] = useState<Stats | null>(null);
  const [evolution, setEvolution] = useState<EvolutionPoint[]>([]);
  const [pending, setPending] = useState<TransactionRecord[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [recent, setRecent] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const from = shiftMonth(month, -(EVOLUTION_MONTHS - 1));
    const evoParams = new URLSearchParams({ start_date: monthRange(from).start, end_date: monthRange(month).end, date_field: "date" });
    const pendingParams = new URLSearchParams({
      month, date_field: "due_date", status: "PENDING", sort: "due_date_asc", page: "1", page_size: "8",
    });
    const recentParams = new URLSearchParams({ sort: "created_desc", page: "1", page_size: "5" });

    Promise.all([
      getJson<Stats>(`/app/api/stats?month=${month}`),
      getJson<{ evolution: EvolutionPoint[] }>(`/app/api/reports?${evoParams}`),
      getJson<{ items: TransactionRecord[]; total: number }>(`/app/api/transactions?${pendingParams}`),
      getJson<{ items: TransactionRecord[] }>(`/app/api/transactions?${recentParams}`),
    ])
      .then(([s, r, p, l]) => {
        if (cancelled) return;
        setStats(s);
        setEvolution(fillMonths(r?.evolution ?? [], from, month));
        setPending(p?.items ?? []);
        setPendingTotal(p?.total ?? 0);
        setRecent(l?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) toast({ title: "Erro ao carregar o resumo", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, version]);

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

  const firstName = useMemo(() => (user?.name ?? "").trim().split(/\s+/)[0] || "", [user]);
  const aPagar = stats?.despesas_pendentes ?? 0;
  const registroUrl = (extra: Record<string, string>) =>
    `/registro?${new URLSearchParams({ month, ...extra })}`;
  const describe = (t: TransactionRecord) => t.description || t.category_name || "—";
  const showTips = !isLoading && stats && !stats.has_transactions;

  return (
    <div className="space-y-5">
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : "Início"}
        description={`Resumo de ${formatMonthLabel(month)}`}
        actions={
          <Button className="hidden lg:inline-flex" onClick={() => openCreate()}>
            <Plus /> Novo lançamento
          </Button>
        }
        toolbar={<MonthNavigator value={month} onChange={setMonth} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Receitas"
          tone="success"
          value={formatCurrency(stats?.receitas ?? 0)}
          loading={isLoading}
          hint={stats && stats.receitas_pendentes > 0 ? `a receber ${formatCurrency(stats.receitas_pendentes)}` : undefined}
          onClick={() => navigate(registroUrl({ type: "REVENUE" }))}
        />
        <StatCard
          label="Despesas"
          tone="danger"
          value={formatCurrency(stats?.despesas ?? 0)}
          loading={isLoading}
          onClick={() => navigate(registroUrl({ type: "EXPENSE" }))}
        />
        <StatCard
          label="Saldo"
          tone={(stats?.saldo ?? 0) >= 0 ? "success" : "danger"}
          value={formatCurrency(stats?.saldo ?? 0)}
          loading={isLoading}
        />
        <StatCard
          label="A pagar"
          tone={aPagar > 0 ? "warning" : "muted"}
          value={formatCurrency(aPagar)}
          loading={isLoading}
          hint={
            stats && stats.atrasados_count > 0 ? (
              <span className="text-danger">
                {stats.atrasados_count} atrasado{stats.atrasados_count > 1 ? "s" : ""} · {formatCurrency(stats.atrasados_total)}
              </span>
            ) : undefined
          }
          onClick={() => navigate(registroUrl({ date_field: "due_date", status: "PENDING", type: "EXPENSE" }))}
        />
      </div>

      {showTips && (
        <Card>
          <CardHeader>
            <CardTitle>Dicas para começar</CardTitle>
            <CardDescription>Siga estes passos para configurar o sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                <>Cadastre os <strong>Centros de Custo</strong> — locais, projetos ou a conta pessoal que você vai gerenciar</>,
                <>Cadastre os <strong>Funcionários</strong>, se houver (pessoas que trabalham nos centros de custo)</>,
                <>Verifique as <strong>Categorias</strong> (tipos de despesa e receita)</>,
                <>Registre os primeiros <strong>Lançamentos</strong> de receitas e despesas pelo botão “+”</>,
                <>Use os <strong>Relatórios</strong> para acompanhar a evolução financeira</>,
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{i + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openCreate()}><Plus /> Novo lançamento</Button>
              <Button size="sm" variant="outline" asChild><Link to="/cadastro/domicilios">Centros de custo</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Evolução */}
        <Card className="gap-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos {EVOLUTION_MONTHS} meses</CardTitle>
            <CardDescription>Receitas e despesas por mês de cadastro</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {isLoading ? <Skeleton className="h-[220px] w-full" /> : <EvolutionChart data={evolution} compact className="flex-1" />}
          </CardContent>
        </Card>

        {/* Pendentes do mês */}
        <Card className="gap-0 py-0">
          <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
            <div>
              <CardTitle>Pendentes do mês</CardTitle>
              <CardDescription>Vencem em {formatMonthLabel(month)}</CardDescription>
            </div>
            {pendingTotal > 0 && <Badge variant="outline">{pendingTotal}</Badge>}
          </div>
          <div className="divide-y divide-border border-t border-border">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2 px-4 py-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            {!isLoading && pending.length === 0 && (
              <EmptyState compact icon={CheckCircle2} title="Nada pendente" description="Nenhum lançamento a pagar ou receber neste mês." />
            )}
            {!isLoading &&
              pending.map((t) => {
                const overdue = isOverdue(t.due_date, t.status);
                return (
                  <div
                    key={t.id}
                    className={cn("flex items-center gap-2 px-4 py-2.5", overdue && "border-l-2 border-l-danger")}
                  >
                    <button type="button" onClick={() => openEdit(t)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium">{describe(t)}</p>
                      <p className={cn("text-xs tabular-nums", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                        {t.due_date ? `Venc. ${formatDate(t.due_date, { year: false })}` : "Sem vencimento"}
                        {overdue && " · Atrasado"}
                      </p>
                    </button>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", t.type === "REVENUE" ? "text-success" : "text-danger")}>
                      {formatCurrency(t.amount)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Marcar como pago"
                      title="Marcar como pago"
                      className="shrink-0 text-muted-foreground hover:text-success"
                      onClick={() => markPaid(t)}
                    >
                      <CheckCircle2 />
                    </Button>
                  </div>
                );
              })}
          </div>
          {!isLoading && pendingTotal > 0 && (
            <div className="border-t border-border px-4 py-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link to={registroUrl({ date_field: "due_date", status: "PENDING" })}>
                  Ver todos ({pendingTotal}) <ArrowRight />
                </Link>
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Últimos lançamentos */}
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <div>
            <CardTitle>Últimos lançamentos</CardTitle>
            <CardDescription>Os 5 registros mais recentes</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/registro">Ver todos <ArrowRight /></Link>
          </Button>
        </div>
        <div className="divide-y divide-border border-t border-border">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 px-4 py-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          {!isLoading && recent.length === 0 && (
            <EmptyState
              compact
              icon={Receipt}
              title="Nenhum lançamento ainda"
              action={<Button size="sm" onClick={() => openCreate()}><Plus /> Novo lançamento</Button>}
            />
          )}
          {!isLoading &&
            recent.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openEdit(t)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
              >
                <Badge variant={typeLabels[t.type].variant} className="hidden sm:inline-flex">{typeLabels[t.type].label}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{describe(t)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(t.date)} · {t.home_name}{t.category_name ? ` · ${t.category_name}` : ""}
                  </p>
                </div>
                {t.status === "PENDING" && <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pendente" />}
                <span className={cn("shrink-0 text-sm font-semibold tabular-nums", t.type === "REVENUE" ? "text-success" : "text-danger", t.status === "CANCELED" && "line-through opacity-60")}>
                  {t.type === "REVENUE" ? "+" : "-"} {formatCurrency(t.amount)}
                </span>
              </button>
            ))}
        </div>
      </Card>
    </div>
  );
}
