// ----------------------------------------------------------------------
// Remove o bloco "🔗 Conexões no Vault" de uma resposta do assistente.
//
// O assistente não pede mais esse bloco à IA, mas conversas antigas (e uma ou
// outra resposta fora da regra) ainda o trazem. Vale para a tela e para a voz.
// O bloco vai do título até o próximo título de mesmo nível ou maior, ou o fim.
// ----------------------------------------------------------------------

const TITULO = /^(#{1,6})\s*(?:🔗\s*)?Conex(?:õ|o)es(?:\s+no\s+(?:Vault|Reposit[óo]rio|Mem[óo]ria))?\s*$/im;

export function semConexoesVault(md: string): string {
  const m = TITULO.exec(md);
  if (!m || m.index === undefined) return md;
  const nivel = m[1].length;
  const depois = md.slice(m.index + m[0].length);
  const proximo = new RegExp(`^#{1,${nivel}}\\s`, "m").exec(depois);
  const resto = proximo ? depois.slice(proximo.index) : "";
  return (md.slice(0, m.index).replace(/\s*(?:-{3,}|\*{3,})\s*$/, "").trimEnd() + (resto ? `\n\n${resto}` : "")).trim();
}
