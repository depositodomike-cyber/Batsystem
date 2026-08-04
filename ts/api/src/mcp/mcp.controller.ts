import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpKeysService } from './mcp-keys.service';
import { McpServerFactory } from './mcp-server.factory';

/**
 * Endpoint MCP (Streamable HTTP) — é aqui que clientes externos
 * (Claude, Cursor, VS Code etc.) se conectam:
 *
 *   URL:  POST https://<host>/mcp
 *   Auth: Authorization: Bearer bcl_mcp_...  (ou header x-api-key)
 *
 * Modo stateless: cada request cria servidor+transporte descartáveis e não
 * há sessão (sessionIdGenerator: undefined), o que permite escalar
 * horizontalmente sem sticky sessions. GET (stream de notificações) e
 * DELETE (encerrar sessão) não se aplicam e respondem 405.
 */
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly keys: McpKeysService,
    private readonly factory: McpServerFactory,
  ) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.method !== 'POST') {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Método não permitido. Use POST.' },
        id: null,
      });
      return;
    }

    const rawKey = this.extractKey(req);
    const tenant = rawKey ? await this.keys.resolve(rawKey) : null;
    if (!tenant) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message:
            'Não autorizado: informe uma API key válida em "Authorization: Bearer <chave>". ' +
            'Gere a chave no beculture (Configurações → MCP).',
        },
        id: null,
      });
      return;
    }

    const server = this.factory.build(tenant.empresaId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      this.logger.error(err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Erro interno do servidor MCP.' },
          id: null,
        });
      }
    }
  }

  private extractKey(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    // Fallback para clientes que só suportam header customizado.
    const xKey = req.headers['x-api-key'];
    if (typeof xKey === 'string' && xKey.trim()) return xKey.trim();
    return null;
  }
}
