// ----------------------------------------------------------------------
// Classes e helpers comuns às telas do Lab (Apresentação, Planilha e as demais
// ferramentas). Antes estavam copiados em cada arquivo.
// ----------------------------------------------------------------------

export const CAMPO =
  "form-input dark:border-dark-450 dark:bg-dark-800 dark:text-dark-100 dark:placeholder:text-dark-300 dark:hover:border-dark-400 focus:border-primary-500 w-full border border-gray-300 bg-white text-sm text-gray-800 placeholder:text-gray-400 hover:border-gray-400 focus:ring-0";
export const CAMPO_SELECT = CAMPO.replace("form-input", "form-select");
// `resize-y` anula de propósito o `resize-none` que vem de `form-textarea`.
export const CAMPO_TEXTAREA = `${CAMPO.replace("form-input", "form-textarea")} resize-y`;
// Caixa de erro com os tokens semânticos do tema (o app usa `text-error`).
export const CAIXA_ERRO =
  "text-xs-plus dark:text-error-lighter border-error/30 bg-error/10 text-error rounded-lg border px-3 py-2";

/** Card neutro do Lab (carregamento, resultado, plano). */
export const CARD_LAB =
  "dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8";

/** Rótulo de campo dentro de uma etapa. */
export const ROTULO_CAMPO =
  "dark:text-dark-100 mb-1.5 block text-sm font-medium text-gray-700";

/** Texto de apoio abaixo de um campo. */
export const AJUDA_CAMPO = "dark:text-dark-300 mt-1.5 text-xs text-gray-500";

/** Mensagem de erro de uma chamada, com fallback genérico. */
export function errMessage(
  err: unknown,
  fallback = "Falha ao gerar. Tente novamente.",
): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; error?: unknown };
    if (typeof o.message === "string") return o.message;
    // Erros de validação do Nest chegam como lista.
    if (Array.isArray(o.message) && typeof o.message[0] === "string") {
      return o.message[0];
    }
    if (typeof o.error === "string") return o.error;
  }
  return fallback;
}
