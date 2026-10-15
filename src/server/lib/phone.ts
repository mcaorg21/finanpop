/**
 * Chave canônica de telefone para comparar o número digitado pelo usuário com o `from` do WhatsApp.
 * Celulares brasileiros chegam ora com o 9º dígito (55 + DDD + 9 + 8 dígitos), ora sem; a chave sempre
 * descarta o 9 extra: 55 + DDD + 8 dígitos. Retorna null se não parecer um telefone.
 */
export const phoneKey = (raw: string): string | null => {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 11 || d.length > 15) return null;
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") d = d.slice(0, 4) + d.slice(5);
  return d;
};
