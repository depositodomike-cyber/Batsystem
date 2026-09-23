import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { CriacaoStatus, CriacaoTipo } from '@prisma/client';
import { CriacoesService } from './criacoes.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const TIPOS = ['apresentacao', 'planilha'] as const;
const STATUS = [
  'rascunho',
  'planejando',
  'plano_pronto',
  'gerando',
  'concluido',
  'erro',
] as const;

class ListarQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(TIPOS) tipo?: CriacaoTipo;
  @IsOptional() @IsIn(STATUS) status?: CriacaoStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(40) cursor?: string;
}

class CriarDto {
  @IsIn(TIPOS) tipo!: CriacaoTipo;
  @IsOptional() @IsString() @MaxLength(200) titulo?: string;
  @IsOptional() @IsIn(STATUS) status?: CriacaoStatus;
  @IsOptional() @IsString() @MaxLength(40) etapa?: string;
  // Sem `@ValidateNested`: o documento é livre por natureza, e o
  // ValidationPipe (whitelist) não desce em objeto sem validação aninhada —
  // então o conteúdo chega intacto. O tamanho é conferido no handler.
  @IsOptional() @IsObject() dados?: Record<string, unknown>;
}

class AtualizarDto {
  @IsOptional() @IsString() @MaxLength(200) titulo?: string;
  @IsOptional() @IsIn(STATUS) status?: CriacaoStatus;
  @IsOptional() @IsString() @MaxLength(40) etapa?: string;
  @IsOptional() @IsObject() dados?: Record<string, unknown>;
}

/**
 * Criações do AI Studio, escopadas ao usuário autenticado.
 *
 * Nenhuma rota aceita `usuarioId`: o proprietário vem sempre do token. É por
 * isso que não existe caminho — por id, por URL, por filtro ou por paginação —
 * que devolva a criação de outra pessoa.
 */
@Controller('criacoes')
@UseGuards(JwtAuthGuard)
export class CriacoesController {
  constructor(private readonly criacoes: CriacoesService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarQuery,
  ) {
    return this.criacoes.listar(user.empresaId, user.id, {
      q: query.q,
      tipo: query.tipo,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get(':id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.criacoes.obter(user.empresaId, user.id, id);
  }

  @Post()
  criar(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: CriarDto,
  ) {
    this.conferirTamanho(body.dados);
    return this.criacoes.criar(user.empresaId, user.id, repositorioId, {
      tipo: body.tipo,
      titulo: body.titulo,
      status: body.status,
      etapa: body.etapa,
      dados: body.dados,
    });
  }

  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AtualizarDto,
  ) {
    this.conferirTamanho(body.dados);
    return this.criacoes.atualizar(user.empresaId, user.id, id, {
      titulo: body.titulo,
      status: body.status,
      etapa: body.etapa,
      dados: body.dados,
    });
  }

  @Delete(':id')
  remover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.criacoes.remover(user.empresaId, user.id, id);
  }

  /** 400 explícito em vez de deixar o Postgres recusar um JSON gigante. */
  private conferirTamanho(dados: unknown): void {
    if (dados !== undefined && CriacoesService.excedeLimite(dados)) {
      throw new BadRequestException(
        'Esta criação ficou grande demais para ser salva automaticamente.',
      );
    }
  }
}
