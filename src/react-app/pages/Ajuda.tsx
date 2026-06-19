import { HelpCircle, Home, Building2, Users, Building, Tag, DollarSign, Clock, BarChart3, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/react-app/components/ui/accordion";

export default function AjudaPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-primary" />
          Central de Ajuda
        </h1>
        <p className="text-muted-foreground mt-1">
          Guia completo de todas as funcionalidades do sistema
        </p>
      </div>

      {/* Sections */}
      <Accordion type="single" collapsible className="space-y-4">
        {/* Dashboard */}
        <AccordionItem value="dashboard" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Home className="w-5 h-5 text-primary" />
              <span className="font-semibold">Início (Dashboard)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm pt-4">
            <p>
              O <strong>Dashboard</strong> é a tela inicial do sistema onde você tem uma visão geral de suas finanças e cadastros.
            </p>
            <div className="space-y-2">
              <p className="font-medium">O que você encontra aqui:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Total de Receitas:</strong> Soma de todas as receitas do mês atual</li>
                <li><strong>Total de Despesas:</strong> Soma de todas as despesas do mês atual</li>
                <li><strong>Saldo:</strong> Diferença entre receitas e despesas (aparece em verde se positivo, vermelho se negativo)</li>
                <li><strong>Cadastros:</strong> Contador de quantos centros de custo, funcionários, categorias e lançamentos você tem</li>
                <li><strong>Guia de Primeiros Passos:</strong> Instruções para configurar o sistema pela primeira vez</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Cadastros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Cadastros
            </CardTitle>
            <CardDescription>
              Área para gerenciar todas as informações básicas do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Centro de Custo */}
            <div className="space-y-2 border-l-2 border-primary pl-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Centro de Custo
              </h3>
              <p className="text-sm text-muted-foreground">
                Cadastre os locais, projetos ou unidades que você deseja controlar financeiramente.
                Por exemplo: diferentes propriedades, filiais, obras, ou projetos específicos.
              </p>
              <p className="text-sm">
                <strong>Como usar:</strong> Cada lançamento financeiro deve estar vinculado a um centro de custo,
                permitindo que você acompanhe as finanças separadamente por local/projeto.
              </p>
            </div>

            {/* Funcionários */}
            <div className="space-y-2 border-l-2 border-primary pl-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Funcionários
              </h3>
              <p className="text-sm text-muted-foreground">
                Cadastre todos os funcionários que trabalham em seus centros de custo. Registre informações como
                CPF, CTPS, data de admissão, carga horária e escala de trabalho.
              </p>
              <p className="text-sm">
                <strong>Campos importantes:</strong>
              </p>
              <ul className="text-sm list-disc pl-5 space-y-1">
                <li><strong>Horas por Dia:</strong> Define a jornada padrão (ex: 8:48 para 44h semanais)</li>
                <li><strong>Trabalha aos Sábados:</strong> Define se o funcionário tem expediente no sábado</li>
                <li><strong>Descanso Semanal:</strong> Dia da semana em que o funcionário folga</li>
              </ul>
              <p className="text-sm mt-2">
                Essas informações são usadas automaticamente na <strong>Folha de Ponto</strong>.
              </p>
            </div>

            {/* Fornecedores */}
            <div className="space-y-2 border-l-2 border-primary pl-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Building className="w-4 h-4" />
                Fornecedores
              </h3>
              <p className="text-sm text-muted-foreground">
                Cadastre empresas e prestadores de serviço com quem você faz negócios.
                Registre CNPJ, telefone, email e observações importantes.
              </p>
              <p className="text-sm">
                <strong>Como usar:</strong> Ao lançar uma despesa, você pode vincular a empresa fornecedora
                para ter melhor rastreabilidade dos seus gastos por fornecedor.
              </p>
            </div>

            {/* Categorias */}
            <div className="space-y-2 border-l-2 border-primary pl-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Categorias
              </h3>
              <p className="text-sm text-muted-foreground">
                Organize suas receitas e despesas em categorias. O sistema já vem com categorias pré-cadastradas,
                mas você pode adicionar, editar ou excluir conforme sua necessidade.
              </p>
              <p className="text-sm">
                <strong>Subcategorias:</strong> Você pode criar categorias "filhas" dentro de uma categoria principal.
                Por exemplo, a categoria "Impostos" pode ter subcategorias como "IPVA", "IPTU" e "LICENCIAMENTO".
              </p>
              <p className="text-sm mt-2">
                <strong>Tipos:</strong> Cada categoria é classificada como RECEITA ou DESPESA, facilitando
                a organização e os relatórios.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Registros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Registros
            </CardTitle>
            <CardDescription>
              Área para registrar movimentações financeiras e controle de ponto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Receitas e Despesas */}
            <div className="space-y-2 border-l-2 border-primary pl-4">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Receitas e Despesas
              </h3>
              <p className="text-sm text-muted-foreground">
                Registre todos os lançamentos financeiros: pagamentos, recebimentos, contas a pagar e a receber.
              </p>
              <p className="text-sm">
                <strong>Campos principais:</strong>
              </p>
              <ul className="text-sm list-disc pl-5 space-y-1">
                <li><strong>Data:</strong> Data do lançamento no sistema</li>
                <li><strong>Vencimento:</strong> Data em que a conta vence</li>
                <li><strong>Pagamento:</strong> Data efetiva do pagamento (quando preenchida, o status automaticamente muda para "PAGO")</li>
                <li><strong>Tipo:</strong> RECEITA ou DESPESA</li>
                <li><strong>Categoria:</strong> Classificação do lançamento</li>
                <li><strong>Centro de Custo:</strong> Onde essa movimentação está alocada</li>
                <li><strong>Forma de Pagamento:</strong> PIX, Dinheiro, Cartão, Boleto, etc.</li>
                <li><strong>Status:</strong> PAGO, PENDENTE ou CANCELADO</li>
              </ul>
              <p className="text-sm mt-2">
                <strong>Filtros:</strong> Use os filtros para encontrar lançamentos por período, tipo, categoria,
                status e forma de pagamento. Você também pode exportar os dados filtrados para Excel ou CSV.
              </p>
            </div>

            {/* Folha de Ponto */}
            <div className="space-y-2 border-l-2 border-primary pl-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Folha de Ponto
              </h3>
              <p className="text-sm text-muted-foreground">
                Controle o ponto eletrônico dos funcionários com registro de entrada, saída, horas trabalhadas e horas extras.
              </p>
              <p className="text-sm">
                <strong>Como usar:</strong>
              </p>
              <ul className="text-sm list-disc pl-5 space-y-1">
                <li>Selecione o funcionário, mês e ano</li>
                <li>A folha mostra todos os dias do mês em uma grade</li>
                <li>Clique em "Editar" para abrir o modal de lançamento de horas</li>
                <li>Registre até 4 marcações por dia: Entrada 1, Saída 1, Entrada 2, Saída 2</li>
                <li>O sistema calcula automaticamente as horas trabalhadas e horas extras</li>
                <li>Use o campo "Observação" para marcar férias, feriados, atestados, folgas, etc.</li>
              </ul>
              <p className="text-sm mt-2">
                <strong>Dicas:</strong> Você pode colar múltiplas linhas de horários (ex: copiado do WhatsApp).
                Use os botões "Limpar Linha" ou "Limpar Tudo" para apagar registros rapidamente.
                A folha pode ser exportada em PDF para impressão e assinatura.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Relatórios */}
        <AccordionItem value="relatorios" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="font-semibold">Relatórios</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm pt-4">
            <p>
              A tela de <strong>Relatórios</strong> permite visualizar e analisar suas movimentações financeiras
              de forma consolidada.
            </p>
            <div className="space-y-2">
              <p className="font-medium">Funcionalidades:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Filtros Avançados:</strong> Filtre por período, tipo, categoria, centro de custo,
                  funcionário, empresa, status e forma de pagamento</li>
                <li><strong>Resumo Financeiro:</strong> Visualize totais de receitas, despesas e saldo do período filtrado</li>
                <li><strong>Tabela Detalhada:</strong> Lista completa de todos os lançamentos que atendem aos filtros</li>
                <li><strong>Exportação:</strong> Exporte os dados para Excel, CSV ou PDF para análises externas</li>
                <li><strong>Gráficos:</strong> Visualização gráfica da distribuição de receitas e despesas por categoria</li>
              </ul>
            </div>
            <p className="text-sm bg-muted p-3 rounded-lg">
              <strong>💡 Dica:</strong> Use a tela de Relatórios para fazer análises mensais, trimestrais ou anuais.
              Combine filtros para descobrir padrões de gastos e oportunidades de economia.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Configurações */}
        <AccordionItem value="configuracoes" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-primary" />
              <span className="font-semibold">Configurações</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm pt-4">
            <p>
              A área de <strong>Configurações</strong> é onde você gerencia os usuários que têm acesso ao sistema.
            </p>
            <div className="space-y-2">
              <p className="font-medium">Gerenciamento de Usuários:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Adicionar Usuário:</strong> Crie novos usuários definindo nome, login e senha</li>
                <li><strong>Editar Usuário:</strong> Modifique informações ou altere senhas de usuários existentes</li>
                <li><strong>Desativar/Ativar:</strong> Controle quem pode acessar o sistema sem precisar excluir o usuário</li>
                <li><strong>Excluir Usuário:</strong> Remova permanentemente usuários que não são mais necessários</li>
              </ul>
            </div>
            <p className="text-sm bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900">
              <strong>⚠️ Atenção:</strong> Por questões de segurança, sempre use senhas fortes e oriente os usuários
              a trocarem a senha inicial após o primeiro acesso.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* FAQ Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Como faço para importar dados em massa?</p>
            <p className="text-muted-foreground">
              Atualmente não há importação em massa. Os dados devem ser cadastrados manualmente através das telas de cadastro.
            </p>
          </div>
          <div>
            <p className="font-medium">Posso acessar de vários dispositivos?</p>
            <p className="text-muted-foreground">
              Sim! O sistema é responsivo e pode ser acessado de computadores, tablets e celulares.
            </p>
          </div>
          <div>
            <p className="font-medium">Os dados ficam salvos na nuvem?</p>
            <p className="text-muted-foreground">
              Sim, todos os dados são armazenados de forma segura em nuvem e sincronizados automaticamente.
            </p>
          </div>
          <div>
            <p className="font-medium">Como faço backup dos meus dados?</p>
            <p className="text-muted-foreground">
              Use as funções de exportação (Excel/CSV/PDF) nas telas de Registro e Relatórios para criar cópias dos seus dados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
