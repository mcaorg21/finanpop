import { Link } from "react-router";

export default function Funcionalidades() {
  const features = [
    {
      title: "Dashboard Completo",
      description: "Visão geral das suas finanças com resumo de receitas, despesas e saldo atualizado em tempo real."
    },
    {
      title: "Controle de Receitas",
      description: "Registre e acompanhe todas as suas entradas de dinheiro com categorização detalhada."
    },
    {
      title: "Gestão de Despesas",
      description: "Monitore todos os gastos, organize por categorias e mantenha o controle total dos seus custos."
    },
    {
      title: "Categorias Personalizadas",
      description: "Crie categorias e subcategorias customizadas para organizar suas finanças do seu jeito."
    },
    {
      title: "Centros de Custo",
      description: "Separe suas finanças por unidades, projetos, departamentos ou qualquer divisão que você precisar."
    },
    {
      title: "Cadastro de Fornecedores",
      description: "Mantenha um registro completo de empresas e fornecedores com CNPJ e informações de contato."
    },
    {
      title: "Gestão de Funcionários",
      description: "Cadastre funcionários com todas as informações trabalhistas necessárias."
    },
    {
      title: "Folha de Ponto",
      description: "Controle de jornada de trabalho com registro de entradas/saídas, cálculo automático de horas e horas extras."
    },
    {
      title: "Relatórios Avançados",
      description: "Gráficos de evolução mensal, análise por categoria e relatórios personalizados por período."
    },
    {
      title: "Filtros Poderosos",
      description: "Filtre suas transações por data, vencimento, categoria, forma de pagamento, status e muito mais."
    },
    {
      title: "Exportação de Dados",
      description: "Exporte seus relatórios e registros em Excel, CSV e PDF para análises externas."
    },
    {
      title: "Multi-usuário",
      description: "Adicione usuários à sua conta com controle de acesso e permissões personalizadas."
    }
  ];

  const extras = [
    { title: "Múltiplos centros de custo", description: "Organize por filiais, projetos ou departamentos" },
    { title: "Sugestões de categorias", description: "Categorias pré-definidas para começar rapidamente" },
    { title: "Controle de vencimentos", description: "Acompanhe contas a pagar e receber por data de vencimento" },
    { title: "Status de pagamento", description: "Pendente, pago ou cancelado - controle total do status" },
    { title: "Formas de pagamento", description: "PIX, boleto, cartão, dinheiro e muito mais" },
    { title: "Anexos de documentos", description: "Guarde notas fiscais e comprovantes anexados" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm sm:text-base">
              ← Voltar
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/register" className="text-muted-foreground hover:text-foreground font-medium transition-colors text-sm sm:text-base hidden sm:inline">
                Criar Conta
              </Link>
              <Link to="/login" className="bg-primary text-primary-foreground px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm sm:text-base">
                Entrar
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground mb-4 sm:mb-6">
            Todas as ferramentas que você precisa
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
            Uma plataforma completa para gerenciar suas finanças pessoais e empresariais com eficiência e simplicidade.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-8 sm:py-12 px-4 pb-12 sm:pb-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-card rounded-xl p-4 sm:p-6 shadow-xs hover:shadow-sm transition-shadow border border-border"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Additional Benefits */}
          <div className="mt-8 sm:mt-16 bg-card rounded-xl p-4 sm:p-8 shadow-xs border border-border">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mb-4 sm:mb-6 text-center">
              E muito mais...
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {extras.map((extra, index) => (
                <div key={index} className="border-l-2 border-border pl-3 sm:pl-4">
                  <p className="font-semibold text-foreground text-sm sm:text-base">{extra.title}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{extra.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4 bg-primary">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-primary-foreground mb-3 sm:mb-4">
            Pronto para começar?
          </h2>
          <p className="text-base sm:text-lg text-primary-foreground/80 mb-6 sm:mb-8">
            Experimente grátis por 7 dias. Depois, apenas R$ 7,90/mês.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/register"
              className="bg-background text-foreground px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-background/90 transition-colors inline-flex items-center justify-center"
            >
              Começar Agora
            </Link>
            <Link
              to="/login"
              className="border border-primary-foreground/30 text-primary-foreground px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-primary-foreground/10 transition-colors inline-flex items-center justify-center"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
