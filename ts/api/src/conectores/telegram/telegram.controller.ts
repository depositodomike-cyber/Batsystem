import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { AcessoConectores } from '../acesso-conectores';
import { CONECTOR_TELEGRAM, TelegramVinculoService } from './telegram-vinculo.service';
import { TelegramCaixaService } from './telegram-caixa.service';
import { TelegramProcessadorService } from './telegram-processador.service';

class ConfirmarDto {
  @IsIn(['notas', 'repositorio'])
  destino!: 'notas' | 'repositorio';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;
}

/**
 * Telegram (conector pessoal). Conectar = gerar o código e enviá-lo ao bot;
 * desconectar = DELETE /conectores/telegram (ConectoresController).
 * Tudo aqui é escopado ao usuário logado.
 */
@Controller('conectores/telegram')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(
    private readonly vinculos: TelegramVinculoService,
    private readonly caixa: TelegramCaixaService,
    private readonly processador: TelegramProcessadorService,
    private readonly acesso: AcessoConectores,
  ) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.vinculos.status(user.id);
  }

  @Post('codigo')
  async codigo(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
  ) {
    await this.acesso.exigirPodeAlterar(user, CONECTOR_TELEGRAM);
    return this.vinculos.gerarCodigo(user, repositorioId);
  }

  @Delete('codigo')
  async cancelarCodigo(@CurrentUser() user: AuthenticatedUser) {
    await this.vinculos.cancelarCodigo(user.id);
    return { ok: true };
  }

  @Get('pendentes')
  pendentes(@CurrentUser() user: AuthenticatedUser) {
    return this.caixa.pendentes(user.id);
  }

  @Get('mensagens/:id/audio')
  async audio(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const a = await this.caixa.audio(user.id, id);
    return new StreamableFile(a.buffer, { type: a.mime, length: a.buffer.length });
  }

  @Post('mensagens/:id/confirmar')
  confirmar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmarDto,
  ) {
    return this.caixa.confirmar(user.id, id, dto.destino, dto.path);
  }

  @Post('mensagens/:id/tentar-novamente')
  async tentarNovamente(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { ok: await this.processador.tentarNovamente(user.id, id) };
  }
}
