import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  type Conversa,
  type ConversaOrigem,
  type Mensagem,
  type MensagemRole,
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
  /**
   * Agentes que já participaram da conversa (distintos, de `meta.agente` das
   * respostas) — alimenta a identificação e o filtro do Histórico. Não é o
   * agente ATIVO: esse é `squadId`. Remover o agente não apaga esta lista.
   */
  agenteIds: string[];
  /**
   * Os mesmos agentes com o nome gravado na mensagem, na ordem em que
   * participaram. O nome vem do `meta` — serve também para agentes
   * personalizados, inclusive os já excluídos.
   */
  agentes: { id: string; titulo: string }[];
}

/** Conversa completa, com todas as mensagens em ordem. */
export interface ConversaDetailDto
  extends Omit<ConversaListItemDto, 'preview' | 'agenteIds' | 'agentes'> {
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
  agentes: { id: string; titulo: string }[] = [],
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
    agenteIds: agentes.map((a) => a.id),
    agentes,
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
    const agentes = await this.agentesUsados(rows.map((r) => r.id));
    return rows.map((r) => toListItem(r, agentes.get(r.id) ?? []));
  }

  /**
   * Agentes distintos que responderam em cada conversa, lidos de
   * `meta.agente.id` das mensagens. Uma consulta só para a página inteira do
   * Histórico, em vez de uma por conversa.
   */
  private async agentesUsados(
    ids: string[],
  ): Promise<Map<string, { id: string; titulo: string }[]>> {
    const porConversa = new Map<string, { id: string; titulo: string }[]>();
    if (ids.length === 0) return porConversa;
    const linhas = await this.prisma.$queryRaw<
      { conversaId: string; agenteId: string; titulo: string | null }[]
    >`
      SELECT "conversaId",
             ("meta"->'agente'->>'id') AS "agenteId",
             MAX("meta"->'agente'->>'titulo') AS "titulo",
             MIN("criadoEm") AS "primeira"
      FROM "mensagens"
      WHERE "conversaId" IN (${Prisma.join(ids)})
        AND ("meta"->'agente'->>'id') IS NOT NULL
      GROUP BY "conversaId", ("meta"->'agente'->>'id')
      ORDER BY "primeira" ASC
    `;
    for (const l of linhas) {
      const lista = porConversa.get(l.conversaId) ?? [];
      lista.push({ id: l.agenteId, titulo: l.titulo ?? '' });
      porConversa.set(l.conversaId, lista);
    }
    return porConversa;
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
    // Com os agentes: o cliente mescla este item na lista, e sem eles a linha
    // do Histórico perderia a identificação do agente ao renomear.
    const agentes = await this.agentesUsados([id]);
    return toListItem(updated, agentes.get(id) ?? []);
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

  /**
   * Acrescenta um turno e atualiza o `atualizadoEm` da conversa. Devolve o id
   * da mensagem criada (quem não precisa, ignora).
   */
  async appendMessage(
    conversaId: string,
    role: MensagemRole,
    conteudo: string,
    meta?: Prisma.InputJsonValue,
  ): Promise<string> {
    const criada = await this.prisma.mensagem.create({
      data: { conversaId, role, conteudo, meta: meta ?? undefined },
      select: { id: true },
    });
    await this.prisma.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    });
    return criada.id;
  }

  /**
   * Grava um turno do Prompt no repositório ativo (cria a conversa se preciso).
   *
   * Agente: a resposta guarda QUEM a produziu (`meta.agente`), e a conversa
   * guarda o agente ATIVO em `squadId` — a coluna já existia (nula no Prompt)
   * e passa a significar isso para `origem: prompt`. São coisas diferentes de
   * propósito: trocar ou remover o agente muda só o ativo; o histórico de
   * cada mensagem fica como foi.
   */
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
    agente?: { id: string; titulo: string } | null;
    /** Arquivos gerados na resposta — pertencem à conversa. */
    arquivos?: unknown[];
    /** Agentes @mencionados na pergunta (vão para o meta da mensagem do usuário). */
    mencoes?: { id: string; titulo: string; mencao: string }[];
    /**
     * Resposta de MAIS UM agente à mesma pergunta: grava só a resposta, sem
     * repetir a mensagem do usuário. Exige conversa existente.
     */
    respostaAdicional?: boolean;
  }): Promise<{ conversaId: string; nova: boolean; mensagemId: string }> {
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
    // Com vários agentes mencionados, só o 1º turno grava a pergunta; os
    // demais anexam a própria resposta logo depois.
    if (!(existing && params.respostaAdicional)) {
      await this.appendMessage(
        conversa.id,
        'user',
        params.pergunta,
        params.mencoes?.length
          ? ({ mencoes: params.mencoes } as Prisma.InputJsonValue)
          : undefined,
      );
    }
    const mensagemId = await this.appendMessage(
      conversa.id,
      'assistant',
      params.resposta,
      {
        fontes: params.fontes as Prisma.InputJsonValue,
        origem: params.origemResposta,
        agente: params.agente ?? null,
        ...(params.arquivos?.length
          ? { arquivos: params.arquivos as Prisma.InputJsonValue }
          : {}),
      },
    );
    // O agente não é mais um estado da conversa (é chamado por @menção, por
    // mensagem): `Conversa.squadId` deixa de ser gravado aqui e fica como está
    // nas conversas antigas.
    return { conversaId: conversa.id, nova: !existing, mensagemId };
  }

  /**
   * Troca (ou remove, com `null`) o agente ATIVO de uma conversa do Prompt,
   * sem mandar mensagem. As mensagens anteriores não mudam — continuam
   * identificadas com o agente que as produziu.
   */
  async definirAgente(
    empresaId: string,
    usuarioId: string,
    id: string,
    agenteId: string | null,
  ): Promise<{ squadId: string | null }> {
    const c = await this.prisma.conversa.findFirst({
      where: { id, empresaId, usuarioId, origem: 'prompt' },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Conversa não encontrada.');
    if (agenteId) {
      const squad = await this.prisma.squad.findFirst({
        where: { id: agenteId, active: true },
        select: { id: true },
      });
      if (!squad) throw new NotFoundException('Agente não encontrado.');
    }
    // `update` direto (sem `atualizadoEm` manual): trocar o agente não é
    // atividade da conversa e não deve reordenar o Histórico.
    const atualizada = await this.prisma.conversa.update({
      where: { id },
      data: { squadId: agenteId },
      select: { squadId: true },
    });
    return atualizada;
  }

  /**
   * Marca um arquivo da conversa como salvo no Repositório (guarda o id do
   * documento criado lá). Só grava o vínculo — o envio é do cliente, pelo
   * fluxo de upload do Repositório, que já aplica as regras dele.
   */
  async marcarArquivoSalvo(
    empresaId: string,
    usuarioId: string,
    conversaId: string,
    mensagemId: string,
    arquivoId: string,
    repositorioDocumentoId: string,
  ): Promise<{ success: true }> {
    const m = await this.prisma.mensagem.findFirst({
      where: {
        id: mensagemId,
        conversaId,
        conversa: { empresaId, usuarioId },
      },
      select: { id: true, meta: true },
    });
    if (!m) throw new NotFoundException('Mensagem não encontrada.');
    const meta = (m.meta ?? {}) as Record<string, unknown>;
    const arquivos = Array.isArray(meta.arquivos)
      ? (meta.arquivos as Record<string, unknown>[])
      : [];
    if (!arquivos.some((a) => a.id === arquivoId)) {
      throw new NotFoundException('Arquivo não encontrado.');
    }
    await this.prisma.mensagem.update({
      where: { id: m.id },
      data: {
        meta: {
          ...meta,
          arquivos: arquivos.map((a) =>
            a.id === arquivoId ? { ...a, repositorioDocumentoId } : a,
          ),
        } as Prisma.InputJsonValue,
      },
    });
    return { success: true };
  }
}
