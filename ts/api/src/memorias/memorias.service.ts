import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Memoria } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMemoriaDto } from './dto/create-memoria.dto';
import { UpdateMemoriaDto } from './dto/update-memoria.dto';
import {
  blocoDiretrizes,
  CATEGORIA_PADRAO,
  diretrizesCompactas,
  ORIGEM_PROMPT_BASE,
  type DiretrizFonte,
} from './diretrizes';

/** Forma retornada ao front (espelha MemoryItem em ts/demo). */
export interface MemoryItemDto {
  id: string;
  category: string;
  title: string;
  content: string;
  source: string;
  confidence: Memoria['confianca'];
  active: boolean;
  /** Definição corporativa (read-only): não pode ser alterada/desativada/removida. */
  corporate: boolean;
  /** ISO 8601; o front formata para exibição. */
  date: string;
}

function toMemoryItem(m: Memoria): MemoryItemDto {
  return {
    id: m.id,
    category: m.categoria,
    title: m.titulo,
    content: m.conteudo,
    source: m.origem,
    confidence: m.confianca,
    active: m.ativa,
    corporate: m.corporativa,
    date: m.aprendidaEm.toISOString(),
  };
}

@Injectable()
export class MemoriasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas as memórias da empresa — mais recentes no topo. */
  async list(empresaId: string): Promise<MemoryItemDto[]> {
    const rows = await this.prisma.memoria.findMany({
      where: { empresaId },
      orderBy: [{ aprendidaEm: 'desc' }, { criadoEm: 'desc' }],
    });
    return rows.map(toMemoryItem);
  }

  /**
   * Diretrizes ativas da empresa, na ordem de precedência: corporativas
   * primeiro e, dentro de cada grupo, a mais recente antes. Não filtra por
   * tema/categoria de propósito — diretriz vale para toda interação com a IA,
   * não só para o squad da vez.
   */
  async ativas(empresaId: string): Promise<DiretrizFonte[]> {
    const rows = await this.prisma.memoria.findMany({
      where: {
        empresaId,
        ativa: true,
        // Prompts-base de squad não são regra de conduta — ver ORIGEM_PROMPT_BASE.
        origem: { not: ORIGEM_PROMPT_BASE },
      },
      orderBy: [{ corporativa: 'desc' }, { aprendidaEm: 'desc' }],
      select: { titulo: true, conteudo: true, corporativa: true },
      take: 300,
    });
    return rows;
  }

  /**
   * Bloco de regras pronto para o fim do system prompt de qualquer chamada de
   * IA. String vazia quando a empresa não tem nenhuma diretriz ativa.
   */
  async blocoSystem(empresaId: string): Promise<string> {
    return blocoDiretrizes(await this.ativas(empresaId));
  }

  /** Versão de uma linha, para o prompt de geração de imagem. */
  async blocoCompacto(empresaId: string): Promise<string> {
    return diretrizesCompactas(await this.ativas(empresaId));
  }

  async create(
    empresaId: string,
    dto: CreateMemoriaDto,
    isAdmin: boolean,
  ): Promise<MemoryItemDto> {
    // "Fixar" (corporativa) só vale se solicitado E o usuário for admin/owner.
    const corporativa = isAdmin && dto.corporate === true;
    const row = await this.prisma.memoria.create({
      data: {
        empresaId,
        categoria: dto.category?.trim() || CATEGORIA_PADRAO,
        titulo: dto.title.trim(),
        conteudo: dto.content.trim(),
        origem: dto.source?.trim() || 'Manual',
        corporativa,
        ...(dto.confidence ? { confianca: dto.confidence } : {}),
      },
    });
    return toMemoryItem(row);
  }

  async update(
    empresaId: string,
    id: string,
    dto: UpdateMemoriaDto,
    isAdmin: boolean,
  ): Promise<MemoryItemDto> {
    await this.ensureEditable(empresaId, id, isAdmin);
    const row = await this.prisma.memoria.update({
      where: { id },
      data: {
        ...(dto.category !== undefined ? { categoria: dto.category } : {}),
        ...(dto.title !== undefined ? { titulo: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { conteudo: dto.content.trim() } : {}),
        ...(dto.source !== undefined
          ? { origem: dto.source.trim() || 'Manual' }
          : {}),
        ...(dto.confidence !== undefined ? { confianca: dto.confidence } : {}),
        ...(dto.active !== undefined ? { ativa: dto.active } : {}),
      },
    });
    // Confirma que a linha ainda é da empresa (defesa em profundidade).
    if (row.empresaId !== empresaId) {
      throw new NotFoundException('Memória não encontrada.');
    }
    return toMemoryItem(row);
  }

  async remove(
    empresaId: string,
    id: string,
    isAdmin: boolean,
  ): Promise<{ success: true }> {
    await this.ensureEditable(empresaId, id, isAdmin);
    const deleted = await this.prisma.memoria.deleteMany({
      where: { id, empresaId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Memória não encontrada.');
    }
    return { success: true };
  }

  /**
   * Garante que a memória existe, pertence à empresa e que o usuário pode
   * alterá-la. Definições corporativas são read-only para membros comuns, mas
   * admin/owner podem alterá-las e removê-las. Usado em update/remove.
   */
  private async ensureEditable(
    empresaId: string,
    id: string,
    isAdmin: boolean,
  ): Promise<void> {
    const found = await this.prisma.memoria.findFirst({
      where: { id, empresaId },
      select: { id: true, corporativa: true },
    });
    if (!found) {
      throw new NotFoundException('Memória não encontrada.');
    }
    if (found.corporativa && !isAdmin) {
      throw new ForbiddenException(
        'Memória corporativa só pode ser alterada ou removida por um administrador.',
      );
    }
  }
}
