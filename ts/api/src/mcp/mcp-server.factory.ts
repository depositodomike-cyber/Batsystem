import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ConectoresService } from '@/conectores/conectores.service';
import { SlackApiService } from '@/conectores/slack-api.service';

/** Serializa o resultado de uma ferramenta como JSON legível. */
function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Monta uma instância do servidor MCP do beculture com as ferramentas
 * escopadas à empresa autenticada. Uma instância nova é criada por request
 * (transporte Streamable HTTP sem sessão — stateless e escalável
 * horizontalmente); a montagem é barata, só registra os handlers.
 */
@Injectable()
export class McpServerFactory {
  constructor(
    private readonly conectores: ConectoresService,
    private readonly slack: SlackApiService,
  ) {}

  build(empresaId: string): McpServer {
    const server = new McpServer(
      { name: 'beculture', version: '0.1.0' },
      {
        instructions:
          'Servidor MCP do beculture. Gerencia os conectores (integrações) ' +
          'da empresa: liste o catálogo por categoria, consulte detalhes e ' +
          'permissões de cada conector e ative ou desative integrações. ' +
          'Quando o Slack está autorizado via OAuth (Conectores → Slack → ' +
          'Conectar no app), as ferramentas slack_* operam no workspace real.',
      },
    );

    server.registerTool(
      'listar_categorias',
      {
        title: 'Listar categorias de conectores',
        description:
          'Lista as categorias do catálogo de conectores (id, nome e descrição).',
        inputSchema: {},
      },
      () => jsonResult(this.conectores.categories()),
    );

    server.registerTool(
      'listar_conectores',
      {
        title: 'Listar conectores',
        description:
          'Lista os conectores do catálogo com o estado de conexão da empresa ' +
          '(connected/connectedAt). Pode filtrar por categoria ou listar só os conectados.',
        inputSchema: {
          categoria: z
            .string()
            .optional()
            .describe('Id da categoria (ex.: "rh", "comunicacao").'),
          apenas_conectados: z
            .boolean()
            .optional()
            .describe('Quando true, retorna apenas os conectores ativos.'),
        },
      },
      async ({ categoria, apenas_conectados }) =>
        jsonResult(
          await this.conectores.list(empresaId, {
            categoria,
            apenasConectados: apenas_conectados,
          }),
        ),
    );

    server.registerTool(
      'obter_conector',
      {
        title: 'Obter conector',
        description:
          'Detalhes de um conector (objetivo, permissões) e seu estado de conexão.',
        inputSchema: {
          id: z.string().describe('Id do conector (ex.: "slack", "gupy").'),
        },
      },
      async ({ id }) => jsonResult(await this.conectores.get(empresaId, id)),
    );

    server.registerTool(
      'conectar_conector',
      {
        title: 'Conectar conector',
        description:
          'Ativa um conector para a empresa. Idempotente: conectar um conector ' +
          'já ativo não tem efeito.',
        inputSchema: {
          id: z.string().describe('Id do conector a ativar.'),
        },
      },
      async ({ id }) =>
        jsonResult(await this.conectores.connect(empresaId, id, 'mcp')),
    );

    server.registerTool(
      'desconectar_conector',
      {
        title: 'Desconectar conector',
        description:
          'Desativa um conector da empresa. Idempotente: desconectar um conector ' +
          'já inativo não tem efeito.',
        inputSchema: {
          id: z.string().describe('Id do conector a desativar.'),
        },
      },
      async ({ id }) =>
        jsonResult(await this.conectores.disconnect(empresaId, id)),
    );

    // ---------- Slack (integração real, requer OAuth no app) ----------

    server.registerTool(
      'slack_listar_canais',
      {
        title: 'Slack: listar canais',
        description:
          'Lista os canais públicos do workspace Slack autorizado pela empresa. ' +
          'Requer o Slack conectado via OAuth no app beculture.',
        inputSchema: {},
      },
      async () => jsonResult(await this.slack.listChannels(empresaId)),
    );

    server.registerTool(
      'slack_enviar_mensagem',
      {
        title: 'Slack: enviar mensagem',
        description:
          'Envia uma mensagem em um canal do workspace Slack autorizado. ' +
          'A mensagem aparece como o app beculture.',
        inputSchema: {
          canal: z
            .string()
            .describe('Canal de destino: id (C0123…) ou nome (#geral).'),
          texto: z.string().describe('Texto da mensagem.'),
        },
      },
      async ({ canal, texto }) =>
        jsonResult(await this.slack.postMessage(empresaId, canal, texto)),
    );

    return server;
  }
}
