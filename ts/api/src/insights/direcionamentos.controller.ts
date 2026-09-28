import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import {
  DirecionamentosService,
  type DirecionamentoDto,
  type OpcoesFoco,
} from './direcionamentos.service';
import {
  CreateDirecionamentoDto,
  UpdateDirecionamentoDto,
} from './dto/direcionamento.dto';

const PERMISSAO = 'insights.gerenciar_direcionadores';

/**
 * "Direcionador de insights". Ler é livre para quem está logado (a aba é
 * visível a todos); escrever exige `insights.gerenciar_direcionadores`. A
 * regra de foco por área fica no service.
 */
@Controller('ai/insights/direcionamentos')
@UseGuards(JwtAuthGuard)
export class DirecionamentosController {
  constructor(private readonly direcionamentos: DirecionamentosService) {}

  @Get()
  async listar(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ direcionamentos: DirecionamentoDto[] }> {
    return { direcionamentos: await this.direcionamentos.list(user.empresaId) };
  }

  /** Opções de "Onde observar?" para o usuário atual. */
  @Get('opcoes-foco')
  opcoesFoco(@CurrentUser() user: AuthenticatedUser): Promise<OpcoesFoco> {
    return this.direcionamentos.opcoesFoco(user);
  }

  @Post()
  @UseGuards(PermissoesGuard)
  @RequerPermissao(PERMISSAO)
  criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirecionamentoDto,
  ): Promise<DirecionamentoDto> {
    return this.direcionamentos.create(user, dto);
  }

  /** Edição parcial, incluindo ativar/desativar (`{ ativo }`). */
  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequerPermissao(PERMISSAO)
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDirecionamentoDto,
  ): Promise<DirecionamentoDto> {
    return this.direcionamentos.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissoesGuard)
  @RequerPermissao(PERMISSAO)
  async remover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.direcionamentos.remove(user, id);
  }
}
