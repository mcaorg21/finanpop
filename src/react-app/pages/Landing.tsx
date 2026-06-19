import { ArrowRight, CheckCircle2, Shield } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { useNavigate } from "react-router";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo-secgo.png"
              alt="FinanPOP"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
            />
            <span className="font-bold text-lg sm:text-xl text-emerald-700">FinanPOP</span>
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
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            Controle financeiro para pessoas e empresas
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Transforme sua vida financeira em
            <span className="text-emerald-600"> 7 dias grátis</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            A plataforma mais simples e acessível para controlar gastos, organizar receitas e tomar decisões financeiras inteligentes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button 
              size="lg" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg"
              onClick={() => navigate("/register")}
            >
              Começar grátis agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <p className="text-sm text-gray-500">
            ✨ 7 dias grátis • Depois apenas <span className="font-bold text-emerald-700">R$ 7,90/mês</span> • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-16">
            Controle aqui suas finanças pessoais ou de sua empresa
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Card Principal - Grande */}
            <div className="md:row-span-2 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="mb-6 group-hover:scale-110 transition-transform duration-300">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-sm rounded-2xl rotate-45"></div>
                    <div className="absolute inset-2 bg-white/30 backdrop-blur-sm rounded-xl"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-black text-white">📈</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  Relatórios de Evolução
                </h3>
                <p className="text-emerald-50 text-lg leading-relaxed">
                  Acompanhe sua evolução financeira mês a mês com gráficos claros e objetivos. Visualize padrões, identifique oportunidades e tome decisões mais inteligentes.
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            </div>

            {/* Card 2 - Médio Superior */}
            <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group">
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="mb-4 group-hover:scale-110 transition-transform duration-300">
                  <div className="relative w-14 h-14">
                    <div className="absolute top-0 left-0 w-8 h-8 bg-white/30 backdrop-blur-sm rounded-full"></div>
                    <div className="absolute bottom-0 right-0 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg rotate-12"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-white">💎</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                  Controle Total
                </h3>
                <p className="text-blue-50">
                  Organize receitas e despesas por categoria, empresa e centro de custo.
                </p>
              </div>
            </div>

            {/* Card 3 - Médio Inferior */}
            <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="mb-4 group-hover:scale-110 transition-transform duration-300">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 border-4 border-white/30 rounded-xl"></div>
                    <div className="absolute inset-1 border-2 border-white/40 rounded-lg -rotate-12"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-white">🎯</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                  Decisões Inteligentes
                </h3>
                <p className="text-purple-50">
                  Tome decisões baseadas em dados reais e melhore sua educação financeira.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Por que escolher o FinanPOP?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Simplicidade total</h4>
                  <p className="text-gray-600">Interface intuitiva que qualquer pessoa consegue usar</p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Preço popular</h4>
                  <p className="text-gray-600">Menos que um café por dia para controlar suas finanças</p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Acesso total</h4>
                  <p className="text-gray-600">Todos os recursos liberados, sem limitações</p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Risco zero</h4>
                  <p className="text-gray-600">7 dias grátis para testar sem compromisso</p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Educação financeira</h4>
                  <p className="text-gray-600">Aprenda a controlar melhor seu dinheiro</p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Democrático</h4>
                  <p className="text-gray-600">Criado para ser acessível a todos os brasileiros</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-12 text-center text-white shadow-xl">
          <Shield className="h-16 w-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-4xl font-bold mb-4">
            Comece grátis hoje
          </h2>
          <p className="text-xl mb-2 text-emerald-50">
            Experimente por 7 dias sem pagar nada
          </p>
          <p className="text-3xl font-bold mb-8">
            Depois apenas R$ 7,90/mês
          </p>
          <Button 
            size="lg" 
            className="bg-white text-emerald-700 hover:bg-gray-100 px-8 py-6 text-lg font-semibold"
            onClick={() => navigate("/register")}
          >
            Criar minha conta grátis
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-sm text-emerald-100 mt-6">
            Sem cartão de crédito • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>© 2024 FinanPOP - Controle financeiro democrático e acessível</p>
        </div>
      </footer>
    </div>
  );
}
