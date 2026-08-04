// Saneamento de texto antes de virar JSON de request para o provedor de IA.
//
// Emoji e outros caracteres fora do BMP ocupam DOIS code units em JavaScript
// (um par surrogate). Um `.slice(0, N)` pode cair no meio do par e deixar só a
// primeira metade na string — um "lone surrogate". `JSON.stringify` serializa
// isso como \udXXX solto, que não é UTF-8 válido, e a API da Anthropic rejeita
// com 400: "The request body is not valid JSON: no low surrogate in string".
// Como o corte acontece em dezenas de lugares (notas do vault, anexos,
// referências), sanear no limite — na hora de chamar o provedor — é o que
// garante que nenhuma request saia quebrada.

/** Remove surrogates órfãos (metades de par) que quebram a serialização JSON. */
export function sanitizarUnicode(s: string): string {
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

/**
 * Corta a string em `n` code units sem partir um par surrogate ao meio.
 * Use no lugar de `.slice(0, n)` sempre que o texto vier do usuário.
 */
export function cortarSeguro(s: string, n: number): string {
  if (s.length <= n) return s;
  const code = s.charCodeAt(n - 1);
  // Se o último caractere mantido é a primeira metade de um par, descarta-o.
  const fim = code >= 0xd800 && code <= 0xdbff ? n - 1 : n;
  return s.slice(0, fim);
}
