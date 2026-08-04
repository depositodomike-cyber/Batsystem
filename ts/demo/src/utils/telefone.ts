/**
 * Utilidades de telefone (BR): máscara para exibição e validação simples por
 * quantidade de dígitos. Aceita fixo (10 dígitos) e celular (11 dígitos), ambos
 * com DDD. Sem dependências externas.
 */

/** Mantém só dígitos e limita a 11 caracteres (DDD + 9 dígitos). */
export function onlyDigitsTelefone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * Aplica a máscara conforme o usuário digita:
 * - até 10 dígitos → (00) 0000-0000
 * - 11 dígitos     → (00) 00000-0000
 */
export function maskTelefone(value: string): string {
  const d = onlyDigitsTelefone(value);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length > 8 ? 5 : 4; // celular (9 dígitos) vs. fixo
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Valida um telefone BR (10 ou 11 dígitos, com DDD). */
export function isValidTelefone(value: string): boolean {
  const len = onlyDigitsTelefone(value).length;
  return len === 10 || len === 11;
}
