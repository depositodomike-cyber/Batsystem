import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type {
  Conversa,
  ConversaOrigem,
  Mensagem,
  MensagemRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/** Mensagem retornada ao front (espelha ChatMessage em ts/demo). */
export interface MensagemDto {
  id: string;
  role: MensagemRole;
  text: string;
  date: string;
  meta?: Prisma.JsonValue | null;
}

/** Item da lista de histórico. */
export interface ConversaListItemDto {
  id: string;
  origem: ConversaOrigem;
  squadId: string | null;
  agentId: string | null;
  modo: string | null;
  repositorioId: string | null;
  title: string;
  /** Prévia: conteúdo da última mensagem. */
  preview: string;
  date: string;
}

/** Conversa completa, com todas as mensagens em ordem. */
export interface ConversaDetailDto extends Omit<ConversaListItemDto, 'preview'> {
  messages: MensagemDto[];
}

export type PromptModo = 'vault' | 'web' | 'auto';

function toMensagemDto(m: Mensagem): MensagemDto {
  return {
    id: m.id,
    role: m.role,
    text: m.conteudo,
    date: m.criadoEm.toISOString(),
    meta: m.meta ?? null,
  };
}

function toListItem(
  c: Conversa & { mensagens: Mensagem[] },
): ConversaListItemDto {
  return {
    id: c.id,
    origem: c.origem,
    squadId: c.squadId,
    agentId: c.agentId,
    modo: c.modo,
    repositorioId: c.repositorioId,
    title: c.titulo,
    preview: c.mensagens[0]?.conteudo ?? '',
    date: c.atualizadoEm.toISOString(),
  };
}

/** Título a partir da 1ª mensagem do usuário (curto, sem quebrar palavra no fim). */
export function tituloFromText(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= 60) return clean || 'Nova pesquisa';
  return `${clean.slice(0, 57).trimEnd()}…`;
}

@Injectable()
export class ConversasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Histórico do usuário na empresa — mais recentes no topo.
   * Conversas do Prompt são isoladas por `repositorioId` (e, assim, por
   * organização). Sem o id, a lista do Prompt vem vazia — não vazamos
   * histórico de outro contexto. */
  async list(
    empresaId: string,
    usuarioId: string,
    opts: {
      origem?: ConversaOrigem;
      q?: string;
      limit?: number;
      repositorioId?: string;
    } = {},
  ): Promise<ConversaListItemDto[]> {
    const q = opts.q?.trim();
    const repositorioId = opts.repositorioId?.trim() || undefined;
    const origemPrompt = opts.origem === 'prompt';
    if (origemPrompt && !repositorioId) return [];

    const rows = await this.prisma.conversa.findMany({
      where: {
        empresaId,
        usuarioId,
        ...(opts.origem ? { origem: opts.origem } : {}),
        ...(repositorioId ? { repositorioId } : {}),
        ...(q
          ? {
              OR: [
                { titulo: { contains: q, mode: 'insensitive' } },
                {
                  mensagens: {
                    some: { conteudo: { contains: q, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { atualizadoEm: 'desc' },
      take: opts.limit && opts.limit > 0 ? opts.limit : undefined,
      include: {
        mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
      },
    });
    return rows.map(toListItem);
  }

  /** Uma conversa com todas as mensagens. 404 se não for do usuário/empresa
   * (ou do repositório, quando informado). */
  async getWithMessages(
    empresaId: string,
    usuarioId: string,
    id: string,
    repositorioId?: string,
  ): Promise<ConversaDetailDto> {
    const repo = repositorioId?.trim() || undefined;
    const c = await this.prisma.conversa.findFirst({
      where: {
        id,
        empresaId,
        usuarioId,
        ...(repo ? { repositorioId: repo } : {}),
      },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
    });
    if (!c) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    return {
      id: c.id,
      origem: c.origem,
      squadId: c.squadId,
      agentId: c.agentId,
      modo: c.modo,
      repositorioId: c.repositorioId,
      title: c.titulo,
      date: c.atualizadoEm.toISOString(),
      messages: c.mensagens.map(toMensagemDto),
    };
  }

  async rename(
    empresaId: string,
    usuarioId: string,
    id: string,
    titulo: string,
  ): Promise<ConversaListItemDto> {
    const clean = titulo.trim().replace(/\s+/g, ' ');
    if (!clean) throw new BadRequestException('Título vazio.');
    const c = await this.prisma.conversa.findFirst({
      where: { id, empresaId, usuarioId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Conversa não encontrada.');
    const updated = await this.prisma.conversa.update({
      where: { id },
      data: { titulo: clean.slice(0, 80) },
      include: { mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 } },
    });
    return toListItem(updated);
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
   * usuário/empresa (e ao mesmo repositório, quando informado), usa-a; senão
   * cria uma nova com título derivado do texto.
   */
  async ensureConversa(params: {
    empresaId: string;
    usuarioId: string;
    origem?: ConversaOrigem;
    squadId?: string;
    agentId?: string;
    modo?: string | null;
    repositorioId?: string | null;
    conversaId?: string;
    tituloSeed: string;
  }): Promise<Conversa> {
    if (params.conversaId) {
      const existing = await this.prisma.conversa.findFirst({
        where: {
          id: params.conversaId,
          empresaId: params.empresaId,
          usuarioId: params.usuarioId,
          ...(params.repositorioId
            ? { repositorioId: params.repositorioId }
            : {}),
        },
      });
      if (existing) return existing;
    }
    return this.prisma.conversa.create({
      data: {
        empresaId: params.empresaId,
        usuarioId: params.usuarioId,
        origem: params.origem ?? 'squad',
        squadId: params.squadId ?? null,
        agentId: params.agentId ?? null,
        modo: params.modo ?? null,
        repositorioId: params.repositorioId ?? null,
        titulo: tituloFromText(params.tituloSeed),
      },
    });
  }

  /** Acrescenta um turno e atualiza o `atualizadoEm` da conversa. */
  async appendMessage(
    conversaId: string,
    role: MensagemRole,
    conteudo: string,
    meta?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.mensagem.create({
      data: { conversaId, role, conteudo, meta: meta ?? undefined },
    });
    await this.prisma.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    });
  }

  /** Grava um turno do Prompt no repositório ativo (cria a conversa se preciso). */
  async persistPromptTurn(params: {
    empresaId: string;
    usuarioId: string;
    conversaId?: string;
    modo: PromptModo;
    repositorioId?: string | null;
    pergunta: string;
    resposta: string;
    fontes: unknown;
    origemResposta: 'vault' | 'web';
  }): Promise<{ conversaId: string; nova: boolean }> {
    const repositorioId = params.repositorioId?.trim() || null;
    const existing = params.conversaId
      ? await this.prisma.conversa.findFirst({
          where: {
            id: params.conversaId,
            empresaId: params.empresaId,
            usuarioId: params.usuarioId,
            origem: 'prompt',
            ...(repositorioId ? { repositorioId } : {}),
          },
        })
      : null;
    const conversa = existing
      ? existing
      : await this.ensureConversa({
          empresaId: params.empresaId,
          usuarioId: params.usuarioId,
          origem: 'prompt',
          modo: params.modo,
          repositorioId,
          tituloSeed: params.pergunta,
        });
    await this.appendMessage(conversa.id, 'user', params.pergunta);
    await this.appendMessage(conversa.id, 'assistant', params.resposta, {
      fontes: params.fontes as Prisma.InputJsonValue,
      origem: params.origemResposta,
    });
    return { conversaId: conversa.id, nova: !existing };
  }
}

