// Caixa de entrada do Telegram vista pelo navegador do dono.
//
// As Notas e o Repositório pessoal vivem no navegador (localStorage + pasta
// local). Por isso o servidor não cria a nota: ele entrega o que está `pronta`
// e o navegador cria a Nota, grava o .md/áudio no Repositório pelo pipeline
// de sempre (gravarArquivoMemoria + syncVaultBatch) e confirma aqui.
//
//   pronta ──(nota criada)──▶ nas_notas ──(.md gravado)──▶ no_repositorio
//
// Em `no_repositorio` o áudio original é apagado do servidor (ele já está na
// pasta do Repositório).
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type DestinoConfirmacao = 'notas' | 'repositorio';

const CAMPOS = {
  id: true,
  chatId: true,
  messageId: true,
  tipo: true,
  texto: true,
  legenda: true,
  transcricao: true,
  audioMime: true,
  audioNome: true,
  audioTamanho: true,
  audioDuracao: true,
  status: true,
  recebidaEm: true,
  processadaEm: true,
  entregueEm: true,
  repositorioPath: true,
} as const;

@Injectable()
export class TelegramCaixaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mensagens prontas para virar Nota (ou ainda sem o .md no Repositório) e o
   * repositório pessoal escolhido no vínculo (destino do .md).
   */
  async pendentes(usuarioId: string) {
    const vinculo = await this.prisma.telegramVinculo.findUnique({
      where: { usuarioId },
      select: { repositorioId: true },
    });
    const itens = await this.prisma.telegramMensagem.findMany({
      where: { vinculo: { usuarioId }, status: { in: ['pronta', 'nas_notas'] } },
      orderBy: { recebidaEm: 'asc' },
      take: 50,
      select: CAMPOS,
    });
    if (!itens.length) return { repositorioId: vinculo?.repositorioId ?? null, mensagens: [] };
    const comAudio = await this.prisma.telegramMensagem.findMany({
      where: { id: { in: itens.map((i) => i.id) }, audio: { not: null } },
      select: { id: true },
    });
    const ids = new Set(comAudio.map((c) => c.id));
    return {
      repositorioId: vinculo?.repositorioId ?? null,
      mensagens: itens.map((i) => ({ ...i, temAudio: ids.has(i.id) })),
    };
  }

  /** Áudio original (para gravar como anexo no Repositório). */
  async audio(usuarioId: string, id: string) {
    const m = await this.prisma.telegramMensagem.findFirst({
      where: { id, vinculo: { usuarioId } },
      select: { audio: true, audioMime: true, audioNome: true, tipo: true },
    });
    if (!m?.audio) throw new NotFoundException('Áudio indisponível.');
    return { buffer: Buffer.from(m.audio), mime: m.audioMime || 'audio/ogg' };
  }

  async confirmar(usuarioId: string, id: string, destino: DestinoConfirmacao, path?: string) {
    const agora = new Date();
    if (destino === 'notas') {
      await this.prisma.telegramMensagem.updateMany({
        where: { id, vinculo: { usuarioId }, status: 'pronta' },
        data: { status: 'nas_notas', entregueEm: agora },
      });
    } else {
      const caminho = (path ?? '').trim();
      if (!caminho || caminho.length > 500) throw new BadRequestException('Caminho do Repositório inválido.');
      const atual = await this.prisma.telegramMensagem.findFirst({
        where: { id, vinculo: { usuarioId } },
        select: { entregueEm: true },
      });
      await this.prisma.telegramMensagem.updateMany({
        where: { id, vinculo: { usuarioId }, status: { in: ['pronta', 'nas_notas'] } },
        data: {
          status: 'no_repositorio',
          repositorioPath: caminho,
          entregueEm: atual?.entregueEm ?? agora,
          audio: null,
        },
      });
    }
    const m = await this.prisma.telegramMensagem.findFirst({
      where: { id, vinculo: { usuarioId } },
      select: { id: true, status: true, repositorioPath: true },
    });
    if (!m) throw new NotFoundException('Mensagem não encontrada.');
    return m;
  }
}
