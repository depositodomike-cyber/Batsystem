/**
 * Ativação por voz ("wake word") — configuração.
 *
 * A detecção da palavra roda LOCALMENTE, no navegador, com o Vosk (código
 * aberto, WebAssembly): sem conta, sem chave e sem enviar áudio para fora
 * enquanto o Oracle espera a palavra. Só depois de detectá-la é que o ditado
 * começa, e aí sim usa o reconhecimento de fala do navegador (Web Speech API).
 *
 * Precisa só do modelo de idioma do Vosk, fora do git (ver
 * docs/ativacao-por-voz.md): `ts/demo/public/wake/<modelo>.tar.gz`.
 * O modelo, as palavras e o rótulo podem ser trocados pelas variáveis abaixo
 * (em `ts/demo/.env.local`).
 */

const env = import.meta.env;

function lista(valor: string | undefined, padrao: string[]): string[] {
  const itens = (valor ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return itens.length ? itens : padrao;
}

export const WAKE_WORD = {
  /** Como a palavra aparece na interface. */
  rotulo: (env.VITE_WAKE_WORD_LABEL as string | undefined)?.trim() || "Oracle",
  /**
   * Palavras que acionam o Oracle. Precisam existir no vocabulário do modelo
   * (no modelo em inglês, "oracle" existe; no português, use algo como
   * "oráculo").
   */
  palavras: lista(env.VITE_WAKE_WORDS as string | undefined, ["oracle"]),
  /** Modelo do Vosk empacotado em .tar.gz, servido pela pasta `public`. */
  modeloPath:
    (env.VITE_WAKE_MODEL_PATH as string | undefined)?.trim() ||
    "/wake/vosk-model-small-en-us-0.15.tar.gz",
  /**
   * Confiança mínima (0–1) em cada palavra para acionar. Mais alto = mais
   * rigoroso (menos disparos falsos, mas pode exigir falar mais claro).
   */
  confianca: Math.min(
    1,
    Math.max(0, Number(env.VITE_WAKE_CONFIDENCE) || 0.85),
  ),
  /** Idioma do ditado que começa depois da palavra. */
  idiomaDitado: "pt-BR",
};
