import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AiConnectionsService } from './connections.service';
import { SetConnectionDto } from './dto/connection.dto';
import { ReorderConnectionsDto } from './dto/reorder.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiConnectionsController {
  constructor(private readonly connections: AiConnectionsService) {}

  /** GET /ai/connections → fila de modelos de texto do tenant (sem as chaves). */
  @Get('connections')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.connections.listPublic(user.empresaId);
  }

  /** PUT /ai/connections → adiciona um modelo à fila a partir de uma chave. */
  @Put('connections')
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetConnectionDto) {
    return this.connections.upsert(user.empresaId, dto);
  }

  /** PUT /ai/connections/order → grava a nova ordem de prioridade. */
  @Put('connections/order')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderConnectionsDto,
  ) {
    return this.connections.reorder(user.empresaId, dto.ids);
  }

  /** DELETE /ai/connections/:id → remove um modelo da fila. */
  @Delete('connections/:id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.connections.remove(user.empresaId, id);
    return { ok: true };
  }

  /**
   * GET /ai/connection → conexão principal (sem a chave).
   * Compatibilidade: atende clientes antigos que ainda esperam uma única
   * conexão. O front atual usa `GET /ai/connections`.
   */
  @Get('connection')
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.connections.getPublic(user.empresaId);
  }
}
