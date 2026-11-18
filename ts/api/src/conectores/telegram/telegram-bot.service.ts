// Bot do Telegram por LONG POLLING (getUpdates).
//
// Por que não webhook: a API roda em localhost, sem URL pública. Webhook
// exigiria um túnel expondo a API; o long polling só faz chamadas de SAÍDA por
// HTTPS e não abre porta. Com a API desligada, o Telegram guarda os updates
// por 24 h e eles chegam na volta. O loop chama deleteWebhook ao iniciar.
//
// Só liga com TELEGRAM_BOT_TOKEN e nunca em deploy serverless (VERCEL), onde
// não há processo de longa duração.
//
// Entrega: o offset só avança DEPOIS de gravar a mensagem (pelo menos uma
// vez); a chave única chatId+messageId deixa a gravação idempotente.
import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Prisma, type TelegramVinculo } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { comCorrelacao } from '@/common/correlacao';
import { TelegramApiService, type TgMessage, type TgUpdate } from './telegram-api.service';
import { TelegramProcessadorService, resumoErro } from './telegram-processador.service';
import { TelegramVinculoService } from './telegram-vinculo.service';
import { classificar, extrairCodigo, MSG } from './telegram-regras';

export const CURSOR_ID = 'bot';
const TIMEOUT_POLL_S = 25;
/** Um update que falha tantas vezes seguidas é pulado (com log de erro). */
const MAX_FALHAS_UPDATE = 5;

export interface EstadoBot {
  ativo: boolean;
  motivo?: string;
}

export function estadoBot(configurado: boolean, ehVercel: boolean): EstadoBot {
  if (!configurado) return { ativo: false, motivo: 'TELEGRAM_BOT_TOKEN ausente ou inválido.' };
  if (ehVercel) return { ativo: false, motivo: 'Indisponível em deploy serverless (use a API local).' };
  return { ativo: true };
}

@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private abort: AbortController | null = null;
  private falhasPorUpdate = new Map<number, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TelegramApiService,
    private readonly vinculos: TelegramVinculoService,
    private readonly processador: TelegramProcessadorService,
  ) {}

  onApplicationBootstrap(): void {
    const e = estadoBot(this.api.configurado(), Boolean(process.env.VERCEL));
    if (!e.ativo) {
      this.logger.log(`Bot do Telegram desligado: ${e.motivo}`);
      return;
    }
    this.abort = new AbortController();
    void this.iniciar(this.abort.signal);
  }

  onModuleDestroy(): void {
    this.abort?.abort();
    this.processador.parar();
  }

  private async iniciar(sinal: AbortSignal): Promise<void> {
    try {
      await this.processador.recuperar();
    } catch (e) {
      this.logger.error(`Recuperação da fila do Telegram falhou: ${resumoErro(e)}`);
    }
    this.processador.iniciar();
    try {
      await this.api.deleteWebhook();
    } catch (e) {
      this.logger.warn(`deleteWebhook falhou: ${resumoErro(e)}`);
    }
    const bot = await this.api.bot();
    this.logger.log(`Bot do Telegram ativo${bot ? ` (@${bot.username})` : ''} — long polling.`);
    await this.loop(sinal);
  }

  private async loop(sinal: AbortSignal): Promise<void> {
    let falhasSeguidas = 0;
    while (!sinal.aborted) {
      try {
        const offset = await this.lerOffset();
        const updates = await this.api.getUpdates(offset, TIMEOUT_POLL_S, sinal);
        for (const u of updates) {
          if (sinal.aborted) return;
          await this.consumir(u);
        }
        falhasSeguidas = 0;
      } catch (e) {
        if (sinal.aborted) return;
        falhasSeguidas++;
        const espera = Math.min(60_000, 1000 * 2 ** Math.min(falhasSeguidas, 6));
        this.logger.warn(`getUpdates falhou (${falhasSeguidas}x), nova tentativa em ${espera / 1000}s: ${resumoErro(e)}`);
        await dormir(espera, sinal);
      }
    }
  }

  /** Trata um update e só então avança o offset. */
  async consumir(u: TgUpdate): Promise<void> {
    try {
      await comCorrelacao(`tg-${randomUUID().slice(0, 8)}`, () => this.tratarUpdate(u));
      this.falhasPorUpdate.delete(u.update_id);
    } catch (e) {
      const n = (this.falhasPorUpdate.get(u.update_id) ?? 0) + 1;
      this.falhasPorUpdate.set(u.update_id, n);
      if (n < MAX_FALHAS_UPDATE) throw e; // não avança: o próximo poll traz de novo
      this.logger.error(`Update ${u.update_id} do Telegram pulado após ${n} falhas: ${resumoErro(e)}`);
      this.falhasPorUpdate.delete(u.update_id);
    }
    await this.salvarOffset(u.update_id + 1);
  }

  async tratarUpdate(u: TgUpdate): Promise<void> {
    const m = u.message;
    if (!m?.from || m.from.is_bot) return;
    // Só chat privado: grupos e canais são ignorados (sem gravar nada).
    if (m.chat.type !== 'private') {
      this.logger.log(`Mensagem fora de chat privado ignorada (${m.chat.type}).`);
      return;
    }
    const conta = {
      telegramUserId: String(m.from.id),
      chatId: String(m.chat.id),
      username: m.from.username ?? null,
      nome: [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || null,
    };
    const vinculo = await this.vinculos.autorizado(conta.telegramUserId);
    const codigo = typeof m.text === 'string' ? extrairCodigo(m.text) : null;

    if (!vinculo) {
      // Não autorizado: só aceita o código de vínculo; NENHUM conteúdo é gravado.
      if (codigo) {
        const r = await this.vinculos.vincular(codigo, conta);
        await this.responder(conta.chatId, r === 'ok' ? MSG.vinculado : r === 'ocupado' ? MSG.contaOcupada : MSG.codigoInvalido, m.message_id);
      } else {
        await this.responder(conta.chatId, MSG.privado, m.message_id);
      }
      return;
    }

    await this.vinculos.registrarComunicacao(vinculo.id);
    const c = classificar(m);
    switch (c.tipo) {
      case 'ignorado':
        return;
      case 'comando':
        await this.responder(conta.chatId, /^\/start\b/i.test(c.texto) ? MSG.jaVinculado : MSG.ajuda, m.message_id);
        return;
      case 'rejeitado':
        await this.responder(conta.chatId, c.motivo === 'tamanho' ? MSG.grandeDemais : MSG.naoSuportado, m.message_id);
        return;
      case 'texto': {
        const nova = await this.gravar(vinculo, m, { tipo: 'texto', texto: c.texto, status: 'pronta', processadaEm: new Date() });
        if (nova) await this.responder(conta.chatId, MSG.textoRecebido, m.message_id);
        return;
      }
      case 'voz':
      case 'audio': {
        const nova = await this.gravar(vinculo, m, {
          tipo: c.tipo,
          legenda: c.legenda,
          audioFileId: c.arquivo.file_id,
          audioMime: c.mime,
          audioNome: c.arquivo.file_name ?? null,
          audioTamanho: c.arquivo.file_size ?? null,
          audioDuracao: c.arquivo.duration ?? null,
          status: 'recebida',
        });
        if (nova) {
          await this.responder(conta.chatId, MSG.audioRecebido, m.message_id);
          this.processador.acordar();
        }
        return;
      }
    }
  }

  /**
   * Grava na fila. Idempotente por chatId+messageId: repetido devolve false
   * (sem nova resposta ao usuário).
   */
  private async gravar(
    vinculo: TelegramVinculo,
    m: TgMessage,
    dados: Omit<Prisma.TelegramMensagemUncheckedCreateInput, 'vinculoId' | 'chatId' | 'messageId'>,
  ): Promise<boolean> {
    try {
      await this.prisma.telegramMensagem.create({
        data: {
          ...dados,
          vinculoId: vinculo.id,
          chatId: String(m.chat.id),
          messageId: m.message_id,
          recebidaEm: new Date(m.date * 1000),
        },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
      throw e;
    }
  }

  private async responder(chatId: string, texto: string, responderA?: number): Promise<void> {
    try {
      await this.api.sendMessage(chatId, texto, responderA);
    } catch (e) {
      this.logger.warn(`Não consegui responder no Telegram: ${resumoErro(e)}`);
    }
  }

  private async lerOffset(): Promise<number> {
    const c = await this.prisma.telegramCursor.findUnique({ where: { id: CURSOR_ID } });
    return c ? Number(c.offset) : 0;
  }

  private async salvarOffset(offset: number): Promise<void> {
    await this.prisma.telegramCursor.upsert({
      where: { id: CURSOR_ID },
      create: { id: CURSOR_ID, offset: BigInt(offset) },
      update: { offset: BigInt(offset) },
    });
  }
}

function dormir(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    sinal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
