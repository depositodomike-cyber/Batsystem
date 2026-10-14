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

/** Agente personalizado — do usuário ou da organização. */
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
 * Escopo de um agente personalizado: PESSOAL (do usuário, só ele vê) ou da
 * ORGANIZAÇÃO ativa (header X-Organizacao-Id, todos dela veem). Os dois vivem
 * na mesma tabela; `organizacaoId` nulo é pessoal. No escopo da organização,
 * `usuarioId` é só quem criou — não restringe quem edita.
 */
export type EscopoAgente =
  | { tipo: 'pessoal'; usuarioId: string }
  | { tipo: 'organizacao'; organizacaoId: string; usuarioId: string };

/**
 * Agentes mencionáveis no Assistente: os do SISTEMA (catálogo de squads, só
 * leitura), os PESSOAIS do usuário e os da ORGANIZAÇÃO ativa (CRUD). Agente
 * pessoal pertence a quem o criou; agente da organização, à organização —
 * toda query filtra por empresa + dono do escopo.
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

  /**
   * Agentes do sistema como a organização os vê: sem os que ela substituiu
   * por uma versão própria (editada) nem os que ela excluiu — os dois casos
   * têm uma linha da organização com `sistemaId`. Sem organização, o catálogo.
   */
  async sistemaDaOrganizacao(
    empresaId: string,
    organizacaoId: string | null,
  ): Promise<AgenteSistemaDto[]> {
    const [catalogo, substituidos] = await Promise.all([
      this.sistema(),
      organizacaoId
        ? this.prisma.agenteUsuario.findMany({
            where: { empresaId, organizacaoId, sistemaId: { not: null } },
            select: { sistemaId: true },
          })
        : Promise.resolve([] as { sistemaId: string | null }[]),
    ]);
    const fora = new Set(substituidos.map((s) => s.sistemaId));
    return catalogo.filter((a) => !fora.has(a.id));
  }

  /**
   * Edita um agente do sistema NA organização: cria a versão própria dela
   * (linha com `sistemaId`), que passa a aparecer no lugar do original. O
   * catálogo não muda — as outras organizações seguem com o original.
   */
  async editarSistemaNaOrganizacao(
    empresaId: string,
    escopo: Extract<EscopoAgente, { tipo: 'organizacao' }>,
    sistemaId: string,
    input: SalvarAgenteInput,
  ): Promise<AgenteUsuarioDto> {
    await this.sistemaVisivel(empresaId, escopo.organizacaoId, sistemaId);
    const dados = await this.validar(
      empresaId,
      escopo,
      input,
      undefined,
      undefined,
      sistemaId,
    );
    const criado = await this.prisma.agenteUsuario.create({
      data: {
        empresaId,
        usuarioId: escopo.usuarioId,
        organizacaoId: escopo.organizacaoId,
        sistemaId,
        ...dados,
      },
    });
    return toDto(criado);
  }

  /**
   * Exclui um agente do sistema DA organização: grava a marca (linha já
   * excluída, com `sistemaId`) que o tira da lista dela. Nada é apagado.
   */
  async excluirSistemaNaOrganizacao(
    empresaId: string,
    escopo: Extract<EscopoAgente, { tipo: 'organizacao' }>,
    sistemaId: string,
  ): Promise<{ success: true }> {
    const original = await this.sistemaVisivel(
      empresaId,
      escopo.organizacaoId,
      sistemaId,
    );
    await this.prisma.agenteUsuario.create({
      data: {
        empresaId,
        usuarioId: escopo.usuarioId,
        organizacaoId: escopo.organizacaoId,
        sistemaId,
        nome: original.titulo,
        mencao: original.mencao,
        descricao: original.descricao,
        excluidoEm: new Date(),
      },
    });
    return { success: true };
  }

  /** O agente do sistema existe e ainda não foi substituído na organização. */
  private async sistemaVisivel(
    empresaId: string,
    organizacaoId: string,
    sistemaId: string,
  ): Promise<AgenteSistemaDto> {
    const lista = await this.sistemaDaOrganizacao(empresaId, organizacaoId);
    const achado = lista.find((a) => a.id === sistemaId);
    if (!achado) throw new NotFoundException('Agente não encontrado.');
    return achado;
  }

  async meus(empresaId: string, usuarioId: string): Promise<AgenteUsuarioDto[]> {
    const linhas = await this.prisma.agenteUsuario.findMany({
      where: { empresaId, usuarioId, organizacaoId: null, excluidoEm: null },
      orderBy: { nome: 'asc' },
    });
    return linhas.map(toDto);
  }

  /** Agentes da organização ativa; sem organização, nenhum. */
  async daOrganizacao(
    empresaId: string,
    organizacaoId: string | null,
  ): Promise<AgenteUsuarioDto[]> {
    if (!organizacaoId) return [];
    const linhas = await this.prisma.agenteUsuario.findMany({
      where: { empresaId, organizacaoId, excluidoEm: null },
      orderBy: { nome: 'asc' },
    });
    return linhas.map(toDto);
  }

  /**
   * `organizacaoAtiva` só pesa no escopo pessoal: a menção nova não pode
   * repetir a de um agente da organização em que o usuário está.
   */
  async criar(
    empresaId: string,
    escopo: EscopoAgente,
    input: SalvarAgenteInput,
    organizacaoAtiva?: string | null,
  ): Promise<AgenteUsuarioDto> {
    const dados = await this.validar(
      empresaId,
      escopo,
      input,
      undefined,
      organizacaoAtiva,
    );
    const criado = await this.prisma.agenteUsuario.create({
      data: {
        empresaId,
        usuarioId: escopo.usuarioId,
        organizacaoId:
          escopo.tipo === 'organizacao' ? escopo.organizacaoId : null,
        ...dados,
      },
    });
    return toDto(criado);
  }

  async atualizar(
    empresaId: string,
    escopo: EscopoAgente,
    id: string,
    input: SalvarAgenteInput,
    organizacaoAtiva?: string | null,
  ): Promise<AgenteUsuarioDto> {
    await this.doEscopo(empresaId, escopo, id);
    const dados = await this.validar(
      empresaId,
      escopo,
      input,
      id,
      organizacaoAtiva,
    );
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
    escopo: EscopoAgente,
    id: string,
  ): Promise<{ success: true }> {
    await this.doEscopo(empresaId, escopo, id);
    await this.prisma.agenteUsuario.update({
      where: { id },
      data: { excluidoEm: new Date() },
    });
    return { success: true };
  }

  private async doEscopo(empresaId: string, escopo: EscopoAgente, id: string) {
    const a = await this.prisma.agenteUsuario.findFirst({
      where: { id, empresaId, excluidoEm: null, ...donoDoEscopo(escopo) },
      select: { id: true },
    });
    if (!a) throw new NotFoundException('Agente não encontrado.');
  }

  /**
   * Normaliza os campos e garante menção única: não pode repetir a de um
   * agente do sistema nem a de outro agente vivo do MESMO escopo (comparação
   * sem acento e sem caixa — "@Cultura" e "@cultura" seriam ambíguos).
   *
   * Um agente pessoal também não pode repetir a de um agente da organização
   * ativa: os dois aparecem juntos no "@" do Assistente.
   */
  private async validar(
    empresaId: string,
    escopo: EscopoAgente,
    input: SalvarAgenteInput,
    ignorarId?: string,
    organizacaoAtiva?: string | null,
    /** Agente do sistema que este está substituindo: a menção dele é livre. */
    substituindoSistemaId?: string,
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
    const naoEste = ignorarId ? { id: { not: ignorarId } } : {};
    const orgVizinha =
      escopo.tipo === 'pessoal' && organizacaoAtiva ? organizacaoAtiva : null;
    // Os agentes do sistema que contam são os que a organização ainda vê.
    const orgDoSistema =
      escopo.tipo === 'organizacao' ? escopo.organizacaoId : orgVizinha;
    const [sistemaVisto, mesmoEscopo, daOrg] = await Promise.all([
      this.sistemaDaOrganizacao(empresaId, orgDoSistema),
      this.prisma.agenteUsuario.findMany({
        where: {
          empresaId,
          excluidoEm: null,
          ...donoDoEscopo(escopo),
          ...naoEste,
        },
        select: { mencao: true },
      }),
      orgVizinha
        ? this.prisma.agenteUsuario.findMany({
            where: { empresaId, organizacaoId: orgVizinha, excluidoEm: null },
            select: { mencao: true },
          })
        : Promise.resolve([] as { mencao: string }[]),
    ]);
    const sistema = sistemaVisto.filter((s) => s.id !== substituindoSistemaId);
    const emUso = [
      ...sistema.map((s) => s.mencao),
      ...mesmoEscopo.map((m) => m.mencao),
      ...daOrg.map((m) => m.mencao),
    ];
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
      // Só chaves do catálogo de ícones ("agente:nome") ou o ícone de um
      // agente do sistema ("ceo.nome", mantido ao editá-lo); vazio = iniciais.
      icone: /^(agente:|ceo\.)[a-z0-9-]{1,30}$/.test(input.icone ?? '')
        ? (input.icone as string)
        : null,
    };
  }
}

/** Filtro do dono: pessoal = usuário sem organização; org = a organização. */
function donoDoEscopo(escopo: EscopoAgente) {
  return escopo.tipo === 'pessoal'
    ? { usuarioId: escopo.usuarioId, organizacaoId: null }
    : { organizacaoId: escopo.organizacaoId };
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
