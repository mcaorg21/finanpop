import { Button } from "@/react-app/components/ui/button";
import { useNavigate } from "react-router";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo-secgo.png"
              alt="FinanPOP"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
            />
            <span className="font-semibold tracking-tight text-lg sm:text-xl text-foreground">FinanPOP</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/funcionalidades")}
              className="text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-10"
            >
              <span className="hidden xs:inline">Funcionalidades</span>
              <span className="xs:hidden">Funções</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-10"
            >
              Entrar
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-muted text-muted-foreground px-4 py-1.5 rounded-md text-sm font-medium mb-6">
            Controle financeiro para pessoas e empresas
          </div>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-6 leading-tight">
            Transforme sua vida financeira em
            <span className="text-muted-foreground"> 7 dias grátis</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            A plataforma mais simples e acessível para controlar gastos, organizar receitas e tomar decisões financeiras inteligentes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              size="lg"
              className="px-8 py-6 text-lg"
              onClick={() => navigate("/register")}
            >
              Começar grátis agora
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            7 dias grátis • Depois apenas <span className="font-semibold text-foreground">R$ 7,90/mês</span> • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center text-foreground mb-16">
            Controle aqui suas finanças pessoais ou de sua empresa
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Card Principal - Grande */}
            <div className="md:row-span-2 bg-card border border-border p-8 rounded-xl shadow-xs hover:shadow-sm transition-shadow">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">01</p>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-4">
                Relatórios de Evolução
              </h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Acompanhe sua evolução financeira mês a mês com gráficos claros e objetivos. Visualize padrões, identifique oportunidades e tome decisões mais inteligentes.
              </p>
            </div>

            {/* Card 2 - Médio Superior */}
            <div className="bg-card border border-border p-6 rounded-xl shadow-xs hover:shadow-sm transition-shadow">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">02</p>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-3">
                Controle Total
              </h3>
              <p className="text-muted-foreground">
                Organize receitas e despesas por categoria, empresa e centro de custo.
              </p>
            </div>

            {/* Card 3 - Médio Inferior */}
            <div className="bg-card border border-border p-6 rounded-xl shadow-xs hover:shadow-sm transition-shadow">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">03</p>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-3">
                Decisões Inteligentes
              </h3>
              <p className="text-muted-foreground">
                Tome decisões baseadas em dados reais e melhore sua educação financeira.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/40 border-y border-border py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center text-foreground mb-12">
              Por que escolher o FinanPOP?
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="border-l-2 border-border pl-4">
                <h4 className="font-semibold text-foreground mb-1">Simplicidade total</h4>
                <p className="text-muted-foreground">Interface intuitiva que qualquer pessoa consegue usar</p>
              </div>

              <div className="border-l-2 border-border pl-4">
                <h4 className="font-semibold text-foreground mb-1">Preço popular</h4>
                <p className="text-muted-foreground">Menos que um café por dia para controlar suas finanças</p>
              </div>

              <div className="border-l-2 border-border pl-4">
                <h4 className="font-semibold text-foreground mb-1">Acesso total</h4>
                <p className="text-muted-foreground">Todos os recursos liberados, sem limitações</p>
              </div>

              <div className="border-l-2 border-border pl-4">
                <h4 className="font-semibold text-foreground mb-1">Risco zero</h4>
                <p className="text-muted-foreground">7 dias grátis para testar sem compromisso</p>
              </div>

              <div className="border-l-2 border-border pl-4">
                <h4 className="font-semibold text-foreground mb-1">Educação financeira</h4>
                <p className="text-muted-foreground">Aprenda a controlar melhor seu dinheiro</p>
              </div>

              <div className="border-l-2 border-border pl-4">
                <h4 className="font-semibold text-foreground mb-1">Democrático</h4>
                <p className="text-muted-foreground">Criado para ser acessível a todos os brasileiros</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto bg-primary rounded-xl p-12 text-center text-primary-foreground shadow-sm">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">
            Comece grátis hoje
          </h2>
          <p className="text-lg mb-2 text-primary-foreground/80">
            Experimente por 7 dias sem pagar nada
          </p>
          <p className="text-3xl font-semibold tabular-nums mb-8">
            Depois apenas R$ 7,90/mês
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="px-8 py-6 text-lg font-semibold"
            onClick={() => navigate("/register")}
          >
            Criar minha conta grátis
          </Button>
          <p className="text-sm text-primary-foreground/70 mt-6">
            Sem cartão de crédito • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/40 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© 2024 FinanPOP - Controle financeiro democrático e acessível</p>
        </div>
      </footer>
    </div>
  );
}
