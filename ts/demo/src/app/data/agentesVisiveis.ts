/**
 * Agentes do SISTEMA visíveis na interface (o catálogo pré-programado, antigos
 * squads). Os demais ficam OCULTOS — não aparecem no "@" do Assistente, no
 * botão "Agentes", em Configurações de usuário → Agentes, no catálogo nem no
 * perfil.
 *
 * Ocultar não apaga nada: os agentes seguem no banco, ativos, e as conversas
 * antigas em que responderam continuam identificadas (o nome fica gravado na
 * mensagem). Para voltar a exibir um agente, basta incluir o id dele aqui; com
 * `null`, todos aparecem.
 *
 * Escolha atual — os três mais centrais para uma plataforma de inteligência de
 * pessoas: Cultura, Gestão de Pessoas e Comunicação Interna.
 */
export const AGENTES_SISTEMA_VISIVEIS: readonly string[] | null = [
  "bp.cultura",
  "bp.gestao-pessoas",
  "bp.com-interna",
];

export function agenteSistemaVisivel(id: string): boolean {
  return AGENTES_SISTEMA_VISIVEIS === null || AGENTES_SISTEMA_VISIVEIS.includes(id);
}
