import {
  Body,
  Controller,
  Get,
  HttpException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import { OrganizacaoAtual } from '@/common/organizacao-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { OrquestradorService, type EventoOrquestrador } from './orquestrador.service';
import { OrquestrarDto } from './dto/orquestrar.dto';
import { DecisaoDto } from './dto/decisao.dto';

type Enviar = (payload: EventoOrquestrador | { type: 'done' }) => void;

/**
 * Rotas do orquestrador, atrás da flag `ORQUESTRADOR_ATIVO=true`. Desligado,
 * respondem 404 como se não existissem.
 *
 * Diferente do /ai/prompt, aqui `ia.usar` é exigida de fato: as ferramentas
 * declaram essa permissão e a rota nova não tem comportamento antigo a
 * preservar. Permissões mais específicas (ex.: `documentos.enviar` para
 * salvar no Repositório) são conferidas por ferramenta, na política.
 */
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissoesGuard)
@RequerPermissao('ia.usar')
export class OrquestradorController {
  private readonly logger = new Logger(OrquestradorController.name);

  constructor(
    private readonly orquestrador: OrquestradorService,
    private readonly config: ConfigService,
  ) {}

  private exigirAtivo(): void {
    if (this.config.get<string>('ORQUESTRADOR_ATIVO', 'false').trim() !== 'true') {
      throw new NotFoundException();
    }
  }

  /**
   * Abre o SSE e roda `trabalho`. A desconexão NÃO cancela: a execução
   * termina e a resposta fica gravada na conversa — só paramos de escrever.
   */
  private async comSse(res: Response, trabalho: (enviar: Enviar) => Promise<void>): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    let clienteSaiu = false;
    res.on('close', () => {
      clienteSaiu = true;
    });
    const enviar: Enviar = (payload) => {
      if (!clienteSaiu) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
    try {
      await trabalho(enviar);
    } catch (err) {
      this.logger.error(err);
      const message =
        err instanceof HttpException
          ? String((err.getResponse() as { message?: string }).message ?? err.message)
          : 'Erro ao processar o pedido. Tente novamente.';
      enviar({ type: 'error', message });
    } finally {
      enviar({ type: 'done' });
      res.end();
    }
  }

  /**
   * POST /ai/orquestrar → SSE. Eventos (`data: {type, ...}`):
   * rota · execucao · plano · etapa (várias) · resposta | aprovacao | error · done.
   * Na rota direta vêm só rota → resposta → done.
   */
  @Post('orquestrar')
  async orquestrar(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioDoHeader: string | null,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Body() dto: OrquestrarDto,
    @Res() res: Response,
  ): Promise<void> {
    this.exigirAtivo();
    await this.comSse(res, (enviar) =>
      this.orquestrador.orquestrar(
        {
          user,
          texto: dto.texto,
          modo: dto.modo,
          historico: dto.historico ?? [],
          referencia: dto.referencia,
          conversaId: dto.conversaId,
          // Mesma precedência do /ai/prompt: corpo, depois header.
          repositorioId: dto.repositorioId?.trim() || repositorioDoHeader || null,
          organizacaoId,
          agentesSistema: dto.agentesSistema ?? null,
          origem: dto.origem,
          alternativas: dto.alternativas ?? [],
        },
        enviar,
      ),
    );
  }

  /**
   * POST /ai/aprovacoes/:id/decisao → SSE. Registra a decisão e, se era a
   * última pendente, continua a execução: etapa · resposta | aprovacao |
   * aguardando | error · done. Conflito (já decidida) chega como `error`.
   */
  @Post('aprovacoes/:id/decisao')
  async decidir(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecisaoDto,
    @Res() res: Response,
  ): Promise<void> {
    this.exigirAtivo();
    await this.comSse(res, (enviar) =>
      this.orquestrador.decidir(user, id, dto.aprovar, dto.motivo, enviar),
    );
  }

  /**
   * GET /ai/execucoes/abertas → execuções que ainda pedem algo do usuário:
   * esperando aprovação, interrompidas por queda ou ainda rodando.
   * Declarada antes de `execucoes/:id` (o Nest casa as rotas na ordem).
   */
  @Get('execucoes/abertas')
  abertas(@CurrentUser() user: AuthenticatedUser) {
    this.exigirAtivo();
    return this.orquestrador.abertas(user);
  }

  /**
   * POST /ai/execucoes/:id/retomar → SSE. Continua uma execução interrompida
   * do último checkpoint: execucao · etapa · resposta | aprovacao | error · done.
   */
  @Post('execucoes/:id/retomar')
  async retomar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    this.exigirAtivo();
    await this.comSse(res, (enviar) => this.orquestrador.retomarInterrompida(user, id, enviar));
  }

  /** POST /ai/execucoes/:id/cancelar → descarta uma execução parada. */
  @Post('execucoes/:id/cancelar')
  cancelar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.exigirAtivo();
    return this.orquestrador.cancelar(user, id);
  }

  /** GET /ai/execucoes/:id → estado, etapas e aprovações de uma execução do usuário. */
  @Get('execucoes/:id')
  obter(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.exigirAtivo();
    return this.orquestrador.obter(user, id);
  }
}
