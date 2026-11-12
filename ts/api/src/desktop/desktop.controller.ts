import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { DispositivoDesktop } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { AgenteDesktopGuard } from './agente.guard';
import { DispositivosService } from './dispositivos.service';
import { GatewayDesktopService } from './gateway.service';
import { PoliticaDesktopService } from './politica-desktop.service';
import { CATEGORIAS, EXTENSOES_ALTO, EXTENSOES_DOCUMENTO, OPERACOES } from './risco-desktop';

/**
 * Configurações > Organização > Ambiente local. Rotas do DONO (JWT).
 * Corpo validado com zod nos services (os DTOs são `unknown`).
 */
@Controller('desktop')
@UseGuards(JwtAuthGuard, PermissoesGuard)
export class DesktopController {
  constructor(
    private readonly dispositivos: DispositivosService,
    private readonly politicas: PoliticaDesktopService,
    private readonly gateway: GatewayDesktopService,
  ) {}

  /** Tudo o que a tela precisa de uma vez. */
  @Get('estado')
  @RequerPermissao('desktop.usar')
  async estado(@CurrentUser() user: AuthenticatedUser) {
    const lib = this.gateway.liberacao();
    const politica = await this.politicas.obter(user.empresaId, user.id);
    return {
      liberacao: lib,
      dispositivos: lib.ativo ? await this.dispositivos.listar(user) : [],
      politica: {
        versao: politica.versao,
        permissoes: politica.permissoes,
        confirmar: politica.confirmar,
        apps: politica.apps,
        observaveis: politica.observaveis,
        diretorios: politica.diretorios,
        dominios: politica.dominios,
        retencaoDias: politica.retencaoDias,
        autoinicio: politica.autoinicio,
      },
      catalogo: {
        categorias: CATEGORIAS,
        operacoes: Object.entries(OPERACOES).map(([id, o]) => ({ id, ...o })),
        extensoesDocumento: [...EXTENSOES_DOCUMENTO],
        extensoesAlto: [...EXTENSOES_ALTO],
        bloqueadas: [
          'Executar comandos de terminal ou scripts',
          'Apagar arquivos',
          'Alterar registro, serviços, firewall, Defender ou UAC',
          'Elevar privilégios (administrador)',
          'Fechar processos do sistema ou de segurança',
          'Abrir executáveis ou scripts como documento',
        ],
      },
    };
  }

  @Patch('politica')
  @RequerPermissao('desktop.configurar')
  async alterarPolitica(@CurrentUser() user: AuthenticatedUser, @Body() corpo: unknown) {
    const p = await this.politicas.alterar(user.empresaId, user.id, corpo);
    return { versao: p.versao };
  }

  @Post('pareamento')
  @RequerPermissao('desktop.configurar')
  gerarCodigo(@CurrentUser() user: AuthenticatedUser) {
    this.exigirAtivo();
    return this.dispositivos.gerarCodigo(user);
  }

  @Post('dispositivos/:id/confirmar')
  @RequerPermissao('desktop.configurar')
  confirmar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() corpo: { impressaoDigital?: unknown }) {
    this.exigirAtivo();
    return this.dispositivos.confirmar(user, id, String(corpo?.impressaoDigital ?? ''));
  }

  @Post('dispositivos/:id/revogar')
  @RequerPermissao('desktop.configurar')
  revogar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dispositivos.revogar(user, id);
  }

  @Post('dispositivos/:id/retomar')
  @RequerPermissao('desktop.configurar')
  retomar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dispositivos.retomar(user, id);
  }

  /** "Parar tudo": exige só `ia.usar` — qualquer um que possa pedir pode parar. */
  @Post('parar')
  @HttpCode(200)
  @RequerPermissao('ia.usar')
  parar(@CurrentUser() user: AuthenticatedUser) {
    return this.dispositivos.pararTudo(user);
  }

  @Get('historico')
  @RequerPermissao('desktop.usar')
  historico(@CurrentUser() user: AuthenticatedUser, @Query('limite') limite?: string) {
    return this.dispositivos.historico(user, Number(limite) || 50);
  }

  private exigirAtivo() {
    const lib = this.gateway.liberacao();
    if (!lib.ativo) throw new ConflictException(lib.motivo);
  }
}

type ReqAgente = { dispositivo: DispositivoDesktop };

/** Rotas do AGENTE local: sem JWT; assinadas pelo dispositivo. */
@Controller('desktop/agente')
export class AgenteDesktopController {
  constructor(
    private readonly dispositivos: DispositivosService,
    private readonly gateway: GatewayDesktopService,
  ) {}

  /** SR-23: só o código de uso único autentica; throttle estrito por IP. */
  @Post('parear')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  parear(@Body() corpo: unknown) {
    if (!this.gateway.liberacao().ativo) throw new NotFoundException();
    return this.dispositivos.parear(corpo);
  }

  @Post('sincronizar')
  @SkipThrottle()
  @UseGuards(AgenteDesktopGuard)
  sincronizar(@Req() req: ReqAgente, @Body() corpo: unknown) {
    return this.dispositivos.sincronizar(req.dispositivo, corpo);
  }

  @Post('resultados')
  @SkipThrottle()
  @UseGuards(AgenteDesktopGuard)
  resultado(@Req() req: ReqAgente, @Body() corpo: unknown) {
    return this.dispositivos.resultado(req.dispositivo, corpo);
  }
}
