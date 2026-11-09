import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { BriefingService } from './briefing.service';
import type { OperacoesCliente, Periodo } from './briefing.tipos';

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

class JanelaDto {
  /** Data local do usuário (YYYY-MM-DD). */
  @Matches(DATA_RE)
  data!: string;

  @IsIn(['manha', 'noite'])
  periodo!: Periodo;

  /** Fuso IANA do navegador (ex.: America/Sao_Paulo). */
  @IsString()
  @MaxLength(64)
  fuso!: string;

  /** Início do dia local (ISO). */
  @IsISO8601()
  inicio!: string;

  /** Fim de amanhã, local (ISO). */
  @IsISO8601()
  fim!: string;
}

class GerarBriefingDto extends JanelaDto {
  /** Tarefas abertas do quadro (vivem no navegador). */
  @IsOptional()
  @IsArray()
  tarefas?: OperacoesCliente['tarefas'];

  @IsOptional()
  @IsArray()
  projetos?: OperacoesCliente['projetos'];
}

function fusoValido(fuso: string): string {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: fuso });
    return fuso;
  } catch {
    throw new BadRequestException('Fuso horário inválido.');
  }
}

/**
 * Resumo Matinal. Pertence ao usuário do JWT; o Repositório ativo vem pelo
 * header (mesma regra do vault — sem header, não lê notas).
 */
@Controller('briefing')
@UseGuards(JwtAuthGuard)
export class BriefingController {
  constructor(private readonly briefing: BriefingService) {}

  @Get()
  async obter(
    @CurrentUser() user: AuthenticatedUser,
    @Query('data') data: string,
    @Query('periodo') periodo: string,
  ) {
    if (!DATA_RE.test(data ?? '') || !['manha', 'noite'].includes(periodo)) {
      throw new BadRequestException('Parâmetros inválidos.');
    }
    return { briefing: await this.briefing.obter(user.empresaId, user.id, data, periodo as Periodo) };
  }

  @Post('verificar')
  verificar(@CurrentUser() user: AuthenticatedUser, @Body() body: JanelaDto) {
    return this.briefing.verificar(user.empresaId, user.id, body.data, body.periodo, {
      inicio: body.inicio,
      fim: body.fim,
    });
  }

  @Post('gerar')
  async gerar(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: GerarBriefingDto,
  ) {
    const limpar = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
    const tarefas = (body.tarefas ?? [])
      .filter((t) => t && typeof t.titulo === 'string')
      .slice(0, 40)
      .map((t) => ({
        id: String(t.id ?? '').slice(0, 64),
        titulo: t.titulo.slice(0, 200),
        status: limpar(t.status, 40),
        prioridade: limpar(t.prioridade, 20),
        prazo: limpar(t.prazo, 40),
        projeto: limpar(t.projeto, 120),
      }));
    const projetos = (body.projetos ?? [])
      .filter((p) => p && typeof p.nome === 'string')
      .slice(0, 20)
      .map((p) => ({ id: String(p.id ?? '').slice(0, 64), nome: p.nome.slice(0, 160), descricao: limpar(p.descricao, 300) }));
    const briefing = await this.briefing.gerar({
      empresaId: user.empresaId,
      usuarioId: user.id,
      repositorioId,
      data: body.data,
      periodo: body.periodo,
      fuso: fusoValido(body.fuso),
      janela: { inicio: body.inicio, fim: body.fim },
      operacoes: { tarefas, projetos },
    });
    return { briefing };
  }
}
