import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/react-app/components/ui/accordion";
import { PageHeader } from "@/react-app/components/app/PageHeader";

export default function AjudaPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Central de Ajuda" description="Guia das funcionalidades do sistema" />

      <Accordion type="single" collapsible className="space-y-3">
        {/* Navegação */}
        <AccordionItem value="navegacao" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Navegação e atalhos</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-4 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>No computador:</strong> o menu lateral à esquerda dá acesso a Início, Lançamentos, Relatórios, Cadastros, Folha de Ponto, Configurações e Ajuda.</li>
              <li><strong>No celular:</strong> a barra inferior tem Início, Lançamentos, o botão <strong>+</strong> no centro, Relatórios e <strong>Mais</strong> (cadastros, folha de ponto, configurações e sair).</li>
              <li><strong>Botão “+ Novo lançamento”:</strong> abre o painel de registro de qualquer tela, sem sair de onde você está.</li>
              <li><strong>Navegação por mês:</strong> Início e Lançamentos mostram um mês por vez — use as setas ◀ ▶ para trocar e “Hoje” para voltar ao mês atual.</li>
              <li><strong>Período de teste:</strong> os dias restantes aparecem ao lado do seu nome no menu (ou no topo, no celular).</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Início */}
        <AccordionItem value="dashboard" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Início</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-4 text-sm">
            <p>Resumo do mês selecionado, com acesso rápido ao que precisa de atenção.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Receitas, Despesas e Saldo:</strong> totais do mês (sem lançamentos cancelados). Clique num cartão para abrir a lista filtrada.</li>
              <li><strong>A pagar:</strong> despesas pendentes com vencimento no mês e quantas já estão atrasadas.</li>
              <li><strong>Últimos 6 meses:</strong> gráfico de receitas e despesas, separando o que já foi pago do que está pendente.</li>
              <li><strong>Pendentes do mês:</strong> lista por vencimento, com o botão ✓ para marcar como pago em um clique.</li>
              <li><strong>Últimos lançamentos:</strong> os 5 registros mais recentes — clique para editar.</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Lançamentos */}
        <AccordionItem value="lancamentos" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Lançamentos (receitas e despesas)</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Registrar rapidamente</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Abra com <strong>+ Novo lançamento</strong>. O cursor já começa no <strong>Valor</strong>; digite só os números (1234 vira 12,34).</li>
                <li>Escolha <strong>Despesa</strong> ou <strong>Receita</strong>, a <strong>Categoria</strong> (digite para buscar), o <strong>Centro de custo</strong> (o último usado fica lembrado) e a <strong>Forma de pagamento</strong>.</li>
                <li><strong>Enter</strong> salva. <strong>Ctrl+Enter</strong> (ou “Salvar e novo”) salva e já abre outro mantendo tipo, centro, data e forma.</li>
                <li>Em <strong>Mais detalhes</strong> ficam vencimento, data de pagamento, funcionário, empresa, descrição, observações, repetição e anexos (arquivo ou câmera).</li>
                <li><strong>Cartão de crédito:</strong> informe o número de parcelas — o sistema cria uma por mês, com o total dividido sem perder centavos (ex.: “3/12”).</li>
                <li><strong>Repetir nos próximos meses:</strong> gera cópias pendentes para os meses seguintes (aluguel, mensalidades).</li>
                <li>Preencher a <strong>data de pagamento</strong> muda o status para Pago automaticamente.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Lista, filtros e ações</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>A lista mostra um mês por vez, 25 por página. Em <strong>Filtros</strong> você escolhe se o mês vale pela data de cadastro, vencimento ou pagamento, além de tipo, status, forma, categorias e centros.</li>
                <li>A <strong>busca</strong> encontra por descrição, categoria, empresa, funcionário ou centro.</li>
                <li>Os cartões no topo resumem o mês; <strong>Pendente</strong> mostra os atrasados e filtra ao clicar.</li>
                <li>No menu <strong>⋯</strong> de cada linha: Editar, Duplicar, Marcar como pago, Anexos e Excluir — igual no celular.</li>
                <li><strong>Exportar</strong> gera Excel ou CSV com exatamente o filtro ativo.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Relatórios */}
        <AccordionItem value="relatorios" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Relatórios</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-4 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Período:</strong> atalhos Este mês, Mês passado, 3 meses, Este ano ou datas personalizadas. Escolha se o período vale pela data de cadastro, vencimento ou pagamento.</li>
              <li><strong>Filtros aplicam sozinhos</strong> ao mudar — não há botão “Aplicar”. Centros, categorias, funcionário, empresa, tipo e status.</li>
              <li><strong>Resumo:</strong> receitas (e a receber), despesas (e a pagar), saldo (e o realizado, só com o que foi pago) e atrasados.</li>
              <li><strong>Evolução mensal:</strong> barras por mês separando pago e pendente.</li>
              <li><strong>Por categoria:</strong> donut com abas Despesas/Receitas; clique numa categoria para filtrar a lista de lançamentos. “Agrupar por categoria pai” soma as subcategorias.</li>
              <li><strong>Por forma de pagamento:</strong> participação de Pix, cartão, boleto etc.</li>
              <li><strong>Exportar:</strong> Excel e CSV com o mesmo filtro; o <strong>PDF</strong> traz os filtros, o resumo, os gráficos e a tabela de lançamentos.</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Cadastros */}
        <AccordionItem value="cadastros" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Cadastros</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Informações básicas usadas nos lançamentos. Em todas as telas: busca no topo, clique na linha para editar e menu ⋯ para as demais ações.</p>
            <div className="space-y-2 border-l-2 border-border pl-4">
              <h3 className="font-semibold">Centros de Custo</h3>
              <p className="text-sm text-muted-foreground">
                Locais, projetos ou contas que você acompanha separadamente (casa, filial, obra, conta pessoal). Todo lançamento pertence a um centro de custo. Digite o CEP para preencher o endereço.
              </p>
            </div>
            <div className="space-y-2 border-l-2 border-border pl-4">
              <h3 className="font-semibold">Categorias</h3>
              <p className="text-sm text-muted-foreground">
                Classificam receitas e despesas. Use <strong>Sugestões</strong> para adicionar uma categoria completa com subcategorias em um clique, ou crie as suas. Clique na seta para ver as subcategorias de cada uma.
              </p>
            </div>
            <div className="space-y-2 border-l-2 border-border pl-4">
              <h3 className="font-semibold">Fornecedores</h3>
              <p className="text-sm text-muted-foreground">
                Empresas e prestadores com CNPJ, telefone e e-mail. Vincule ao lançamento para acompanhar gastos por fornecedor (dá para criar um novo direto do painel de lançamento).
              </p>
            </div>
            <div className="space-y-2 border-l-2 border-border pl-4">
              <h3 className="font-semibold">Funcionários</h3>
              <p className="text-sm text-muted-foreground">
                Dados pessoais, CTPS, admissão, horas por dia e horário de trabalho por dia da semana — usados na Folha de Ponto. O menu ⋯ dá acesso às <strong>chaves PIX</strong>.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Folha de Ponto */}
        <AccordionItem value="folha" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Folha de Ponto</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-4 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              <li>Navegue pelos meses com as setas e filtre por funcionário. <strong>Nova folha</strong> cria a folha do mês para um funcionário.</li>
              <li>Clique na folha para abrir a grade com todos os dias do mês e registre até 4 marcações por dia (Entrada 1, Saída 1, Entrada 2, Saída 2).</li>
              <li>Horas trabalhadas e extras são calculadas automaticamente a partir das horas por dia do funcionário.</li>
              <li>Use <strong>Observação</strong> para férias, feriados, atestados e folgas. Você pode colar vários horários de uma vez (ex.: copiados do WhatsApp).</li>
              <li>Exporte em PDF para impressão e assinatura.</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Configurações */}
        <AccordionItem value="configuracoes" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Configurações</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-4 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Usuários:</strong> adicione, edite, desative ou exclua quem acessa o sistema.</li>
              <li><strong>Assinatura:</strong> veja o plano, os dias restantes do teste e reative quando necessário.</li>
            </ul>
            <p className="border-l-2 border-border pl-3 text-muted-foreground">
              <strong className="text-foreground">Atenção:</strong> use senhas fortes e oriente os usuários a trocar a senha inicial no primeiro acesso.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* IA e WhatsApp */}
        <AccordionItem value="whatsapp" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">Lançar pelo WhatsApp com IA (plano Enterprise)</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-4 text-sm">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Em <strong>Configurações → IA e WhatsApp</strong>, cadastre a sua chave da OpenAI e escolha o modelo.</li>
              <li>Informe seu telefone com DDD e clique em <strong>Gerar código</strong>.</li>
              <li>No WhatsApp, envie <strong>VINCULAR 123456</strong> (com o seu código) ao número do FinanPOP.</li>
              <li>Pronto: mande um texto (“gastei 45,90 no mercado no pix”), um áudio ou a foto de uma nota.</li>
            </ol>
            <ul className="list-disc space-y-1 pl-5">
              <li>O FinanPOP responde com um resumo e os botões <strong>Confirmar</strong> e <strong>Cancelar</strong>; nada é lançado antes da sua confirmação.</li>
              <li>Faltou categoria ou centro de custo? Ele pergunta e você responde com o número da opção.</li>
              <li>Para corrigir, basta responder (“foi no cartão”, “é 52,90”). Se a mensagem trouxe uma foto, ela fica anexada ao lançamento.</li>
              <li>Lançou errado? Envie <strong>desfazer</strong> em até 24 horas e o último lançamento feito pelo WhatsApp é removido.</li>
            </ul>
            <p className="border-l-2 border-border pl-3 text-muted-foreground">
              <strong className="text-foreground">Privacidade:</strong> o texto, o áudio e a imagem enviados são processados pela OpenAI com a chave da sua conta,
              e o custo é cobrado por ela. A chave fica guardada criptografada e nunca volta a ser exibida. O áudio é descartado após a transcrição.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>Perguntas frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Como registro um lançamento mais rápido?</p>
            <p className="text-muted-foreground">Clique em +, digite o valor, escolha categoria e forma e aperte Enter. Para vários seguidos, use Ctrl+Enter (Salvar e novo).</p>
          </div>
          <div>
            <p className="font-medium">Como vejo o que ainda falta pagar?</p>
            <p className="text-muted-foreground">No Início, o cartão “A pagar” e a lista “Pendentes do mês”. Em Lançamentos, clique no cartão “Pendente” ou filtre por status.</p>
          </div>
          <div>
            <p className="font-medium">Posso acessar de vários dispositivos?</p>
            <p className="text-muted-foreground">Sim. O sistema funciona em computadores, tablets e celulares; no celular a navegação fica na barra inferior.</p>
          </div>
          <div>
            <p className="font-medium">Como faço backup dos meus dados?</p>
            <p className="text-muted-foreground">Use Exportar (Excel/CSV) em Lançamentos e Relatórios, ou o PDF do relatório.</p>
          </div>
          <div>
            <p className="font-medium">Como importo dados em massa?</p>
            <p className="text-muted-foreground">Ainda não há importação em massa; os dados são cadastrados pelas telas do sistema.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
