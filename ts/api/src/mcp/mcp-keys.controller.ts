import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { McpKeysService } from './mcp-keys.service';
import { CreateMcpKeyDto } from './dto/create-mcp-key.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Gestão das API keys do servidor MCP da empresa (criar/listar/revogar).
 * Criar e revogar são ações de admin/owner: a chave dá a clientes externos
 * acesso aos dados do tenant.
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
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMcpKeyDto,
  ) {
    this.requireAdmin(user);
    // A resposta inclui `key` (chave crua) — única vez em que ela é exibida.
    return this.keys.create(user.empresaId, dto.nome);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.requireAdmin(user);
    return this.keys.revoke(user.empresaId, id);
  }

  private requireAdmin(user: AuthenticatedUser): void {
    if (user.role !== 'admin' && user.role !== 'owner') {
      throw new ForbiddenException(
        'Apenas administradores podem gerenciar chaves MCP.',
      );
    }
  }
}
