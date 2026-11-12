/**
 * Extrai o primeiro objeto JSON de uma resposta do modelo. Aceita o JSON puro,
 * dentro de bloco ```json ou com texto em volta. `null` se não houver JSON.
 */
export function extrairJson(texto: string): unknown {
  const semCerca = texto.replace(/```(?:json)?/gi, '');
  const ini = semCerca.indexOf('{');
  const fim = semCerca.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try {
    return JSON.parse(semCerca.slice(ini, fim + 1));
  } catch {
    return null;
  }
}
