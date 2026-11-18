// Processamento assíncrono da fila de entrada do Telegram.
//
// - Texto: fica `pronta` na hora (o texto original não é tocado).
// - Áudio: baixa (guarda os bytes primeiro), transcreve (Whisper) e fica
//   `pronta`. Se falhar, vai a `falha` com retentativas em backoff e o áudio
//   continua guardado — nunca é descartado.
// - Recuperação: na partida, o que ficou em `transcrevendo` volta à fila.
import { Injectable, Logger } from '@nestjs/common';
import type { TelegramMensagem } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ChaveOpenAiService } from '@/ai/audio/chave-openai';
import { transcreverAudioOpenAI } from '@/ai/audio/transcrever';
import { ErroTelegram, redigirToken, TelegramApiService } from './telegram-api.service';
import {
  LIMITE_AUDIO_BYTES,
  MSG,
  nomeParaTranscricao,
  proximaTentativa,
} from './telegram-regras';

/** Transcritor injetável (testes trocam pelo fake). */
export type Transcritor = (apiKey: string, buffer: Buffer, nome: string) => Promise<string>;

const INTERVALO_MS = 5_000;

@Injectable()
export class TelegramProcessadorService {
  private readonly logger = new Logger(TelegramProcessadorService.name);
  private timer: NodeJS.Timeout | null = null;
  private ocupado = false;
  private pedidoExtra = false;
  transcrever: Transcritor = transcreverAudioOpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TelegramApiService,
    private readonly chaveOpenAi: ChaveOpenAiService,
  ) {}

  /** Volta à fila o que a queda do processo deixou no meio. */
  async recuperar(): Promise<number> {
    const { count } = await this.prisma.telegramMensagem.updateMany({
      where: { status: 'transcrevendo' },
      data: { status: 'recebida' },
    });
    if (count) this.logger.warn(`${count} áudio(s) do Telegram voltaram à fila após reinício.`);
    return count;
  }

  iniciar(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), INTERVALO_MS);
    this.timer.unref?.();
    void this.tick();
  }

  parar(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Processa já (chamado quando chega mensagem nova). */
  acordar(): void {
    void this.tick();
  }

  async tick(): Promise<void> {
    if (this.ocupado) {
      this.pedidoExtra = true;
      return;
    }
    this.ocupado = true;
    try {
      do {
        this.pedidoExtra = false;
        for (let i = 0; i < 10; i++) {
          const m = await this.proxima();
          if (!m) break;
          await this.processar(m);
        }
      } while (this.pedidoExtra);
    } catch (e) {
      this.logger.error(`Falha no processamento da fila do Telegram: ${resumoErro(e)}`);
    } finally {
      this.ocupado = false;
    }
  }

  private proxima() {
    return this.prisma.telegramMensagem.findFirst({
      where: {
        OR: [
          { status: 'recebida' },
          { status: 'falha', proximaTentativaEm: { lte: new Date() } },
        ],
      },
      orderBy: { recebidaEm: 'asc' },
      include: { vinculo: { select: { empresaId: true } } },
    });
  }

  async processar(m: TelegramMensagem & { vinculo: { empresaId: string } }): Promise<void> {
    if (m.tipo === 'texto') {
      await this.prisma.telegramMensagem.updateMany({
        where: { id: m.id, status: 'recebida' },
        data: { status: 'pronta', processadaEm: new Date() },
      });
      return;
    }

    // Reivindica o item (evita processar duas vezes).
    const { count } = await this.prisma.telegramMensagem.updateMany({
      where: { id: m.id, status: { in: ['recebida', 'falha'] } },
      data: { status: 'transcrevendo' },
    });
    if (count !== 1) return;

    try {
      let audio: Buffer | null = m.audio ? Buffer.from(m.audio) : null;
      if (!audio) {
        if (!m.audioFileId) throw new Error('Mensagem de áudio sem arquivo.');
        const f = await this.api.getFile(m.audioFileId);
        if (!f.file_path) throw new Error('O Telegram não devolveu o arquivo.');
        if ((f.file_size ?? 0) > LIMITE_AUDIO_BYTES) throw new Error('Arquivo acima de 20 MB.');
        audio = await this.api.baixar(f.file_path, LIMITE_AUDIO_BYTES);
        // Guarda o original ANTES de transcrever: se a transcrição falhar, o áudio fica.
        await this.prisma.telegramMensagem.update({
          where: { id: m.id },
          data: { audio: new Uint8Array(audio), audioTamanho: audio.length },
        });
      }
      const chave = await this.chaveOpenAi.resolver(m.vinculo.empresaId);
      if (!chave) {
        throw new Error('Sem chave da OpenAI para transcrever (conecte a OpenAI ou defina OPENAI_API_KEY).');
      }
      const texto = await this.transcrever(chave, audio, nomeParaTranscricao(m.tipo, m.audioMime, m.audioNome));
      await this.prisma.telegramMensagem.update({
        where: { id: m.id },
        data: {
          status: 'pronta',
          transcricao: texto,
          processadaEm: new Date(),
          erro: null,
          proximaTentativaEm: null,
        },
      });
      await this.responder(m, texto ? MSG.transcrito : MSG.semFala);
    } catch (e) {
      const tentativas = m.tentativas + 1;
      const erro = resumoErro(e);
      await this.prisma.telegramMensagem.update({
        where: { id: m.id },
        data: {
          status: 'falha',
          tentativas,
          erro,
          proximaTentativaEm: proximaTentativa(tentativas),
        },
      });
      this.logger.warn(`Transcrição do Telegram falhou (mensagem ${m.id}, tentativa ${tentativas}): ${erro}`);
      // Só avisa na primeira falha, para não encher o chat.
      if (tentativas === 1) await this.responder(m, MSG.falhaTranscricao);
    }
  }

  /** "Tentar novamente" manual (Configurações), só para o dono. */
  async tentarNovamente(usuarioId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.telegramMensagem.updateMany({
      where: { id, status: 'falha', vinculo: { usuarioId } },
      data: { status: 'recebida', tentativas: 0, proximaTentativaEm: null, erro: null },
    });
    if (count) this.acordar();
    return count === 1;
  }

  private async responder(m: TelegramMensagem, texto: string): Promise<void> {
    try {
      await this.api.sendMessage(m.chatId, texto, m.messageId);
    } catch (e) {
      this.logger.warn(`Não consegui responder no Telegram: ${resumoErro(e)}`);
    }
  }
}

/** Mensagem curta de erro, sem segredo. */
export function resumoErro(e: unknown): string {
  if (e instanceof ErroTelegram) return e.message;
  const msg = e instanceof Error ? e.message : String(e);
  return redigirToken(msg).replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***').slice(0, 300);
}
