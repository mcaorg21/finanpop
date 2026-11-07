// Aviso diário das contas do dia pelo WhatsApp (plano Enterprise, só para quem ativou).
//
// A Meta só aceita texto livre até 24 h depois da última mensagem do usuário. Por escolha do produto não usamos modelo
// aprovado: o aviso sai apenas para quem escreveu ao FinanPOP nas últimas 24 h. Quem está fora da janela não é
// reivindicado; assim que escrever (até CATCH_UP_HOURS depois do horário escolhido), recebe o aviso do dia.
import pool from "../db.js";
import { hasEnterprise } from "../lib/plan.js";
import { addDays, brDay, todaySP } from "../lib/periods.js";
import { listTransactions, totals, type ReportFilter } from "../lib/reports.js";
import { sendText } from "./client.js";
import { brl, txLine } from "./format.js";

export const NOTICE_MIN_HOUR = 5;
export const NOTICE_MAX_HOUR = 22;
export const NOTICE_DEFAULT_HOUR = 8;

/** Se o servidor estava fora do ar, ou o usuário só escreveu depois, o aviso ainda sai até 4 h após o horário. */
const CATCH_UP_HOURS = 4;
/** Janela de atendimento da Meta (24 h), com folga. */
const WINDOW_HOURS = 23;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Hora cheia (0–23) em São Paulo. */
export const hourSP = (now: Date = new Date()): number =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(now));

const greeting = (hour: number) => (hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
const contas = (n: number) => `${n} ${n === 1 ? "conta" : "contas"}`;

/** Texto do aviso, ou null quando não há conta para hoje nem atrasada (nesse caso não se envia nada). */
export const buildNotice = async (tenantId: number, today: string, hour: number): Promise<string | null> => {
  const f: ReportFilter = { tenantId, today, start: today, end: today, dateField: "due_date", type: "EXPENSE", status: "PENDING" };
  const late: ReportFilter = { ...f, start: "1970-01-01", end: addDays(today, -1), status: "OVERDUE" };
  const [rows, t, l] = await Promise.all([listTransactions(f, "due_asc", 10), totals(f), totals(late)]);
  if (t.lancamentos === 0 && l.atrasados === 0) return null;

  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const lines = [`☀️ *${greeting(hour)}! Contas de hoje* · ${weekday} ${brDay(today)}`];
  if (t.lancamentos > 0) {
    lines.push(`A pagar hoje *${brl(t.despesas)}* · ${contas(t.lancamentos)}`, "", ...rows.map((r) => txLine(r, today)));
    if (t.lancamentos > rows.length) lines.push(`… e mais ${t.lancamentos - rows.length}`);
  } else {
    lines.push("", "Nenhuma conta vence hoje. 🟢");
  }
  if (l.atrasados > 0) {
    lines.push("", `🔴 Atrasadas: ${contas(l.atrasados)} (${brl(l.atrasados_total)}). Envie *contas atrasadas* para ver.`);
  }
  lines.push("", "Para dar baixa, envie por exemplo: *paguei a luz*", "Para parar este aviso: *desativar aviso diário*");
  return lines.join("\n");
};

/**
 * Envia o aviso de hoje a quem ativou, está no horário e dentro da janela de 24 h. A reivindicação (`last_notice_on`)
 * é um único UPDATE atômico: reinício do servidor ou duas instâncias nunca mandam o mesmo aviso duas vezes (no pior
 * caso uma falha de envio perde o aviso do dia, nunca duplica). Retorna quantos foram enviados.
 */
export const runDailyNotices = async (now: Date = new Date()): Promise<number> => {
  const today = todaySP(now);
  const hour = hourSP(now);
  const windowStart = new Date(now.getTime() - WINDOW_HOURS * 3_600_000).toISOString();
  const { rows } = await pool.query(
    `UPDATE whatsapp_links SET last_notice_on = $1::date
     WHERE verified_at IS NOT NULL AND daily_notice
       AND notice_hour <= $2::int AND $2::int < notice_hour + $3::int
       AND (last_notice_on IS NULL OR last_notice_on < $1::date)
       AND last_inbound_at > $4::timestamptz
     RETURNING user_id, tenant_id, phone, wa_from`,
    [today, hour, CATCH_UP_HOURS, windowStart]
  );

  let sent = 0;
  for (const l of rows) {
    try {
      if (!(await hasEnterprise(l.tenant_id))) continue;
      const text = await buildNotice(l.tenant_id, today, hour);
      if (!text) continue;
      if ((await sendText(l.wa_from || l.phone, text)).ok) sent++;
    } catch (e) {
      console.error("Daily notice error:", e);
    }
  }
  return sent;
};

let running = false;

/** Agenda a verificação a cada minuto. Só liga se o WhatsApp da plataforma estiver configurado. */
export const startDailyNotices = () => {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log("Aviso diário desligado: WhatsApp não configurado");
    return;
  }
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDailyNotices();
    } catch (e) {
      console.error("Daily notice tick error:", e);
    } finally {
      running = false;
    }
  };
  setInterval(tick, 60_000).unref();
};

// ---------- ativar/desativar pelo próprio WhatsApp ----------

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** "ativar aviso diário", "ativar aviso diário às 7h", "desativar aviso diário"; qualquer outra coisa → null. */
export const parseNoticeCommand = (text: string): { enable: boolean; hour?: number } | null => {
  const t = norm(text).trim();
  if (t.length > 80 || !/\baviso/.test(t) || !/\b(diario|contas|vencimentos?)\b/.test(t)) return null;
  if (/\b(desativar|desativa|desligar|desliga|parar|pare|cancelar|cancela|remover|remove)\b/.test(t) || /\bnao quero\b/.test(t)) return { enable: false };
  if (/\b(ativar|ativa|ligar|liga|quero|habilitar|habilita|receber|mandar|manda|enviar|envia)\b/.test(t)) {
    const m = t.match(/\b(\d{1,2})\s*(?:h|hs|horas?)\b/) ?? t.match(/\bas\s+(\d{1,2})\b/);
    return m ? { enable: true, hour: Number(m[1]) } : { enable: true };
  }
  return null;
};

/** Executa o comando e devolve a resposta, ou null se a mensagem não é um comando de aviso. */
export const noticeCommand = async (userId: number, text: string): Promise<string | null> => {
  const cmd = parseNoticeCommand(text);
  if (!cmd) return null;
  if (!cmd.enable) {
    await pool.query("UPDATE whatsapp_links SET daily_notice = FALSE WHERE user_id = $1", [userId]);
    return "🔕 Aviso diário desativado. Para voltar, envie *ativar aviso diário*.";
  }
  if (cmd.hour !== undefined && (cmd.hour < NOTICE_MIN_HOUR || cmd.hour > NOTICE_MAX_HOUR)) {
    return `Escolha um horário entre ${NOTICE_MIN_HOUR}h e ${NOTICE_MAX_HOUR}h. Exemplo: *ativar aviso diário às 7h*.`;
  }
  const { rows } = await pool.query(
    "UPDATE whatsapp_links SET daily_notice = TRUE, notice_hour = COALESCE($2::int, notice_hour) WHERE user_id = $1 RETURNING notice_hour",
    [userId, cmd.hour ?? null]
  );
  const h = rows[0]?.notice_hour ?? NOTICE_DEFAULT_HOUR;
  return [
    `🔔 *Aviso diário ativado!* Todo dia, a partir das ${h}h, eu mando as contas que vencem no dia e as atrasadas (nos dias sem conta, não envio nada).`,
    "",
    "Pela regra do WhatsApp, só consigo avisar se você tiver me escrito nas últimas 24 horas. Se ficar um dia sem falar comigo, o aviso chega assim que você mandar qualquer mensagem.",
    "",
    "Para mudar o horário: *ativar aviso diário às 7h*. Para parar: *desativar aviso diário*.",
  ].join("\n");
};
