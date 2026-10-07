/**
 * Organização dona do Repositório da organização — a que vai no header
 * `X-Organizacao-Id` (ver utils/axios.ts e, no backend, OrganizacaoAtual).
 *
 * Mesmo desenho de `definirRepositorioPastaAtivo` (memoria-inventario.ts):
 * um valor de módulo, mantido em sincronia pelo PrototipoContasProvider, para
 * o interceptor do axios ler sem depender de React.
 *
 * É SEPARADO do repositório ativo de propósito: o repositório ativo aponta para
 * a pasta local do protótipo; a organização é dona da base de conhecimento
 * compartilhada. Trocar de pasta não pode trocar os documentos da organização.
 */
let organizacaoAtual: string | null = null;

export function definirOrganizacaoAtiva(organizacaoId: string | null): void {
  organizacaoAtual = organizacaoId;
}

export function organizacaoAtivaId(): string | null {
  return organizacaoAtual;
}

/**
 * Id do dono do Repositório para o escopo ativo: a organização do repositório
 * aberto, ou — no escopo pessoal, que não tem organização — uma chave própria
 * do usuário, para os documentos dele não caírem num balde comum.
 */
export function donoDoRepositorio(
  organizacaoId: string | null,
  usuarioId: string | null,
): string | null {
  if (organizacaoId) return organizacaoId;
  return usuarioId ? `pessoal:${usuarioId}` : null;
}
