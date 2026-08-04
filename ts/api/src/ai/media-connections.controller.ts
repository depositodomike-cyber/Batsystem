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

  /** GET /ai/media/:kind → conexão atual da modalidade (sem a chave). */
  @Get(':kind')
  get(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string) {
    return this.media.getPublic(user.empresaId, parseKind(kind));
  }

  /** PUT /ai/media/:kind → conecta/substitui a chave da modalidade. */
  @Put(':kind')
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: string,
    @Body() dto: SetMediaConnectionDto,
  ) {
    return this.media.upsert(user.empresaId, parseKind(kind), dto);
  }

  /** DELETE /ai/media/:kind → desconecta a modalidade. */
  @Delete(':kind')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: string,
  ) {
    await this.media.remove(user.empresaId, parseKind(kind));
    return { ok: true };
  }
}
