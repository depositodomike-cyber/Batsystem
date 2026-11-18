// De QUEM é uma conexão: da pessoa (caixa de e-mail, agenda, Drive) ou da
// organização (todo o resto). Conexão pessoal só é lida por quem a fez — um
// membro nunca enxerga a caixa de outro, nem pelo briefing, nem pelo
// orquestrador, nem pelo MCP.
//
// Slack e Teams ficam como conexões da organização (fora de uso no produto).

/** Conectores ligados à conta de UMA pessoa. */
export const CONECTORES_PESSOAIS: ReadonlySet<string> = new Set([
  'gmail',
  'outlook',
  'google-calendar',
  'google-drive',
  // Bot do Telegram: o vínculo é da conta da pessoa (notas vão ao Repositório dela).
  'telegram',
]);

export function ehPessoal(connectorId: string): boolean {
  return CONECTORES_PESSOAIS.has(connectorId);
}

/**
 * Valor da coluna `titular` (parte da chave única): o id do usuário nas
 * pessoais, "" nas da organização. Pessoal sem usuário é erro de programação.
 */
export function titularDe(connectorId: string, usuarioId: string | null): string {
  if (!ehPessoal(connectorId)) return '';
  if (!usuarioId) {
    throw new Error(`Conector pessoal "${connectorId}" exige o usuário dono da conexão.`);
  }
  return usuarioId;
}

/**
 * Permissão para conectar/desconectar: a PRÓPRIA conta pessoal exige só
 * `conectores.visualizar` (todo membro tem; convidado não); um conector da
 * organização exige `conectores.configurar` (owner/admin).
 */
export function permissaoParaAlterar(connectorId: string): string {
  return ehPessoal(connectorId) ? 'conectores.visualizar' : 'conectores.configurar';
}

/** Chave única Prisma de uma conexão. */
export function chaveConexao(empresaId: string, connectorId: string, usuarioId: string | null) {
  return {
    empresaId_connectorId_titular: {
      empresaId,
      connectorId,
      titular: titularDe(connectorId, usuarioId),
    },
  };
}

/**
 * Filtro das conexões que um usuário pode ver: as da organização e as SUAS
 * pessoais. Sem usuário (MCP), só as da organização.
 */
export function visiveisPara(empresaId: string, usuarioId: string | null) {
  return {
    empresaId,
    OR: [{ titular: '' }, ...(usuarioId ? [{ titular: usuarioId }] : [])],
  };
}
