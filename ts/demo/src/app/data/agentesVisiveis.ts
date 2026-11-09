/**
 * Agentes do SISTEMA visíveis na interface (o catálogo pré-programado, antigos
 * squads). Os demais ficam OCULTOS — não aparecem no "@" do Assistente, no
 * botão "Agentes", em Configurações de usuário → Agentes, no catálogo nem no
 * perfil.
 *
 * Ocultar não apaga nada: os agentes seguem no banco, ativos, e as conversas
 * antigas em que responderam continuam identificadas (o nome fica gravado na
 * mensagem).
 *
 * A lista mora na configuração central do Oracle
 * (`configs/oracleModules.ts` › `AGENTES_SISTEMA_VISIVEIS`): especialistas
 * úteis no contexto pessoal. Para voltar a exibir um agente, inclua o id dele
 * lá; com `null`, todos aparecem.
 */
import { AGENTES_SISTEMA_VISIVEIS } from "@/configs/oracleModules";

export { AGENTES_SISTEMA_VISIVEIS };

export function agenteSistemaVisivel(id: string): boolean {
  return AGENTES_SISTEMA_VISIVEIS === null || AGENTES_SISTEMA_VISIVEIS.includes(id);
}
