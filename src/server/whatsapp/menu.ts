// Menu de funções do assistente e atalhos (mensagem de lista). Tudo aqui funciona sem a chave da OpenAI.
import type { ListRow } from "./client.js";

export const MENU_TEXT = `👋 Olá! Sou o assistente do *FinanPOP*. Por aqui você faz quase tudo do app — por texto, áudio 🎤 ou foto 📷.

💸 *LANÇAR*
• gastei 45,90 no mercado no pix
• recebi 3.000 de salário
• boleto da luz 230 vence dia 20
• 📷 foto da nota ou do comprovante

📊 *CONSULTAR*
• quanto gastei hoje / essa semana / esse mês
• quanto gastei com mercado esse mês
• quanto já gastei até hoje
• resumo do mês · meu saldo
• gastos por categoria / forma de pagamento
• maiores gastos da semana · comparar com o mês passado
• últimos lançamentos · buscar uber

📈 *GRÁFICOS* (imagem)
• gráfico dos últimos 6 meses · gráfico por categoria · gráfico do mês

💡 *INSIGHTS*
• me dê insights do mês · onde posso economizar · como estou gastando

🗓️ *CONTAS*
• o que vence essa semana · contas atrasadas · o que tenho a receber
• paguei a luz · recebi o aluguel

🛠️ *AJUSTES*
• desfazer · editar o último · excluir uber

Toque em *Atalhos* para o essencial ou escreva do seu jeito. Para ver isto de novo, envie *menu*.`;

export const SHORTCUTS_BODY = "Escolha uma opção rápida (ou escreva o que quiser):";

export const SHORTCUTS: ListRow[] = [
  { id: "q:resumo", title: "Resumo do mês", description: "Receitas, despesas, saldo e contas a pagar" },
  { id: "q:hoje", title: "Gastos de hoje", description: "Quanto gastei hoje" },
  { id: "q:semana", title: "Gastos da semana", description: "Segunda a domingo, com comparação" },
  { id: "q:mes", title: "Gastos do mês", description: "Total do mês, top categorias e variação" },
  { id: "q:categorias", title: "Gastos por categoria", description: "Ranking de categorias do mês" },
  { id: "q:vencer", title: "Contas a vencer", description: "O que vence nos próximos 7 dias" },
  { id: "q:atrasadas", title: "Contas atrasadas", description: "Pendências com vencimento passado" },
  { id: "q:grafico_evolucao", title: "Gráfico 6 meses", description: "Receitas x despesas e saldo" },
  { id: "q:grafico_categoria", title: "Gráfico por categoria", description: "Para onde foi o dinheiro no mês" },
  { id: "q:insights", title: "Insights e dicas", description: "Ritmo do mês, o que mudou e onde economizar" },
];

/** "oi", "menu", "ajuda"... — sem chamar a IA. */
const GREETING =
  /^\s*(oi+e?|ol[aá]+|opa|e a[ií]|eai|salve|hey|hello|hi|bom dia|boa tarde|boa noite|menu|ajuda|ajudar|help|comandos?|op[cç][õo]es|o que (voc[eê]|vc) (faz|sabe fazer)|come[cç]ar|iniciar|start|\?+)[\s!.?,]*$/i;
export const isGreeting = (text: string): boolean => GREETING.test(text);

// Mapa em memória (mesmo padrão do rate limit): passou de 12 h sem falar, a conversa é nova.
const SESSION_MS = 12 * 60 * 60 * 1000;
const lastSeen = new Map<string, number>();

/** Registra o contato e diz se é o início de uma conversa (primeira mensagem ou 12 h de silêncio). */
export const touchSession = (key: string, now = Date.now()): boolean => {
  const prev = lastSeen.get(key);
  lastSeen.set(key, now);
  if (lastSeen.size > 5000) {
    for (const [k, t] of lastSeen) if (now - t > SESSION_MS) lastSeen.delete(k);
  }
  return prev === undefined || now - prev > SESSION_MS;
};

export const SESSION_HINT = "\n\n_Envie *menu* para ver tudo que posso fazer._";
