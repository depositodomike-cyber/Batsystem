/**
 * Identificador de @menção de um agente, a partir do nome: PascalCase, sem
 * espaços nem pontuação, preservando acentos — "Revisor de UX" → "RevisorDeUX",
 * "Gestão de Pessoas" → "GestãoDePessoas", "Dados & BI" → "DadosBI".
 *
 * Palavras inteiras em maiúsculas (siglas) ficam como estão; as demais ganham
 * só a inicial maiúscula.
 */
export function mencaoDe(nome: string): string {
  const palavras = nome
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return palavras
    .map((p) =>
      p === p.toUpperCase() && p.length > 1
        ? p
        : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join('')
    .slice(0, 40);
}

/** Forma de COMPARAÇÃO de menções: sem acento e sem caixa. */
export function chaveMencao(mencao: string): string {
  return mencao
    .replace(/^@/, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Menção válida: só letras e números, 2 a 40 caracteres. */
export function mencaoValida(mencao: string): boolean {
  return /^[\p{L}\p{N}]{2,40}$/u.test(mencao);
}
