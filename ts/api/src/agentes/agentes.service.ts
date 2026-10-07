import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { chaveMencao, mencaoDe, mencaoValida } from './mencao';

/** Agente do sistema (o catálogo de squads), pronto para @menção. */
export interface AgenteSistemaDto {
  id: string;
  titulo: string;
  mencao: string;
  icone: string | null;
  descricao: string;
}

/** Agente personalizado do usuário. */
export interface AgenteUsuarioDto {
  id: string;
  titulo: string;
  mencao: string;
  descricao: string;
  instrucoes: string;
  /** Ícone do avatar (chave do catálogo do cliente); null = iniciais. */
  icone: string | null;
  atualizadoEm: Date;
}

export interface SalvarAgenteInput {
  nome: string;
  mencao?: string;
  descricao?: string;
  instrucoes?: string;
  icone?: string | null;
}

/**
 * Agentes mencionáveis no Assistente: os do SISTEMA (catálogo de squads, só
 * leitura) e os PESSOAIS do usuário (CRUD). Agente pessoal pertence a quem o
 * criou — toda query filtra por empresa + usuário; não há compartilhamento.
 */
@Injectable()
export class AgentesService {
  constructor(private readonly prisma: PrismaService) {}

  async sistema(): Promise<AgenteSistemaDto[]> {
    const squads = await this.prisma.squad.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, icon: true, description: true },
    });
    return squads.map((s) => ({
      id: s.id,
      titulo: s.title,
      mencao: mencaoDe(s.title),
      icone: s.icon,
      descricao: s.description,
    }));
  }

  async meus(empresaId: string, usuarioId: string): Promise<AgenteUsuarioDto[]> {
    const linhas = await this.prisma.agenteUsuario.findMany({
      where: { empresaId, usuarioId, excluidoEm: null },
      orderBy: { nome: 'asc' },
    });
    return linhas.map(toDto);
  }

  async criar(
    empresaId: string,
    usuarioId: string,
    input: SalvarAgenteInput,
  ): Promise<AgenteUsuarioDto> {
    const dados = await this.validar(empresaId, usuarioId, input);
    const criado = await this.prisma.agenteUsuario.create({
      data: { empresaId, usuarioId, ...dados },
    });
    return toDto(criado);
  }

  async atualizar(
    empresaId: string,
    usuarioId: string,
    id: string,
    input: SalvarAgenteInput,
  ): Promise<AgenteUsuarioDto> {
    await this.doUsuario(empresaId, usuarioId, id);
    const dados = await this.validar(empresaId, usuarioId, input, id);
    const atualizado = await this.prisma.agenteUsuario.update({
      where: { id },
      data: dados,
    });
    return toDto(atualizado);
  }

  /**
   * Exclusão lógica: o agente deixa de ser mencionável, mas nada das conversas
   * é tocado — as respostas antigas guardam o nome no próprio `meta`.
   */
  async excluir(
    empresaId: string,
    usuarioId: string,
    id: string,
  ): Promise<{ success: true }> {
    await this.doUsuario(empresaId, usuarioId, id);
    await this.prisma.agenteUsuario.update({
      where: { id },
      data: { excluidoEm: new Date() },
    });
    return { success: true };
  }

  private async doUsuario(empresaId: string, usuarioId: string, id: string) {
    const a = await this.prisma.agenteUsuario.findFirst({
      where: { id, empresaId, usuarioId, excluidoEm: null },
      select: { id: true },
    });
    if (!a) throw new NotFoundException('Agente não encontrado.');
  }

  /**
   * Normaliza os campos e garante menção única: não pode repetir a de um
   * agente do sistema nem a de outro agente vivo do mesmo usuário (comparação
   * sem acento e sem caixa — "@Cultura" e "@cultura" seriam ambíguos).
   */
  private async validar(
    empresaId: string,
    usuarioId: string,
    input: SalvarAgenteInput,
    ignorarId?: string,
  ) {
    const nome = input.nome.trim().replace(/\s+/g, ' ');
    if (!nome) throw new BadRequestException('Informe o nome do agente.');
    const mencao = (input.mencao?.trim().replace(/^@/, '') || mencaoDe(nome))
      .normalize('NFC');
    if (!mencaoValida(mencao)) {
      throw new BadRequestException(
        'A menção deve ter de 2 a 40 letras ou números, sem espaços.',
      );
    }

    const chave = chaveMencao(mencao);
    const [sistema, meus] = await Promise.all([
      this.sistema(),
      this.prisma.agenteUsuario.findMany({
        where: {
          empresaId,
          usuarioId,
          excluidoEm: null,
          ...(ignorarId ? { id: { not: ignorarId } } : {}),
        },
        select: { mencao: true },
      }),
    ]);
    const emUso = [...sistema.map((s) => s.mencao), ...meus.map((m) => m.mencao)];
    if (emUso.some((m) => chaveMencao(m) === chave)) {
      throw new ConflictException(
        `Já existe um agente com a menção @${mencao}. Escolha outra.`,
      );
    }

    return {
      nome: nome.slice(0, 80),
      mencao,
      descricao: (input.descricao ?? '').trim().slice(0, 500),
      instrucoes: (input.instrucoes ?? '').trim().slice(0, 8000),
      // Só chaves do catálogo de ícones ("agente:nome"); vazio = iniciais.
      icone: /^agente:[a-z0-9-]{1,30}$/.test(input.icone ?? '')
        ? (input.icone as string)
        : null,
    };
  }
}

function toDto(a: {
  id: string;
  nome: string;
  mencao: string;
  descricao: string;
  instrucoes: string;
  icone: string | null;
  atualizadoEm: Date;
}): AgenteUsuarioDto {
  return {
    id: a.id,
    titulo: a.nome,
    mencao: a.mencao,
    descricao: a.descricao,
    instrucoes: a.instrucoes,
    icone: a.icone,
    atualizadoEm: a.atualizadoEm,
  };
}
