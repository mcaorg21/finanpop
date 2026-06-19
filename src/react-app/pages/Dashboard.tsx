import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Building2, Users, Tag, Receipt, TrendingUp, TrendingDown, Wallet, Loader2 } from "lucide-react";

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
        <h1 className="text-2xl lg:text-3xl font-bold">Bem-vindo!</h1>
        <p className="text-muted-foreground mt-1">
          Aqui está o resumo do seu controle financeiro
        </p>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Receitas
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl lg:text-3xl font-bold text-emerald-600">
              {formatCurrency(stats?.receitas || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Despesas
            </CardTitle>
            <TrendingDown className="w-5 h-5 text-rose-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl lg:text-3xl font-bold text-rose-600">
              {formatCurrency(stats?.despesas || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo
            </CardTitle>
            <Wallet className="w-5 h-5 text-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl lg:text-3xl font-bold ${(stats?.saldo || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(stats?.saldo || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>
      </div>



      {/* Quick Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Cadastros</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Centros de Custo
              </CardTitle>
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.centrosCusto || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Funcionários
              </CardTitle>
              <Users className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.funcionarios || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categorias
              </CardTitle>
              <Tag className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.categorias || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lançamentos
              </CardTitle>
              <Receipt className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.lancamentos || 0}</p>
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
