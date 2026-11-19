/**
 * Origem de uma URL, inclusive do esquema próprio do app.
 *
 * O `URL.origin` do Node devolve "null" para esquemas que ele não conhece
 * (como `oracle-app:`), embora o Chromium trate `oracle-app://app` como uma
 * origem de verdade (esquema registrado como standard). Toda comparação de
 * origem no processo principal passa por aqui.
 */
export function origemDe(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== "null") return u.origin;
    return u.host ? `${u.protocol}//${u.host}` : null;
  } catch {
    return null;
  }
}
