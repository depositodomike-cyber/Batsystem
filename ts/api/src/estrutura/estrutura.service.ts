import { ConflictException, NotFoundException } from '@nestjs/common';
import { EstruturaStatus, Prisma } from '@prisma/client';
import { ListarEstruturaQuery } from './dto/listar-estrutura.query';
import { CriarEstruturaDto } from './dto/criar-estrutura.dto';
import { AtualizarEstruturaDto } from './dto/atualizar-estrutura.dto';
import {
  toEstruturaPublica,
  type EstruturaComContagem,
  type EstruturaPublica,
} from './estrutura.mapper';

/**
 * Regras compartilhadas de Área e Cargo (V4 — Estrutura).
 *
 * As duas entidades são gêmeas: mesmos campos, mesma tela, mesmas regras de
 * unicidade, desativação e exclusão. A lógica vive AQUI uma vez só, e cada
 * service concreto (`AreasService`, `CargosService`) entra apenas com um
 * adaptador tipado sobre o seu delegate do Prisma e com a cópia das mensagens.
 *
 * A alternativa — dois arquivos quase idênticos — significaria corrigir toda
 * regra duas vezes. A outra — uma tabela única com discriminador `tipo` —
 * obrigaria todo `where` a carregá-lo para não misturar as duas listas.
 *
 * O que estas entidades deliberadamente NÃO fazem:
 *   • não concedem permissão (isso é Role);
 *   • não definem hierarquia (isso é `Membro.gestorId`);
 *   • não têm responsável, área superior nem subáreas.
 */

/** Dados de criação já normalizados pelo service. */
export interface DadosCriacaoEstrutura {
  empresaId: string;
  nome: string;
  descricao: string | null;
}

/** Dados de edição já normalizados. Campo ausente = não mexer. */
export interface DadosAtualizacaoEstrutura {
  nome?: string;
  descricao?: string | null;
  status?: EstruturaStatus;
  desativadoEm?: Date | null;
}

/** Identificação mínima usada no pré-check de nome. */
export interface EstruturaResumo {
  id: string;
  nome: string;
  status: EstruturaStatus;
}

/**
 * Adaptador sobre o delegate do Prisma.
 *
 * Existe porque `prisma.area` e `prisma.cargo` são tipos distintos, ainda que
 * os modelos tenham a mesma forma. Cada implementação é um punhado de funções
 * totalmente tipadas contra o seu próprio delegate — sem `any` e sem cast.
 */
export interface RepositorioEstrutura {
  /** Escopado ao tenant: id de outra empresa devolve `null` (vira 404). */
  buscar(empresaId: string, id: string): Promise<EstruturaComContagem | null>;
  /** Comparação case-insensitive, que a unique do Postgres não faz. */
  buscarPorNome(
    empresaId: string,
    nome: string,
  ): Promise<EstruturaResumo | null>;
  listar(
    empresaId: string,
    filtro: ListarEstruturaQuery,
  ): Promise<EstruturaComContagem[]>;
  criar(dados: DadosCriacaoEstrutura): Promise<EstruturaComContagem>;
  atualizar(
    id: string,
    dados: DadosAtualizacaoEstrutura,
  ): Promise<EstruturaComContagem>;
  excluir(id: string): Promise<void>;
  /** Conta membros vinculados, para a guarda de exclusão. */
  contarMembros(empresaId: string, id: string): Promise<number>;
}

/** Mensagens específicas da entidade — gênero e substantivo mudam. */
export interface CopyEstrutura {
  naoEncontrado: string;
  nomeDuplicado: string;
  /**
   * Caso confuso o suficiente para merecer mensagem própria: o nome colide com
   * um registro INATIVO, que a listagem padrão da tela não destaca.
   */
  nomeDuplicadoInativo: string;
  emUso: (membros: number) => string;
}

export abstract class EstruturaService {
  protected abstract readonly repo: RepositorioEstrutura;
  protected abstract readonly copy: CopyEstrutura;

  async listar(
    empresaId: string,
    filtro: ListarEstruturaQuery = {},
  ): Promise<EstruturaPublica[]> {
    const itens = await this.repo.listar(empresaId, filtro);
    return itens.map(toEstruturaPublica);
  }

  async obter(empresaId: string, id: string): Promise<EstruturaPublica> {
    return toEstruturaPublica(await this.buscar(empresaId, id));
  }

  async criar(
    empresaId: string,
    dto: CriarEstruturaDto,
  ): Promise<EstruturaPublica> {
    const nome = dto.nome.trim();
    await this.exigirNomeLivre(empresaId, nome, null);

    try {
      const criado = await this.repo.criar({
        empresaId,
        nome,
        descricao: vazioParaNulo(dto.descricao) ?? null,
      });
      return toEstruturaPublica(criado);
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  /**
   * Edita nome, descrição e status.
   *
   * NUNCA toca em `membro.areaId`/`membro.cargoId`: desativar preserva as
   * associações existentes de propósito — só impede escolhas novas —, e o
   * `MembrosService` é o único caminho de escrita do vínculo.
   */
  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarEstruturaDto,
  ): Promise<EstruturaPublica> {
    const atual = await this.buscar(empresaId, id);

    const dados: DadosAtualizacaoEstrutura = {};

    if (dto.nome !== undefined) {
      const nome = dto.nome.trim();
      if (nome.toLowerCase() !== atual.nome.toLowerCase()) {
        await this.exigirNomeLivre(empresaId, nome, atual.id);
      }
      dados.nome = nome;
    }

    if (dto.descricao !== undefined) {
      dados.descricao = vazioParaNulo(dto.descricao) ?? null;
    }

    // Status e timestamp andam em par, como em `Membro.desativadoEm`: reativar
    // zera o registro de desativação em vez de deixar uma data órfã.
    if (dto.status !== undefined && dto.status !== atual.status) {
      dados.status = dto.status;
      dados.desativadoEm =
        dto.status === EstruturaStatus.inativo ? new Date() : null;
    }

    try {
      const atualizado = await this.repo.atualizar(atual.id, dados);
      return toEstruturaPublica(atualizado);
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  /**
   * Exclui — só quando nada aponta para o registro.
   *
   * Com membros vinculados a chamada é recusada com 409 e a contagem: a saída
   * é desativar, que preserva registro, histórico e vínculos. Não há
   * reatribuição em massa como em roles, porque área e cargo não têm destino
   * óbvio, e não há exclusão em cascata em nenhuma hipótese.
   *
   * O `SetNull` da FK é apenas a rede de segurança do banco; a política é
   * esta guarda.
   */
  async remover(empresaId: string, id: string): Promise<void> {
    const atual = await this.buscar(empresaId, id);

    // Contagem própria, e não o `_count` já carregado: a guarda tem de ler o
    // estado mais recente possível (mesma escolha de `RolesService.remover`).
    const emUso = await this.repo.contarMembros(empresaId, atual.id);
    if (emUso > 0) {
      throw new ConflictException(this.copy.emUso(emUso));
    }

    await this.repo.excluir(atual.id);
  }

  // --------------------------------------------------------------------

  /** Busca escopada ao tenant: um id de outra empresa responde 404. */
  private async buscar(
    empresaId: string,
    id: string,
  ): Promise<EstruturaComContagem> {
    const item = await this.repo.buscar(empresaId, id);
    if (!item) throw new NotFoundException(this.copy.naoEncontrado);
    return item;
  }

  /**
   * Pré-check de nome, case-insensitive.
   *
   * A unique `(empresaId, nome)` do Postgres é case-sensitive, então sem isto
   * "Produto" e "produto" conviveriam — indistinguíveis num seletor. O `P2002`
   * segue tratado como rede em `traduzirErro`, para a corrida entre dois
   * cadastros simultâneos.
   */
  private async exigirNomeLivre(
    empresaId: string,
    nome: string,
    excetoId: string | null,
  ): Promise<void> {
    const existente = await this.repo.buscarPorNome(empresaId, nome);
    if (!existente || existente.id === excetoId) return;
    throw new ConflictException(
      existente.status === EstruturaStatus.inativo
        ? this.copy.nomeDuplicadoInativo
        : this.copy.nomeDuplicado,
    );
  }

  private traduzirErro(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(this.copy.nomeDuplicado);
    }
    return err;
  }
}

/** String vazia vira null, mesma convenção de área/cargo em membros. */
export function vazioParaNulo(
  valor: string | undefined,
): string | null | undefined {
  if (valor === undefined) return undefined;
  const limpo = valor.trim();
  return limpo === '' ? null : limpo;
}
