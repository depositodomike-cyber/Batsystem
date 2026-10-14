import {
  Body,
  Controller,
  Delete,
  Get,
  BadRequestException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AgentesService, type EscopoAgente } from './agentes.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { OrganizacaoAtual } from '@/common/organizacao-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

class SalvarAgenteDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome do agente.' })
  @MaxLength(80, { message: 'O nome pode ter até 80 caracteres.' })
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(41)
  mencao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição pode ter até 500 caracteres.' })
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000, { message: 'As instruções podem ter até 8000 caracteres.' })
  instrucoes?: string;

  /** Chave do ícone do avatar (ex.: "agente:lampada"); null = iniciais. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icone?: string | null;
}

/**
 * Agentes mencionáveis no Assistente (@menção). GET devolve os do sistema, os
 * do usuário e os da organização ativa.
 *
 * - `/agentes[/:id]`: agentes PESSOAIS — só do próprio usuário.
 * - `/agentes/organizacao[/:id]`: agentes da ORGANIZAÇÃO ativa (header
 *   X-Organizacao-Id). Quem pode criar/editar é decidido na interface pelo
 *   papel na organização, como no Repositório da organização — as
 *   organizações do protótipo só existem no cliente. O servidor garante o
 *   isolamento entre organizações.
 *
 * Empresa e usuário vêm do JWT, nunca do cliente.
 */
@Controller('agentes')
@UseGuards(JwtAuthGuard)
export class AgentesController {
  constructor(private readonly agentes: AgentesService) {}

  @Get()
  async listar(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
  ) {
    const [sistema, meus, organizacao] = await Promise.all([
      // Sem os que a organização editou (vêm em `organizacao`) ou excluiu.
      this.agentes.sistemaDaOrganizacao(user.empresaId, organizacaoId),
      this.agentes.meus(user.empresaId, user.id),
      this.agentes.daOrganizacao(user.empresaId, organizacaoId),
    ]);
    return { sistema, meus, organizacao };
  }

  // ------------------------------------------------ Agentes da organização
  // Declarados ANTES de `:id`: o Nest casa as rotas na ordem.

  /**
   * PATCH /agentes/organizacao/sistema/:sistemaId → edita um agente do
   * sistema SÓ nesta organização (cria a versão própria dela).
   */
  @Patch('organizacao/sistema/:sistemaId')
  editarSistemaDaOrganizacao(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Param('sistemaId') sistemaId: string,
    @Body() body: SalvarAgenteDto,
  ) {
    return this.agentes.editarSistemaNaOrganizacao(
      user.empresaId,
      escopoDaOrganizacao(organizacaoId, user),
      sistemaId,
      body,
    );
  }

  /** DELETE /agentes/organizacao/sistema/:sistemaId → tira da organização. */
  @Delete('organizacao/sistema/:sistemaId')
  excluirSistemaDaOrganizacao(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Param('sistemaId') sistemaId: string,
  ) {
    return this.agentes.excluirSistemaNaOrganizacao(
      user.empresaId,
      escopoDaOrganizacao(organizacaoId, user),
      sistemaId,
    );
  }

  @Post('organizacao')
  criarDaOrganizacao(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Body() body: SalvarAgenteDto,
  ) {
    return this.agentes.criar(
      user.empresaId,
      escopoDaOrganizacao(organizacaoId, user),
      body,
    );
  }

  @Patch('organizacao/:id')
  atualizarDaOrganizacao(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Param('id') id: string,
    @Body() body: SalvarAgenteDto,
  ) {
    return this.agentes.atualizar(
      user.empresaId,
      escopoDaOrganizacao(organizacaoId, user),
      id,
      body,
    );
  }

  @Delete('organizacao/:id')
  excluirDaOrganizacao(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Param('id') id: string,
  ) {
    return this.agentes.excluir(
      user.empresaId,
      escopoDaOrganizacao(organizacaoId, user),
      id,
    );
  }

  // ------------------------------------------------------ Agentes pessoais

  @Post()
  criar(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Body() body: SalvarAgenteDto,
  ) {
    return this.agentes.criar(
      user.empresaId,
      { tipo: 'pessoal', usuarioId: user.id },
      body,
      organizacaoId,
    );
  }

  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Param('id') id: string,
    @Body() body: SalvarAgenteDto,
  ) {
    return this.agentes.atualizar(
      user.empresaId,
      { tipo: 'pessoal', usuarioId: user.id },
      id,
      body,
      organizacaoId,
    );
  }

  @Delete(':id')
  excluir(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agentes.excluir(
      user.empresaId,
      { tipo: 'pessoal', usuarioId: user.id },
      id,
    );
  }
}

function escopoDaOrganizacao(
  organizacaoId: string | null,
  user: AuthenticatedUser,
): Extract<EscopoAgente, { tipo: 'organizacao' }> {
  if (!organizacaoId) {
    throw new BadRequestException('Nenhuma organização ativa.');
  }
  return {
    tipo: 'organizacao',
    organizacaoId,
    usuarioId: user.id,
  };
}
