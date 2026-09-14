import { ConflictException, NotFoundException } from '@nestjs/common';
import { EstruturaStatus, Prisma } from '@prisma/client';
import { ListarEstruturaQuery } from './dto/listar-estrutura.query';
import { CriarEstruturaDto } from './dto/criar-estrutura.dto';
import { AtualizarEstruturaDto } from './dto/atualizar-estrutura.dto';
import {
  SEM_REALOCACAO,
  type ExcluirEstruturaQuery,
} from './dto/excluir-estrutura.query';
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

  // As quatro abaixo recebem o cliente de transação: a realocação e a
  // desativação/exclusão que a acompanha são uma operação só, e ler a
  // contagem fora dela faria quem entrasse na área no intervalo ficar para
  // trás. Convenção do projeto para helpers que rodam dentro e fora de
  // transação (`RolesService` e `MembrosService` fazem igual).

  /**
   * Abre a transação.
   *
   * Mora no repositório, e não numa injeção de `PrismaService` nesta classe:
   * o adaptador já é o único ponto que conhece o Prisma, e a regra aqui
   * continua sem depender dele.
   */
  transacao<T>(fn: (db: Prisma.TransactionClient) => Promise<T>): Promise<T>;

  /** A edição, dentro da transação. */
  atualizarEm(
    db: Prisma.TransactionClient,
    id: string,
    dados: DadosAtualizacaoEstrutura,
  ): Promise<EstruturaComContagem>;

  /** A mesma contagem, dentro da transação. */
  contarMembrosEm(
    db: Prisma.TransactionClient,
    empresaId: string,
    id: string,
  ): Promise<number>;

  /**
   * Move os colaboradores de uma Área/Cargo para outro, ou para nenhum.
   *
   * `destinoId: null` desfaz o vínculo — e zera TAMBÉM a coluna legada de
   * texto (`Membro.area` / `Membro.cargo`), sem a qual a tela continuaria
   * exibindo o nome de uma entidade que deixou de existir: `rotuloArea` no
   * front resolve `areaRef?.nome ?? texto legado`. Com destino a coluna legada
   * fica intocada de propósito — a entidade vence na exibição, e aquelas
   * colunas são congeladas.
   *
   * Grava UM campo (dois no caso acima) e nada mais: cargo ao realocar área,
   * área ao realocar cargo, gestor direto, gestores indiretos, roles e status
   * do membro não são tocados. Não "melhore" isto para um update mais amplo.
   */
  realocarMembros(
    db: Prisma.TransactionClient,
    empresaId: string,
    deId: string,
    destinoId: string | null,
  ): Promise<number>;

  /** A exclusão, dentro da transação. */
  excluirEm(db: Prisma.TransactionClient, id: string): Promise<void>;
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
  /** 409 da exclusão sem resolução: diz a contagem e as duas saídas. */
  emUso: (membros: number) => string;
  /** 404 do destino de realocação fora do tenant. */
  destinoNaoEncontrado: string;
  /** 409 do destino inativo. */
  destinoInativo: (nome: string) => string;
  /** 409 do destino igual à origem. */
  destinoEhAOrigem: string;
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
   * Desativar continua PRESERVANDO as associações: é essa a diferença entre
   * desativar e excluir, e ela não mudou. A única escrita em
   * `membro.areaId`/`membro.cargoId` daqui é a realocação EXPLÍCITA pedida
   * em `dto.realocarPara`, e só na transição ativo → inativo.
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
    const desativando =
      dto.status === EstruturaStatus.inativo &&
      atual.status !== EstruturaStatus.inativo;
    if (dto.status !== undefined && dto.status !== atual.status) {
      dados.status = dto.status;
      dados.desativadoEm = desativando ? new Date() : null;
    }

    // Realocar só faz sentido na desativação. Em qualquer outra edição o campo
    // é aceito e ignorado — o formulário manda o payload inteiro em todo save,
    // e recusar aqui daria 409 numa troca de nome.
    const destinoId = desativando
      ? await this.resolverDestino(empresaId, atual.id, dto.realocarPara)
      : null;

    try {
      if (destinoId == null) {
        const atualizado = await this.repo.atualizar(atual.id, dados);
        return toEstruturaPublica(atualizado);
      }

      // Com destino, mover e desativar são uma operação só: nunca existe um
      // instante com a entidade já inativa e os colaboradores ainda nela.
      const atualizado = await this.repo.transacao(async (tx) => {
        await this.repo.realocarMembros(tx, empresaId, atual.id, destinoId);
        return this.repo.atualizarEm(tx, atual.id, dados);
      });
      return toEstruturaPublica(atualizado);
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  /**
   * Exclui, com realocação OPCIONAL dos colaboradores vinculados.
   *
   * Antes esta chamada era simplesmente recusada com 409 quando havia gente na
   * área, e o comentário aqui dizia que "área e cargo não têm destino óbvio".
   * A regra mudou: o destino óbvio não existe mesmo, e por isso quem escolhe é
   * quem administra — inclusive escolher não ter destino.
   *
   * `realocarPara` ausente com colaboradores vinculados CONTINUA dando 409. A
   * recusa não é sobre proteger o dado (a tela já explica a consequência): é
   * sobre não deixar um cliente que desconhece o modal transformar em remoção
   * silenciosa de vínculo uma chamada que até então era recusada.
   */
  async remover(
    empresaId: string,
    id: string,
    query: ExcluirEstruturaQuery = {},
  ): Promise<void> {
    const atual = await this.buscar(empresaId, id);

    // Contagem própria, e não o `_count` já carregado: a guarda tem de ler o
    // estado mais recente possível (mesma escolha de `RolesService.remover`).
    const emUso = await this.repo.contarMembros(empresaId, atual.id);
    if (emUso > 0 && query.realocarPara === undefined) {
      throw new ConflictException(this.copy.emUso(emUso));
    }

    if (emUso === 0) {
      await this.repo.excluir(atual.id);
      return;
    }

    const destinoId = await this.resolverDestino(
      empresaId,
      atual.id,
      query.realocarPara,
    );

    await this.repo.transacao(async (tx) => {
      // Recontar AQUI dentro, e não confiar no número de fora: o modal pode
      // ter ficado aberto enquanto alguém entrava na área, e é a lista de
      // agora que precisa ser movida. Mesma razão de `aplicarRealocacao` em
      // MembrosService.
      const agora = await this.repo.contarMembrosEm(tx, empresaId, atual.id);
      if (agora > 0) {
        await this.repo.realocarMembros(tx, empresaId, atual.id, destinoId);
      }
      await this.repo.excluirEm(tx, atual.id);
    });
  }

  /**
   * Traduz `realocarPara` no id de destino, ou `null` para "sem destino".
   *
   * Compartilhado pela desativação e pela exclusão, que validam o destino da
   * mesma forma. O destino nunca atravessa o tipo (Área → Cargo) por
   * construção: cada service concreto só enxerga o próprio delegate.
   */
  private async resolverDestino(
    empresaId: string,
    origemId: string,
    realocarPara: string | undefined,
  ): Promise<string | null> {
    if (realocarPara === undefined || realocarPara === SEM_REALOCACAO) {
      return null;
    }

    if (realocarPara === origemId) {
      throw new ConflictException(this.copy.destinoEhAOrigem);
    }

    const destino = await this.repo.buscar(empresaId, realocarPara);
    if (!destino) throw new NotFoundException(this.copy.destinoNaoEncontrado);
    if (destino.status === EstruturaStatus.inativo) {
      throw new ConflictException(this.copy.destinoInativo(destino.nome));
    }
    return destino.id;
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
