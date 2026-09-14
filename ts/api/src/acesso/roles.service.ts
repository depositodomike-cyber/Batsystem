import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CriarRoleDto } from './dto/criar-role.dto';
import { AtualizarRoleDto } from './dto/atualizar-role.dto';
import { ExcluirRoleQuery } from './dto/excluir-role.query';
import { MembroStatus, MembroTipo } from '@prisma/client';
import { toRolePublica, type RolePublica } from './role.mapper';
import { TransferirPropriedadeDto } from './dto/transferir-propriedade.dto';
import {
  chaveDeNomeDeRole,
  CODIGOS_DE_ROLE_PROTEGIDA,
  MAX_ROLES_POR_MEMBRO,
  ROLE_CONVIDADO,
  NOMES_DE_ROLE_RESERVADOS,
  normalizarPermissoes,
  ROLE_OWNER,
  ROLES_DE_SISTEMA,
} from './permissoes.catalog';

/**
 * Roles e permissões da organização (V3).
 *
 * Uma role responde "o que o membro PODE FAZER". Ela NÃO responde sobre quais
 * dados — isso é escopo de acesso, e fica para a V4.
 *
 * Duas invariantes sustentam o resto:
 *   1. Roles de sistema (admin/editor/viewer) existem em toda organização e são
 *      IMUTÁVEIS. É o que garante que nunca se perca uma role com acesso
 *      administrativo completo, sem precisar de regra especial em cada edição.
 *   2. O conjunto gravado em `permissoes` passa sempre por
 *      `normalizarPermissoes`, então "editar sem visualizar" não existe no
 *      banco nem quando a API é chamada direto.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante a role Owner da organização.
   *
   * Feito sob demanda, na leitura, em vez de num INSERT dentro da migration:
   * a lista de permissões vive no catálogo em TypeScript, e duplicá-la em SQL
   * criaria duas fontes que divergem na primeira funcionalidade nova. Também
   * cobre organizações criadas depois desta versão sem tocar em `companies`.
   *
   * SÓ a Owner, e isso mudou: antes as quatro roles de sistema eram realinhadas
   * a cada listagem. Desde que Admin, Editor e Viewer passaram a ser editáveis,
   * realinhá-las desfaria toda edição no próximo carregamento da aba e
   * recriaria as excluídas. Elas nascem em `CompaniesService.cadastrar()` e
   * depois pertencem a quem administra. A Owner é imutável e imprescindível —
   * sem ela não há o que transferir —, então continua sendo garantida aqui,
   * `create` e `update`.
   */
  async garantirRolesDeSistema(empresaId: string): Promise<void> {
    // As PROTEGIDAS, e só elas. Admin, Editor e Viewer nascem em
    // `CompaniesService.cadastrar()` e depois pertencem a quem administra —
    // realinhá-las aqui desfaria toda edição no próximo carregamento da aba.
    //
    // Owner e Convidado são o caso oposto, e é a mesma razão nos dois: elas
    // precisam ser IMUTÁVEIS. O realinhamento a cada `listar()`, que seria um
    // bug nas outras três, é justamente o mecanismo que garante que uma edição
    // feita por fora (SQL, um bug futuro) não sobreviva.
    for (const padrao of ROLES_DE_SISTEMA) {
      if (!CODIGOS_DE_ROLE_PROTEGIDA.has(padrao.codigo)) continue;
      await this.garantirRoleProtegida(empresaId, padrao);
    }
  }

  /**
   * Devolve o id da role Convidado da organização, garantindo-a antes.
   *
   * Existe porque `MembrosService` precisa da role no momento da conversão, e
   * `garantirRolesDeSistema` só era chamada por `listar()` — uma organização
   * onde ninguém abriu a aba Acesso não teria a role, e a conversão falharia
   * por um motivo que não é do usuário.
   *
   * Chame FORA de transação, como `transferirPropriedade` faz: o upsert é
   * escrita própria, e prendê-lo à transação da conversão alonga o lock sem
   * ganho nenhum.
   */
  async idDaRoleConvidado(empresaId: string): Promise<string> {
    await this.garantirRolesDeSistema(empresaId);
    const role = await this.prisma.role.findUnique({
      where: { empresaId_codigo: { empresaId, codigo: ROLE_CONVIDADO } },
      select: { id: true },
    });
    if (!role) {
      // Inalcançável: o upsert acima acabou de criá-la. Se acontecer, é sinal
      // de que a garantia parou de funcionar, e engolir esconderia a causa.
      throw new ConflictException(
        'A role Convidado não está disponível nesta organização. Recarregue e tente de novo.',
      );
    }
    return role.id;
  }

  private async garantirRoleProtegida(
    empresaId: string,
    padrao: (typeof ROLES_DE_SISTEMA)[number],
  ): Promise<void> {
    try {
      await this.upsertRoleDeSistema(empresaId, padrao);
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== 'P2002'
      ) {
        throw err;
      }
      // O upsert resolve (empresaId, codigo), então este P2002 só pode ser a
      // unique (empresaId, nome): existe uma role PERSONALIZADA ocupando o nome
      // desta protegida — criada antes de o nome ser reservado.
      //
      // Não pode propagar: este método é a primeira linha de `listar()`, a
      // única rota que renderiza a aba Acesso. Um throw aqui é 500 permanente
      // na tela, e a tela que renomearia a intrusa é justamente a que não abre.
      // Por isso o reparo vive aqui, no único lugar capaz de fazê-lo.
      //
      // Sufixo do id em vez de "(2)": é único por construção, então não há laço
      // de tentativas nem chance de colidir de novo.
      const intrusa = await this.prisma.role.findFirst({
        where: { empresaId, nome: padrao.nome, codigo: null },
        select: { id: true, nome: true },
      });
      if (!intrusa) throw err; // não é o caso previsto — não engolir.
      await this.prisma.role.update({
        where: { id: intrusa.id },
        data: { nome: `${intrusa.nome} (${intrusa.id.slice(-6)})` },
      });
      console.warn(
        `[acesso] role personalizada "${intrusa.nome}" renomeada: o nome é reservado à role de sistema "${padrao.nome}".`,
      );
      await this.upsertRoleDeSistema(empresaId, padrao);
    }
  }

  private async upsertRoleDeSistema(
    empresaId: string,
    padrao: (typeof ROLES_DE_SISTEMA)[number],
  ): Promise<void> {
    await this.prisma.role.upsert({
      where: { empresaId_codigo: { empresaId, codigo: padrao.codigo } },
      create: {
        empresaId,
        codigo: padrao.codigo,
        nome: padrao.nome,
        descricao: padrao.descricao,
        tipo: 'sistema',
        permissoes: padrao.permissoes,
      },
      update: {
        nome: padrao.nome,
        descricao: padrao.descricao,
        permissoes: padrao.permissoes,
      },
    });
  }

  async listar(empresaId: string): Promise<RolePublica[]> {
    await this.garantirRolesDeSistema(empresaId);
    const roles = await this.prisma.role.findMany({
      where: { empresaId },
      include: { _count: { select: { membrosAtribuidos: true } } },
      // Sistema primeiro (é a referência), depois personalizadas por nome.
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    });
    return roles.map(toRolePublica);
  }

  async obter(empresaId: string, id: string): Promise<RolePublica> {
    // Query própria em vez de `buscar()`: ela não carrega o `_count`, então
    // esta rota devolvia `membros: 0` para qualquer role. Ficou anos invisível
    // porque o `_count` era opcional no tipo do mapper; torná-lo obrigatório
    // transformou o silêncio em erro de compilação.
    const role = await this.prisma.role.findFirst({
      where: { id, empresaId },
      include: { _count: { select: { membrosAtribuidos: true } } },
    });
    if (!role) throw new NotFoundException('Role não encontrada.');
    return toRolePublica(role);
  }

  async criar(empresaId: string, dto: CriarRoleDto): Promise<RolePublica> {
    const nome = await this.exigirNomeLivre(empresaId, dto.nome);
    const permissoes = normalizarPermissoes(dto.permissoes ?? []);
    if (permissoes.length === 0) {
      throw new BadRequestException(
        'Selecione ao menos uma permissão para a role.',
      );
    }

    try {
      const role = await this.prisma.role.create({
        data: {
          empresaId,
          nome,
          descricao: vazioParaNulo(dto.descricao) ?? null,
          // Só o catálogo cria role de sistema; pela API tudo é personalizada.
          tipo: 'personalizada',
          codigo: null,
          permissoes,
        },
        include: { _count: { select: { membrosAtribuidos: true } } },
      });
      return toRolePublica(role);
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarRoleDto,
  ): Promise<RolePublica> {
    const atual = await this.buscar(empresaId, id);
    this.exigirEditavel(atual);

    const data: Prisma.RoleUncheckedUpdateInput = {};
    if (dto.nome !== undefined) {
      data.nome = await this.exigirNomeLivre(empresaId, dto.nome, atual.id);
    }
    if (dto.descricao !== undefined) {
      data.descricao = vazioParaNulo(dto.descricao) ?? null;
    }
    if (dto.permissoes !== undefined) {
      const permissoes = normalizarPermissoes(dto.permissoes);
      if (permissoes.length === 0) {
        throw new BadRequestException(
          'Selecione ao menos uma permissão para a role.',
        );
      }
      data.permissoes = permissoes;
    }

    try {
      const role = await this.prisma.role.update({
        where: { id: atual.id },
        data,
        include: { _count: { select: { membrosAtribuidos: true } } },
      });
      return toRolePublica(role);
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  /**
   * Exclui uma role personalizada.
   *
   * Nunca em silêncio: se houver membros usando, a chamada é recusada com a
   * contagem, e só passa quando o administrador informa o que fazer com eles
   * (`reatribuirPara` = id de outra role, ou "nenhuma" para deixá-los sem
   * role). A reatribuição e a exclusão vão na mesma transação, então não existe
   * instante em que alguém aponte para uma role que já não existe.
   *
   * Com até duas roles por membro, `reatribuirPara` SUBSTITUI a role excluída:
   * quem tinha [A] fica [X]; quem tinha [A, B] fica [B, X]; quem já tinha X só
   * perde o vínculo com A. Nunca passa de duas.
   */
  async remover(
    empresaId: string,
    id: string,
    query: ExcluirRoleQuery = {},
  ): Promise<void> {
    const atual = await this.buscar(empresaId, id);
    this.exigirEditavel(atual);

    // Conta VÍNCULOS, não a coluna legada `membros.roleId`. É o mesmo número
    // que `_count.membrosAtribuidos` põe na tela, por construção.
    const emUso = await this.prisma.membroRole.count({
      where: { roleId: atual.id },
    });

    if (emUso > 0 && query.reatribuirPara === undefined) {
      throw new ConflictException(
        `${emUso} ${emUso === 1 ? 'colaborador usa' : 'colaboradores usam'} esta role. Escolha por qual role ela será substituída antes de excluir.`,
      );
    }

    let destinoId: string | null = null;
    if (emUso > 0 && query.reatribuirPara !== 'nenhuma') {
      const destino = await this.prisma.role.findFirst({
        where: { id: query.reatribuirPara, empresaId },
        select: { id: true, codigo: true },
      });
      if (!destino) {
        throw new NotFoundException(
          'A role de destino não faz parte desta organização.',
        );
      }
      if (destino.id === atual.id) {
        throw new ConflictException(
          'A role de destino não pode ser a que está sendo excluída.',
        );
      }
      // Continua sendo o ÚNICO caminho de atribuição que não passa por
      // `MembrosService.exigirRoleDoTenant`, onde a exclusividade da Owner é
      // aplicada. Com N:N a guarda fica MAIS necessária, não menos: sem ela,
      // excluir uma role substituindo por Owner ACRESCENTARIA Owner a todos que
      // a usavam, sem tirar nada deles.
      if (destino.codigo === ROLE_OWNER) {
        throw new ForbiddenException(
          'A role Owner é exclusiva do responsável pela conta e não pode receber outros colaboradores.',
        );
      }
      destinoId = destino.id;
    }

    // Interativa, e não a `$transaction([...])` de antes: o `createMany` do
    // destino precisa da LISTA de membros, e ler essa lista fora da transação
    // faria quem recebeu a role nesse intervalo perdê-la em silêncio — o
    // Cascade apagaria o vínculo dele e nenhum destino entraria no lugar.
    await this.prisma.$transaction(async (tx) => {
      const vinculos =
        destinoId == null
          ? []
          : await tx.membroRole.findMany({
              where: { roleId: atual.id },
              select: { membroId: true },
            });

      // Sem destino, ninguém pode ficar sem role nenhuma.
      //
      // `reatribuirPara: 'nenhuma'` continua existindo porque é correto com
      // frequência: quem tem duas roles e perde uma continua com a outra. O que
      // ele não pode mais fazer é produzir um membro sem role — "ao menos uma
      // role" é regra da plataforma, e esta era a única operação sancionada que
      // a violava.
      //
      // DENTRO da transação, ao contrário da contagem de `emUso` lá acima: a
      // lista de vínculos é justamente o que vai ser apagado, e conferir fora
      // deixaria quem recebeu a role no intervalo ficar sem nenhuma em
      // silêncio. É o mesmo motivo pelo qual `vinculos` é lido aqui.
      if (destinoId == null) {
        const orfaos = await this.contarMembrosSemOutraRole(tx, atual.id);
        if (orfaos > 0) {
          throw new ConflictException(
            `${orfaos} ${orfaos === 1 ? 'colaborador ficaria' : 'colaboradores ficariam'} sem role nenhuma. Escolha por qual role esta será substituída.`,
          );
        }
      }

      // Remover ANTES de inserir. Não é indiferença de ordem: é o que mantém o
      // teto de duas roles verdadeiro em TODO instante — inserindo primeiro,
      // quem tinha [A, B] passaria por um estado com três vínculos.
      await tx.membroRole.deleteMany({ where: { roleId: atual.id } });

      if (destinoId != null && vinculos.length > 0) {
        // `skipDuplicates` É a deduplicação do caso [A, B] com destino B: o
        // membro não pode receber um segundo vínculo igual, e sem isto o P2002
        // abortaria a exclusão inteira. Ele encolhe de duas roles para uma, que
        // é o desfecho certo — já tinha a role de destino.
        await tx.membroRole.createMany({
          data: vinculos.map((v) => ({
            membroId: v.membroId,
            roleId: destinoId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.role.delete({ where: { id: atual.id } });
    });
  }

  /**
   * Quantos membros perderiam a ÚNICA role deles se esta role fosse excluída.
   *
   * Duas consultas, e não uma contagem de vínculos: com o teto de duas roles
   * daria para inferir ("quem aparece com um segundo vínculo tem exatamente
   * um"), mas a conta passaria a depender do teto e erraria em silêncio se ele
   * mudasse. O `groupBy` conta MEMBROS distintos, seja qual for o teto.
   */
  private async contarMembrosSemOutraRole(
    db: Prisma.TransactionClient,
    roleId: string,
  ): Promise<number> {
    const daRole = await db.membroRole.findMany({
      where: { roleId },
      select: { membroId: true },
    });
    if (daRole.length === 0) return 0;

    const ids = daRole.map((v) => v.membroId);
    const comOutra = await db.membroRole.groupBy({
      by: ['membroId'],
      where: { membroId: { in: ids }, roleId: { not: roleId } },
    });
    return ids.length - comOutra.length;
  }

  /**
   * Transfere a propriedade da organização para outro membro.
   *
   * "Propriedade" são DUAS coisas, e as duas mudam aqui, na mesma transação:
   *   • `Usuario.role = 'owner'` — o gate legado, lido em doze pontos da API;
   *   • o vínculo com a Role de código `owner` — o que a aba Acesso mostra.
   *
   * Mudar uma sem a outra produz o estado que NADA revalida: o
   * *skip-if-unchanged* de `MembrosService.resolverRoles` nunca reexamina um
   * vínculo Owner já atribuído, então rebaixar a conta sem apagar o vínculo
   * deixaria dois portadores para sempre.
   *
   * A Role Owner em si NÃO é tocada: mesma entidade, mesmo id, mesmas
   * permissões. Só o portador muda.
   *
   * NÃO passa pelo `MembrosService`, por duas razões independentes:
   * `MembrosModule` já importa `AcessoModule` (pelo `PermissoesGuard`), então a
   * chamada inversa seria circular; e `exigirRoleDoTenant` valida a Owner
   * contra o `Usuario.role` que esta operação está mudando — antes do update
   * ele recusa, depois aprova por construção, ou seja não valida nada. A regra
   * é reproduzida aqui, na ordem certa e com a linha travada.
   */
  async transferirPropriedade(
    empresaId: string,
    usuarioLogadoId: string,
    dto: TransferirPropriedadeDto,
  ): Promise<{ ownerAnterior: string; ownerAtual: string }> {
    // Fora da transação: é idempotente, e a Role Owner pode simplesmente não
    // existir ainda numa organização em que ninguém abriu a aba Acesso.
    await this.garantirRolesDeSistema(empresaId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Trava as linhas de owner do tenant e confirma que quem chama AINDA
      // é o proprietário.
      //
      // É esta consulta — não o guard — que fecha o "dois owners" de chamadas
      // simultâneas: a segunda espera aqui e, depois do commit da primeira, o
      // predicado `role = 'owner'` já não casa com a linha antiga, então ela
      // volta sem o chamador e a chamada é recusada.
      //
      // `ORDER BY id` dá ordem de trava determinística: sem ele, duas
      // transferências partindo de um estado com dois owners poderiam travar
      // em ordens opostas e o Postgres abortaria uma por deadlock em vez de
      // devolver um erro legível.
      const owners = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
          FROM "usuarios"
         WHERE "empresaId" = ${empresaId}
           AND "role" = 'owner'
         ORDER BY id
           FOR UPDATE
      `;
      if (!owners.some((u) => u.id === usuarioLogadoId)) {
        throw new ForbiddenException(
          'A propriedade da organização mudou enquanto esta operação estava aberta. Recarregue e tente de novo.',
        );
      }

      // 2. Destino elegível.
      //
      // `status: ativo` não é redundante com `usuarioId != null`: inativo com
      // conta é estado alcançável, e um proprietário inativo é exatamente o que
      // `validarTransicaoDeStatus` proíbe pela porta da frente.
      //
      // `usuario: { is: { empresaId } }` fecha escalada entre organizações: a FK
      // `Membro.usuarioId` NÃO força mesmo tenant, e os seeds escrevem membro
      // direto — sem esta cláusula seria possível promover a conta de outra
      // empresa a proprietária desta.
      const destino = await tx.membro.findFirst({
        where: {
          id: dto.novoOwnerMembroId,
          empresaId,
          status: MembroStatus.ativo,
          usuario: { is: { empresaId } },
        },
        select: {
          id: true,
          nome: true,
          usuarioId: true,
          rolesAtribuidas: { select: { roleId: true } },
        },
      });
      if (!destino || destino.usuarioId == null) {
        throw new NotFoundException(
          'Este colaborador não pode receber a propriedade: ele precisa fazer parte desta organização, estar ativo e já ter conta de acesso.',
        );
      }
      if (destino.usuarioId === usuarioLogadoId) {
        throw new ConflictException('Você já é o proprietário da organização.');
      }

      const roleOwner = await tx.role.findUnique({
        where: { empresaId_codigo: { empresaId, codigo: ROLE_OWNER } },
        select: { id: true },
      });
      if (!roleOwner) {
        throw new ConflictException(
          'A role Owner desta organização não está disponível. Abra a aba Acesso e tente de novo.',
        );
      }

      // 3. Teto de roles, contado JÁ SEM a Owner: se o destino tem duas OUTRAS
      // roles não há vaga, e recusar é melhor do que escolher no lugar dele
      // qual perder. Contando com a Owner, quem já a tivesse por estado
      // inconsistente seria recusado sem motivo.
      const outrasDoDestino = destino.rolesAtribuidas.filter(
        (v) => v.roleId !== roleOwner.id,
      ).length;
      if (outrasDoDestino >= MAX_ROLES_POR_MEMBRO) {
        throw new ConflictException(
          `${destino.nome} já possui o limite de ${MAX_ROLES_POR_MEMBRO} roles. Remova uma delas antes de transferir a propriedade.`,
        );
      }

      // 4. O membro de quem transfere. `null` é caso REAL, não defensivo:
      // `CompaniesService.cadastrar()` cria a conta proprietária e NÃO cria
      // `Membro`. Quem nunca foi adicionado à tela de Membros chega aqui sem
      // linha nenhuma, e então não há a quem dar a role de substituição.
      const membroAtual = await tx.membro.findUnique({
        where: {
          empresaId_usuarioId: { empresaId, usuarioId: usuarioLogadoId },
        },
        select: { id: true, rolesAtribuidas: { select: { roleId: true } } },
      });

      let roleDeSubstituicao: string | null = null;
      if (membroAtual != null && dto.roleParaOwnerAtual) {
        const substituta = await tx.role.findFirst({
          where: { id: dto.roleParaOwnerAtual, empresaId },
          select: { id: true, codigo: true },
        });
        if (!substituta) {
          throw new NotFoundException(
            'A role escolhida não faz parte desta organização.',
          );
        }
        if (substituta.codigo === ROLE_OWNER) {
          throw new ConflictException(
            'A role Owner passa para o novo proprietário. Escolha outra role para você.',
          );
        }
        const jaTem = membroAtual.rolesAtribuidas.some(
          (v) => v.roleId === substituta.id,
        );
        const outrasDoAtual = membroAtual.rolesAtribuidas.filter(
          (v) => v.roleId !== roleOwner.id,
        ).length;
        if (!jaTem && outrasDoAtual >= MAX_ROLES_POR_MEMBRO) {
          throw new ConflictException(
            `Você já possui o limite de ${MAX_ROLES_POR_MEMBRO} roles. Remova uma antes de transferir a propriedade.`,
          );
        }
        roleDeSubstituicao = jaTem ? null : substituta.id;
      }

      // 5. Vínculos antes das contas, e o delete antes do create.
      //
      // `deleteMany` de TODOS os portadores da Owner no tenant, e não `delete`
      // do vínculo de quem transfere: cobre (a) quem transfere sem `Membro`,
      // (b) um portador órfão de estado inconsistente, e (c) o destino que JÁ
      // tenha o vínculo — aí um `create` puro daria P2002 e abortaria a
      // transferência inteira, justamente na organização que precisava dela
      // para se consertar.
      //
      // `membro: { empresaId }` é o que mantém o deleteMany dentro do tenant:
      // `MembroRole` não tem `empresaId` (ver o comentário do model).
      await tx.membroRole.deleteMany({
        where: { roleId: roleOwner.id, membro: { empresaId } },
      });
      await tx.membroRole.create({
        data: { membroId: destino.id, roleId: roleOwner.id },
      });
      if (roleDeSubstituicao != null && membroAtual != null) {
        await tx.membroRole.create({
          data: { membroId: membroAtual.id, roleId: roleDeSubstituicao },
        });
      }

      // 6. Rebaixar ANTES de promover. Não é indiferença de ordem: o índice
      // único parcial `usuarios_um_owner_por_empresa` é checado por STATEMENT,
      // não no commit — promover primeiro estouraria dentro da própria
      // transação que ia deixar o estado consistente.
      //
      // Para `membro`, e não `admin`: como `admin` ele não perderia NADA (os
      // gates legados aceitam owner ou admin), e "deixou de ser proprietário"
      // seria só uma frase. O acesso administrativo dele passa a vir da role
      // que a transferência atribui — pelo caminho novo, auditável.
      await tx.usuario.update({
        where: { id: usuarioLogadoId },
        data: { role: 'membro' },
      });
      await tx.usuario.update({
        where: { id: destino.usuarioId },
        data: { role: 'owner' },
      });

      return { ownerAnterior: usuarioLogadoId, ownerAtual: destino.usuarioId };
    });
  }

  /**
   * Permissões efetivas de um usuário: a UNIÃO das permissões de TODAS as roles
   * atribuídas ao membro dele (até duas). Usado pelo `PermissoesGuard` e pela
   * rota que diz ao front o que o usuário logado pode fazer.
   *
   * União simples, sem precedência: se qualquer uma das roles concede, o membro
   * tem. Uma role não nega o que a outra concede — o "não concedido" de uma
   * role significa ausência, nunca proibição.
   *
   * Consultada a partir de `Role`, e não descendo por `Membro`: o Prisma
   * resolve cada nível de relação numa consulta própria, então
   * `membro.findFirst({ select: { rolesAtribuidas: { select: { role: … } } } })`
   * custaria três idas ao banco. Este `where` desce pela relação como um EXISTS
   * e o banco responde em UMA — uma a menos que a versão de role única. Importa
   * porque isto roda em toda requisição com `@RequerPermissao`.
   *
   * `normalizarPermissoes` é o mesmo normalizador da escrita: deduplica,
   * reinstala as dependências e devolve na ordem do catálogo. Consequência a
   * conhecer: um código gravado que saiu do catálogo é DESCARTADO daqui. É
   * estritamente mais seguro (o guard usa `includes`), mas muda o número que
   * `/empresa/roles/minhas-permissoes` devolve.
   *
   * `Usuario.role` (owner/admin) NÃO é consultado aqui de propósito: quem
   * decide o bypass legado é o guard, e manter isso separado deixa explícito
   * que a role da plataforma é uma camada nova, não um substituto.
   */
  /**
   * Contexto de autorização de quem está requisitando: se é um membro
   * CONVIDADO, e quais permissões ele tem.
   *
   * O tipo entra aqui, e não dentro do `PermissoesGuard`, porque três call
   * sites precisam da mesma resposta — o guard, `GET /minhas-permissoes` e a
   * decisão de memória corporativa — e reproduzir a regra em cada um é uma
   * chance de esquecer uma.
   *
   * `convidado: false` quando a conta não tem `Membro` neste tenant. É caso
   * REAL, não defensivo: `CompaniesService.cadastrar()` cria a conta
   * proprietária e NÃO cria o membro dela. Quem nunca foi adicionado à tela de
   * Membros não é convidado.
   *
   * As duas leituras vão juntas porque o guard precisa das duas no mesmo
   * caminho, e separá-las voltaria a permitir que uma fosse feita sem a outra.
   */
  async contextoDeAutorizacao(
    empresaId: string,
    usuarioId: string,
  ): Promise<{ convidado: boolean; permissoes: string[] }> {
    const [membro, permissoes] = await Promise.all([
      this.prisma.membro.findUnique({
        where: { empresaId_usuarioId: { empresaId, usuarioId } },
        select: { tipo: true },
      }),
      this.permissoesDoUsuario(empresaId, usuarioId),
    ]);
    return { convidado: membro?.tipo === MembroTipo.convidado, permissoes };
  }

  async permissoesDoUsuario(
    empresaId: string,
    usuarioId: string,
  ): Promise<string[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        empresaId,
        membrosAtribuidos: { some: { membro: { empresaId, usuarioId } } },
      },
      select: { permissoes: true },
    });
    return normalizarPermissoes(roles.flatMap((r) => r.permissoes));
  }

  // --------------------------------------------------------------------

  /**
   * O nome está livre nesta organização?
   *
   * Três recusas distintas, de propósito:
   *
   *   • VAZIO após trim → 400. O `@IsNotEmpty` do DTO valida a string BRUTA,
   *     então "   " passa por ele e criaria uma role sem nome.
   *   • RESERVADO → 409. Não é "já existe": a organização pode ainda não ter a
   *     Owner criada (`garantirRolesDeSistema` só roda em `listar()`), e
   *     permitir aqui é o que gera o P2002 permanente descrito naquele método.
   *   • DUPLICADO sem caixa → 409. A unique do banco é case-sensitive, então
   *     sozinha ela deixaria "Suporte" e "suporte" conviverem — e a mensagem
   *     "já existe uma role com este nome" seria mentira.
   *
   * O pré-check é sujeito a corrida; `traduzirErro` (P2002 → 409) continua
   * sendo a rede, mesmo padrão de `MembrosService.criar`.
   */
  private async exigirNomeLivre(
    empresaId: string,
    nome: string,
    ignorarRoleId?: string,
  ): Promise<string> {
    const limpo = nome.trim();
    if (limpo === '') {
      throw new BadRequestException('Informe o nome da role.');
    }
    if (NOMES_DE_ROLE_RESERVADOS.has(chaveDeNomeDeRole(limpo))) {
      throw new ConflictException(
        `"${limpo}" é o nome da role do sistema. Escolha outro nome.`,
      );
    }
    const colide = await this.prisma.role.findFirst({
      where: {
        empresaId,
        nome: { equals: limpo, mode: 'insensitive' },
        // Sem isto, renomear "Suporte" para "suporte" acusaria colisão com ela
        // mesma.
        ...(ignorarRoleId ? { id: { not: ignorarRoleId } } : {}),
      },
      select: { id: true },
    });
    if (colide) {
      throw new ConflictException('Já existe uma role com este nome.');
    }
    return limpo;
  }

  /** Busca escopada ao tenant: um id de outra empresa responde 404. */
  private async buscar(empresaId: string, id: string): Promise<Role> {
    const role = await this.prisma.role.findFirst({ where: { id, empresaId } });
    if (!role) throw new NotFoundException('Role não encontrada.');
    return role;
  }

  /**
   * A Owner é a ÚNICA role protegida.
   *
   * A checagem é por `codigo`, e não por `tipo === 'sistema'`, de propósito:
   * `codigo` é a identificação estrutural estável — um rename ou um dado legado
   * não a dissolve. E Admin, Editor e Viewer, que também são `tipo: 'sistema'`,
   * passaram a ser administráveis como qualquer outra role: `tipo` agora diz só
   * de ONDE a role veio (catálogo ou administrador), não se pode ser mexida.
   */
  private exigirEditavel(role: Role): void {
    if (role.codigo === ROLE_OWNER) {
      throw new ForbiddenException(
        'A role Owner é do sistema: não pode ser editada, desativada nem excluída. Para mudar de proprietário, use "Transferir propriedade".',
      );
    }
    // Mensagem própria: a da Owner manda transferir a propriedade, que não
    // existe aqui. A Convidado é imutável por outra razão — ela é o teto de
    // acesso de quem está fora da organização, e editá-la mudaria em silêncio o
    // que TODO convidado pode fazer.
    if (role.codigo === ROLE_CONVIDADO) {
      throw new ForbiddenException(
        'A role Convidado é do sistema: não pode ser editada nem excluída. Ela é atribuída automaticamente aos colaboradores do tipo convidado.',
      );
    }
  }

  private traduzirErro(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('Já existe uma role com este nome.');
    }
    return err;
  }
}

/** String vazia vira null, mesma convenção de área/cargo em membros. */
function vazioParaNulo(valor: string | undefined): string | null | undefined {
  if (valor === undefined) return undefined;
  const limpo = valor.trim();
  return limpo === '' ? null : limpo;
}
