import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { ConversaOrigem } from '@prisma/client';
import { ConversasService } from './conversas.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

class PatchConversaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  titulo!: string;
}

class ListConversasQuery {
  @IsOptional()
  @IsString()
  origem?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  repositorioId?: string;
}

/**
 * Histórico de conversas, escopado ao usuário, à empresa e ao repositório.
 * Prompt: POST /ai/prompt grava os turnos. Squad: POST /ai/chat/stream.
 */
@Controller('conversas')
@UseGuards(JwtAuthGuard)
export class ConversasController {
  constructor(private readonly conversas: ConversasService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConversasQuery,
  ) {
    const origem =
      query.origem === 'prompt' || query.origem === 'squad'
        ? (query.origem as ConversaOrigem)
        : undefined;
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    return this.conversas.list(user.empresaId, user.id, {
      origem,
      q: query.q,
      limit: Number.isFinite(limit) ? limit : undefined,
      repositorioId: query.repositorioId,
    });
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('repositorioId') repositorioId?: string,
  ) {
    return this.conversas.getWithMessages(
      user.empresaId,
      user.id,
      id,
      repositorioId,
    );
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: PatchConversaDto,
  ) {
    return this.conversas.rename(user.empresaId, user.id, id, body.titulo);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conversas.remove(user.empresaId, user.id, id);
  }
}
