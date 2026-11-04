import crypto from "crypto";

// Sessão assinada (HMAC-SHA256) para o cookie do usuário e do admin.
//
// Antes o cookie era só `user_<id>` / `admin_<id>`: qualquer pessoa podia fabricar um cookie
// com o id de outro usuário (ou de um admin) e entrar como ele. Agora o valor é
//   v1.<tipo>.<id>.<expira em segundos>.<assinatura>
// e a assinatura cobre também o hash da senha atual (`secretVersion`), que nunca sai do servidor:
// trocar ou redefinir a senha derruba as sessões abertas dessa conta.

export type SessionKind = "user" | "admin";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const VERSION = "v1";
const KIND_CODE: Record<SessionKind, string> = { user: "u", admin: "a" };

let signingKey: Buffer | null = null;

const getKey = (): Buffer => {
  if (signingKey) return signingKey;
  const master = process.env.SESSION_SECRET || process.env.SECRETS_KEY;
  if (master && master.length >= 16) {
    // Chave derivada com rótulo próprio: não reaproveita o SECRETS_KEY (AES) diretamente como chave HMAC.
    signingKey = crypto.createHmac("sha256", master).update("finanpop:session:v1").digest();
  } else {
    // Sem segredo configurado a chave é aleatória por processo: nada pode ser forjado,
    // mas as sessões deixam de valer a cada reinício. Defina SESSION_SECRET na Railway.
    console.warn("[session] SESSION_SECRET/SECRETS_KEY ausentes: usando chave temporária (sessões não sobrevivem a reinícios).");
    signingKey = crypto.randomBytes(32);
  }
  return signingKey;
};

/** Só para testes: força a releitura do segredo do ambiente. */
export const _resetSessionKeyForTests = (): void => {
  signingKey = null;
};

const sign = (kind: SessionKind, id: number, exp: number, secretVersion: string): Buffer =>
  crypto
    .createHmac("sha256", getKey())
    .update(`${VERSION}.${KIND_CODE[kind]}.${id}.${exp}.${secretVersion}`)
    .digest();

/** Gera o valor do cookie. `secretVersion` = hash da senha gravado no banco para essa conta. */
export const issueSession = (kind: SessionKind, id: number, secretVersion: string, nowMs = Date.now()): string => {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  return `${VERSION}.${KIND_CODE[kind]}.${id}.${exp}.${sign(kind, id, exp, secretVersion).toString("base64url")}`;
};

interface ParsedSession {
  id: number;
  exp: number;
  mac: Buffer;
}

const parse = (kind: SessionKind, token: string | undefined | null): ParsedSession | null => {
  if (!token || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [version, k, idStr, expStr, macStr] = parts;
  if (version !== VERSION || k !== KIND_CODE[kind]) return null;
  if (!/^\d{1,12}$/.test(idStr) || !/^\d{1,12}$/.test(expStr)) return null;
  const id = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const mac = Buffer.from(macStr, "base64url");
  if (mac.length !== 32) return null;
  return { id, exp, mac };
};

/**
 * Passo 1: lê o id declarado no cookie (ainda NÃO autenticado) só para buscar a conta no banco.
 * Nunca use este id como identidade sem passar por verifySession.
 */
export const peekSessionId = (kind: SessionKind, token: string | undefined | null): number | null =>
  parse(kind, token)?.id ?? null;

/** Passo 2: confere assinatura e validade com o hash de senha atual. Devolve o id autenticado ou null. */
export const verifySession = (
  kind: SessionKind,
  token: string | undefined | null,
  secretVersion: string,
  nowMs = Date.now()
): number | null => {
  const p = parse(kind, token);
  if (!p) return null;
  if (p.exp * 1000 <= nowMs) return null;
  const expected = sign(kind, p.id, p.exp, secretVersion);
  if (expected.length !== p.mac.length || !crypto.timingSafeEqual(expected, p.mac)) return null;
  return p.id;
};
