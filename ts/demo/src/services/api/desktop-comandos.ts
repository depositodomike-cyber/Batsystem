// Atalhos de texto/voz do controle do computador. Funções PURAS (sem
// imports), testadas com `node --test` (desktop-comandos.test.ts).

/** "pare tudo", "Oracle, para tudo!", "parar tudo" — atalho que não passa pela IA. */
export function ehPararTudo(texto: string): boolean {
  const t = texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(oracle )?(pare|para|parar|interrompa|interromper) (tudo|agora)$/.test(t);
}

/**
 * O que fazer com um envio (GB-03): "pare tudo" vale SEMPRE, inclusive
 * enquanto uma resposta está sendo gerada — é justamente quando importa.
 */
export function decidirEnvio(texto: string, carregando: boolean): "parar" | "enviar" | "ignorar" {
  const t = texto.trim();
  if (!t) return "ignorar";
  if (ehPararTudo(t)) return "parar";
  return carregando ? "ignorar" : "enviar";
}
