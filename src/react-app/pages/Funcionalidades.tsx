import { Link } from "react-router";
import { 
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown, 
  FolderTree, 
  Building2, 
  Users, 
  Clock, 
  BarChart3, 
  Filter, 
  FileDown, 
  Shield, 
  ArrowLeft,
  CheckCircle2
} from "lucide-react";

export default function Funcionalidades() {
  const features = [
    {
      icon: LayoutDashboard,
      title: "Dashboard Completo",
      description: "Visão geral das suas finanças com resumo de receitas, despesas e saldo atualizado em tempo real."
    },
    {
      icon: TrendingUp,
      title: "Controle de Receitas",
      description: "Registre e acompanhe todas as suas entradas de dinheiro com categorização detalhada."
    },
    {
      icon: TrendingDown,
      title: "Gestão de Despesas",
      description: "Monitore todos os gastos, organize por categorias e mantenha o controle total dos seus custos."
    },
    {
      icon: FolderTree,
      title: "Categorias Personalizadas",
      description: "Crie categorias e subcategorias customizadas para organizar suas finanças do seu jeito."
    },
    {
      icon: Building2,
      title: "Centros de Custo",
      description: "Separe suas finanças por unidades, projetos, departamentos ou qualquer divisão que você precisar."
    },
    {
      icon: Users,
      title: "Cadastro de Fornecedores",
      description: "Mantenha um registro completo de empresas e fornecedores com CNPJ e informações de contato."
    },
    {
      icon: Users,
      title: "Gestão de Funcionários",
      description: "Cadastre funcionários com todas as informações trabalhistas necessárias."
    },
    {
      icon: Clock,
      title: "Folha de Ponto",
      description: "Controle de jornada de trabalho com registro de entradas/saídas, cálculo automático de horas e horas extras."
    },
    {
      icon: BarChart3,
      title: "Relatórios Avançados",
      description: "Gráficos de evolução mensal, análise por categoria e relatórios personalizados por período."
    },
    {
      icon: Filter,
      title: "Filtros Poderosos",
      description: "Filtre suas transações por data, vencimento, categoria, forma de pagamento, status e muito mais."
    },
    {
      icon: FileDown,
      title: "Exportação de Dados",
      description: "Exporte seus relatórios e registros em Excel, CSV e PDF para análises externas."
    },
    {
      icon: Shield,
      title: "Multi-usuário",
      description: "Adicione usuários à sua conta com controle de acesso e permissões personalizadas."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold text-sm sm:text-base">Voltar</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/register" className="text-gray-600 hover:text-gray-900 font-medium transition-colors text-sm sm:text-base hidden sm:inline">
                Criar Conta
              </Link>
              <Link to="/login" className="bg-emerald-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm sm:text-base">
                Entrar
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6">
            Todas as ferramentas que você precisa
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8">
            Uma plataforma completa para gerenciar suas finanças pessoais e empresariais com eficiência e simplicidade.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-8 sm:py-12 px-4 pb-12 sm:pb-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                >
                  <div className="bg-emerald-100 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Additional Benefits */}
          <div className="mt-8 sm:mt-16 bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
              E muito mais...
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Múltiplos centros de custo</p>
                  <p className="text-xs sm:text-sm text-gray-600">Organize por filiais, projetos ou departamentos</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Sugestões de categorias</p>
                  <p className="text-xs sm:text-sm text-gray-600">Categorias pré-definidas para começar rapidamente</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Controle de vencimentos</p>
                  <p className="text-xs sm:text-sm text-gray-600">Acompanhe contas a pagar e receber por data de vencimento</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Status de pagamento</p>
                  <p className="text-xs sm:text-sm text-gray-600">Pendente, pago ou cancelado - controle total do status</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Formas de pagamento</p>
                  <p className="text-xs sm:text-sm text-gray-600">PIX, boleto, cartão, dinheiro e muito mais</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">Anexos de documentos</p>
                  <p className="text-xs sm:text-sm text-gray-600">Guarde notas fiscais e comprovantes anexados</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
            Pronto para começar?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-emerald-100 mb-6 sm:mb-8">
            Experimente grátis por 7 dias. Depois, apenas R$ 7,90/mês.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-emerald-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              Começar Agora
            </Link>
            <Link
              to="/login"
              className="bg-emerald-800 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg hover:bg-emerald-900 transition-colors inline-flex items-center justify-center gap-2"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
