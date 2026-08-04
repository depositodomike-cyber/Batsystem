import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AiConnectionsService } from './connections.service';
import { SetConnectionDto } from './dto/connection.dto';
import { PROVIDER_CATALOG } from './providers';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiConnectionsController {
  constructor(private readonly connections: AiConnectionsService) {}

  /** GET /ai/providers → catálogo de provedores e modelos. */
  @Get('providers')
  catalog() {
    return PROVIDER_CATALOG;
  }

  /** GET /ai/connection → conexão atual do tenant (sem a chave). */
  @Get('connection')
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.connections.getPublic(user.empresaId);
  }

  /** PUT /ai/connection → conecta/substitui o provedor de IA do tenant. */
  @Put('connection')
  set(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetConnectionDto) {
    return this.connections.upsert(user.empresaId, dto);
  }

  /** DELETE /ai/connection → desconecta. */
  @Delete('connection')
  async remove(@CurrentUser() user: AuthenticatedUser) {
    await this.connections.remove(user.empresaId);
    return { ok: true };
  }
}
