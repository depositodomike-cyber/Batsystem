import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AiMediaKind } from '@prisma/client';
import { AiMediaConnectionsService } from './media-connections.service';
import { SetMediaConnectionDto } from './dto/media-connection.dto';
import { ReorderConnectionsDto } from './dto/reorder.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/** Valida o segmento :kind da rota (image | video). */
function parseKind(kind: string): AiMediaKind {
  if (kind === 'image' || kind === 'video') return kind;
  throw new BadRequestException('Modalidade inválida (use image ou video).');
}

@Controller('ai/media')
@UseGuards(JwtAuthGuard)
export class AiMediaConnectionsController {
  constructor(private readonly media: AiMediaConnectionsService) {}

  /** GET /ai/media/:kind/providers → catálogo da modalidade. */
  @Get(':kind/providers')
  catalog(@Param('kind') kind: string) {
    return this.media.catalog(parseKind(kind));
  }

  /** GET /ai/media/:kind/connections → fila de modelos da modalidade. */
  @Get(':kind/connections')
  list(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string) {
    return this.media.listPublic(user.empresaId, parseKind(kind));
  }

  /** PUT /ai/media/:kind/connections → adiciona um modelo a partir de uma chave. */
  @Put(':kind/connections')
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: string,
    @Body() dto: SetMediaConnectionDto,
  ) {
    return this.media.upsert(user.empresaId, parseKind(kind), dto);
  }

  /** PUT /ai/media/:kind/connections/order → grava a nova ordem de prioridade. */
  @Put(':kind/connections/order')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: string,
    @Body() dto: ReorderConnectionsDto,
  ) {
    return this.media.reorder(user.empresaId, parseKind(kind), dto.ids);
  }

  /** DELETE /ai/media/:kind/connections/:id → remove um modelo da fila. */
  @Delete(':kind/connections/:id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    await this.media.remove(user.empresaId, parseKind(kind), id);
    return { ok: true };
  }

  /**
   * GET /ai/media/:kind → conexão principal da modalidade (sem a chave).
   * Compatibilidade: atende clientes antigos que ainda esperam uma única
   * conexão. O front atual usa `GET /ai/media/:kind/connections`.
   */
  @Get(':kind')
  get(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string) {
    return this.media.getPublic(user.empresaId, parseKind(kind));
  }
}
