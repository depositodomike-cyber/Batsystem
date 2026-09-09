import { Module } from '@nestjs/common';
import { AcessoModule } from '@/acesso/acesso.module';
import { AuthModule } from '@/auth/auth.module';
import { ConectoresModule } from '@/conectores/conectores.module';
import { McpController } from './mcp.controller';
import { McpKeysController } from './mcp-keys.controller';
import { McpKeysService } from './mcp-keys.service';
import { McpServerFactory } from './mcp-server.factory';

/**
 * Servidor MCP do beculture (endpoint /mcp) + gestão das API keys
 * que os clientes externos usam para se conectar (/mcp/keys).
 */
@Module({
  // `AcessoModule`/`AuthModule` pelo `PermissoesGuard` das rotas de chave.
  imports: [ConectoresModule, AuthModule, AcessoModule],
  controllers: [McpKeysController, McpController],
  providers: [McpKeysService, McpServerFactory],
})
export class McpModule {}
