import { Injectable, NotFoundException } from '@nestjs/common';
import type { Conversa, Mensagem, MensagemRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/** Mensagem retornada ao front (espelha ChatMessage em ts/demo). */
export interface MensagemDto {
  id: string;
  role: MensagemRole;
  text: string;
  date: string;
}

/** Item da lista de histórico. */
export interface ConversaListItemDto {
  id: string;
  squadId: string;
  agentId: string | null;
  title: string;
  /** Prévia: conteúdo da última mensagem. */
  preview: string;
  date: string;
}

/** Conversa completa, com todas as mensagens em ordem. */
export interface ConversaDetailDto extends Omit<ConversaListItemDto, 'preview'> {
  messages: MensagemDto[];
}

function toMensagemDto(m: Mensagem): MensagemDto {
  return {
    id: m.id,
    role: m.role,
    text: m.conteudo,
    date: m.criadoEm.toISOString(),
  };
}

/** Título a partir da 1ª mensagem do usuário (curto, sem quebrar palavra no fim). */
function tituloFromText(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= 60) return clean || 'Nova conversa';
  return `${clean.slice(0, 57).trimEnd()}…`;
}

@Injectable()
export class ConversasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Histórico do usuário na empresa — mais recentes no topo. */
  async list(
    empresaId: string,
    usuarioId: string,
  ): Promise<ConversaListItemDto[]> {
    const rows = await this.prisma.conversa.findMany({
      where: { empresaId, usuarioId },
      orderBy: { atualizadoEm: 'desc' },
      include: {
        mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      squadId: c.squadId,
      agentId: c.agentId,
      title: c.titulo,
      preview: c.mensagens[0]?.conteudo ?? '',
      date: c.atualizadoEm.toISOString(),
    }));
  }

  /** Uma conversa com todas as mensagens. 404 se não for do usuário/empresa. */
  async getWithMessages(
    empresaId: string,
    usuarioId: string,
    id: string,
  ): Promise<ConversaDetailDto> {
    const c = await this.prisma.conversa.findFirst({
      where: { id, empresaId, usuarioId },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
    });
    if (!c) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    return {
      id: c.id,
      squadId: c.squadId,
      agentId: c.agentId,
      title: c.titulo,
      date: c.atualizadoEm.toISOString(),
      messages: c.mensagens.map(toMensagemDto),
    };
  }

  /** Exclui uma conversa (e suas mensagens, por cascade). */
  async remove(
    empresaId: string,
    usuarioId: string,
    id: string,
  ): Promise<{ success: true }> {
    const c = await this.prisma.conversa.findFirst({
      where: { id, empresaId, usuarioId },
      select: { id: true },
    });
    if (!c) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    const deleted = await this.prisma.conversa.deleteMany({
      where: { id, empresaId, usuarioId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    return { success: true };
  }

  /**
   * Retorna a conversa a continuar: se `conversaId` for válido e pertencer ao
   * usuário/empresa, usa-a; senão cria uma nova com título derivado do texto.
   * Usado pelo fluxo de chat para garantir persistência.
   */
  async ensureConversa(params: {
    empresaId: string;
    usuarioId: string;
    squadId: string;
    agentId?: string;
    conversaId?: string;
    tituloSeed: string;
  }): Promise<Conversa> {
    if (params.conversaId) {
      const existing = await this.prisma.conversa.findFirst({
        where: {
          id: params.conversaId,
          empresaId: params.empresaId,
          usuarioId: params.usuarioId,
        },
      });
      if (existing) return existing;
    }
    return this.prisma.conversa.create({
      data: {
        empresaId: params.empresaId,
        usuarioId: params.usuarioId,
        squadId: params.squadId,
        agentId: params.agentId ?? null,
        titulo: tituloFromText(params.tituloSeed),
      },
    });
  }

  /** Acrescenta um turno e atualiza o `atualizadoEm` da conversa. */
  async appendMessage(
    conversaId: string,
    role: MensagemRole,
    conteudo: string,
  ): Promise<void> {
    await this.prisma.mensagem.create({
      data: { conversaId, role, conteudo },
    });
    await this.prisma.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    });
  }
}
