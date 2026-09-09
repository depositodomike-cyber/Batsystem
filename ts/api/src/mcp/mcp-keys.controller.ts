import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { McpKeysService } from './mcp-keys.service';
import { CreateMcpKeyDto } from './dto/create-mcp-key.dto';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Gestão das API keys do servidor MCP da empresa (criar/listar/revogar).
 *
 * Criar e revogar exigem `configuracoes.gerenciar` — o código do catálogo cujo
 * rótulo já é "Gerenciar configurações e chaves de IA". A chave dá a clientes
 * externos acesso aos dados do tenant, então é ação administrativa.
 *
 * Antes, o gate era um `requireAdmin()` que lia só `Usuario.role` e nenhuma
 * role de plataforma alcançava: quem deixasse de ser owner ou admin perdia a
 * gestão de chaves para sempre, mesmo com uma role de acesso total. A troca é
 * aditiva — o `PermissoesGuard` mantém o bypass de owner/admin.
 */
@Controller('mcp/keys')
@UseGuards(JwtAuthGuard)
export class McpKeysController {
  constructor(private readonly keys: McpKeysService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.keys.list(user.empresaId);
  }

  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMcpKeyDto) {
    // A resposta inclui `key` (chave crua) — única vez em que ela é exibida.
    return this.keys.create(user.empresaId, dto.nome);
  }

  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao('configuracoes.gerenciar')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.keys.revoke(user.empresaId, id);
  }
}
