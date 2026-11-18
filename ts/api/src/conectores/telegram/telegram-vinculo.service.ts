// Vínculo entre um usuário do Oracle e a conta do Telegram dele.
//
// Mesmo desenho do pareamento do Ambiente local (desktop/dispositivos.service):
// código curto de uso único (10 min), só o hash no banco, no máximo 5
// tentativas e consumo atômico. A autorização de toda mensagem é pelo
// Telegram User ID do vínculo ativo.
import { createHash, randomInt } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { TelegramVinculo } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { chaveConexao } from '../titular';
import { TelegramApiService } from './telegram-api.service';
import {
  ALFABETO_CODIGO,
  MAX_TENTATIVAS_CODIGO,
  VALIDADE_CODIGO_MS,
} from './telegram-regras';

export const CONECTOR_TELEGRAM = 'telegram';

export function gerarCodigoTelegram(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return s;
}

export const hashCodigoTelegram = (c: string) =>
  createHash('sha256')
    .update(`telegram-vinculo:${c.toUpperCase().replace(/[^A-Z0-9]/g, '')}`)
    .digest('hex');

export interface ContaTelegram {
  telegramUserId: string;
  chatId: string;
  username?: string | null;
  nome?: string | null;
}

export type ResultadoVinculo = 'ok' | 'invalido' | 'ocupado';

/** Status de mensagens que ainda não viraram nota no Repositório. */
export const STATUS_PENDENTES = ['recebida', 'transcrevendo', 'pronta', 'falha', 'nas_notas'];

@Injectable()
export class TelegramVinculoService {
  private readonly logger = new Logger(TelegramVinculoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TelegramApiService,
  ) {}

  /** Gera o código (um ativo por vez) que o usuário envia ao bot. */
  async gerarCodigo(user: AuthenticatedUser, repositorioId: string | null) {
    if (!this.api.configurado()) {
      throw new ServiceUnavailableException(
        'O bot do Telegram não está configurado no servidor (defina TELEGRAM_BOT_TOKEN no .env da API).',
      );
    }
    await this.prisma.telegramCodigoVinculo.deleteMany({
      where: { usuarioId: user.id, usadoEm: null },
    });
    const codigo = gerarCodigoTelegram();
    const expiraEm = new Date(Date.now() + VALIDADE_CODIGO_MS);
    await this.prisma.telegramCodigoVinculo.create({
      data: {
        empresaId: user.empresaId,
        usuarioId: user.id,
        repositorioId,
        codigoHash: hashCodigoTelegram(codigo),
        expiraEm,
      },
    });
    const bot = await this.api.bot();
    return {
      codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}`,
      expiraEm,
      bot: bot?.username ?? null,
      link: bot ? `https://t.me/${bot.username}?start=${codigo}` : null,
    };
  }

  /** Cancela o código ainda não usado. */
  async cancelarCodigo(usuarioId: string): Promise<void> {
    await this.prisma.telegramCodigoVinculo.deleteMany({ where: { usuarioId, usadoEm: null } });
  }

  /**
   * Consome o código enviado ao bot e liga a conta. Mesma resposta para código
   * inexistente, usado, vencido ou bloqueado por tentativas.
   */
  async vincular(codigo: string, conta: ContaTelegram): Promise<ResultadoVinculo> {
    const agora = new Date();
    const c = await this.prisma.telegramCodigoVinculo.findUnique({
      where: { codigoHash: hashCodigoTelegram(codigo) },
    });
    if (!c || c.usadoEm || c.expiraEm <= agora || c.tentativas >= MAX_TENTATIVAS_CODIGO) {
      if (c) {
        await this.prisma.telegramCodigoVinculo.update({
          where: { id: c.id },
          data: { tentativas: { increment: 1 } },
        });
      }
      return 'invalido';
    }

    // A conta do Telegram já é de outra pessoa?
    const existente = await this.prisma.telegramVinculo.findUnique({
      where: { telegramUserId: conta.telegramUserId },
    });
    if (existente && existente.usuarioId !== c.usuarioId) {
      if (!existente.revogadoEm) return 'ocupado';
      // Vínculo antigo revogado: só libera se não houver fila pendente dele.
      const pendentes = await this.prisma.telegramMensagem.count({
        where: { vinculoId: existente.id, status: { in: STATUS_PENDENTES } },
      });
      if (pendentes > 0) return 'ocupado';
    }

    const { count } = await this.prisma.telegramCodigoVinculo.updateMany({
      where: { id: c.id, usadoEm: null },
      data: { usadoEm: agora },
    });
    if (count !== 1) return 'invalido';

    const rotulo = conta.username ? `@${conta.username}` : conta.nome || `ID ${conta.telegramUserId}`;
    await this.prisma.$transaction(async (tx) => {
      if (existente && existente.usuarioId !== c.usuarioId) {
        await tx.telegramVinculo.delete({ where: { id: existente.id } });
      }
      const dados = {
        empresaId: c.empresaId,
        repositorioId: c.repositorioId,
        telegramUserId: conta.telegramUserId,
        chatId: conta.chatId,
        username: conta.username ?? null,
        nome: conta.nome ?? null,
        ultimaComunicacaoEm: agora,
        revogadoEm: null,
      };
      await tx.telegramVinculo.upsert({
        where: { usuarioId: c.usuarioId },
        create: { usuarioId: c.usuarioId, ...dados },
        update: dados,
      });
      // Reaproveita o status/“Conectado”/“Desconectar” dos conectores.
      await tx.empresaConector.upsert({
        where: chaveConexao(c.empresaId, CONECTOR_TELEGRAM, c.usuarioId),
        create: {
          empresaId: c.empresaId,
          connectorId: CONECTOR_TELEGRAM,
          origem: 'app',
          titular: c.usuarioId,
          usuarioId: c.usuarioId,
          teamName: rotulo,
        },
        update: { teamName: rotulo },
      });
    });
    this.logger.log(`Conta do Telegram vinculada (usuário ${c.usuarioId}).`);
    return 'ok';
  }

  /** Vínculo ATIVO da conta do Telegram (null = não autorizado). */
  async autorizado(telegramUserId: string): Promise<TelegramVinculo | null> {
    const v = await this.prisma.telegramVinculo.findUnique({ where: { telegramUserId } });
    return v && !v.revogadoEm ? v : null;
  }

  async registrarComunicacao(vinculoId: string): Promise<void> {
    await this.prisma.telegramVinculo.update({
      where: { id: vinculoId },
      data: { ultimaComunicacaoEm: new Date() },
    });
  }

  /** Estado para o card de Configurações → Conectores. */
  async status(usuarioId: string) {
    const [v, codigo, bot] = await Promise.all([
      this.prisma.telegramVinculo.findUnique({ where: { usuarioId } }),
      this.prisma.telegramCodigoVinculo.findFirst({
        where: { usuarioId, usadoEm: null, expiraEm: { gt: new Date() } },
        select: { expiraEm: true },
      }),
      this.api.bot(),
    ]);
    const porStatus = v
      ? await this.prisma.telegramMensagem.groupBy({
          by: ['status'],
          where: { vinculoId: v.id },
          _count: { _all: true },
        })
      : [];
    const conta = (s: string) => porStatus.find((p) => p.status === s)?._count._all ?? 0;
    const falhas = v
      ? await this.prisma.telegramMensagem.findMany({
          where: { vinculoId: v.id, status: 'falha' },
          orderBy: { recebidaEm: 'desc' },
          take: 20,
          select: {
            id: true,
            tipo: true,
            legenda: true,
            erro: true,
            tentativas: true,
            recebidaEm: true,
            proximaTentativaEm: true,
          },
        })
      : [];
    return {
      configurado: this.api.configurado(),
      bot: bot?.username ?? null,
      conectado: Boolean(v && !v.revogadoEm),
      conta: v ? (v.username ? `@${v.username}` : v.nome) : null,
      telegramUserId: v && !v.revogadoEm ? v.telegramUserId : null,
      desde: v && !v.revogadoEm ? v.criadoEm : null,
      ultimaComunicacaoEm: v?.ultimaComunicacaoEm ?? null,
      codigoPendenteAte: codigo?.expiraEm ?? null,
      fila: {
        processando: conta('recebida') + conta('transcrevendo'),
        prontas: conta('pronta'),
        aguardandoRepositorio: conta('nas_notas'),
        falhas: conta('falha'),
        noRepositorio: conta('no_repositorio'),
      },
      falhas,
    };
  }
}
