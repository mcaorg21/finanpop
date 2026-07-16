import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Loader2 } from "lucide-react";

interface Stats {
  centrosCusto: number;
  funcionarios: number;
  categorias: number;
  lancamentos: number;
  receitas: number;
  despesas: number;
  saldo: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Bem-vindo!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aqui está o resumo do seu controle financeiro
        </p>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Receitas
            </p>
            <p className="mt-2 text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums text-success">
              {formatCurrency(stats?.receitas || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Despesas
            </p>
            <p className="mt-2 text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums text-danger">
              {formatCurrency(stats?.despesas || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Saldo
            </p>
            <p className={`mt-2 text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums ${(stats?.saldo || 0) >= 0 ? "text-success" : "text-danger"}`}>
              {formatCurrency(stats?.saldo || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>
      </div>



      {/* Quick Stats */}
      <div>
        <h2 className="text-base font-semibold tracking-tight mb-4">Cadastros</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card size="sm">
            <CardContent>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Centros de Custo
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{stats?.centrosCusto || 0}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Funcionários
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{stats?.funcionarios || 0}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Categorias
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{stats?.categorias || 0}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lançamentos
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{stats?.lancamentos || 0}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle>Dicas para começar</CardTitle>
          <CardDescription>Siga estes passos para configurar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">1</span>
              <span>Cadastre os <strong>Centros de Custo</strong> que são os locais/projetos/conta pessoal que você vai gerenciar</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">2</span>
              <span>Cadastre os <strong>Funcionários</strong> caso os tenha (pessoas que trabalham nos centros de custo)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">3</span>
              <span>Verifique as <strong>Categorias</strong> (tipos de despesa e receita)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">4</span>
              <span>Comece a fazer <strong>Registros</strong> de receitas e despesas</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">5</span>
              <span>Use os <strong>Relatórios</strong> para acompanhar a evolução financeira</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
