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
import { toRolePublica, type RolePublica } from './role.mapper';
import {
  normalizarPermissoes,
  ROLES_DE_SISTEMA,
  ROLE_OWNER,
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
   * Garante as roles de sistema da organização.
   *
   * Feito sob demanda, na leitura, em vez de num INSERT dentro da migration:
   * a lista de permissões vive no catálogo em TypeScript, e duplicá-la em SQL
   * criaria duas fontes que divergem na primeira funcionalidade nova. Também
   * cobre organizações criadas depois desta versão sem tocar em `companies`.
   *
   * Idempotente: `upsert` por (empresaId, codigo). Roles de sistema são
   * imutáveis para o usuário, então realinhar o conteúdo aqui não sobrescreve
   * escolha de ninguém — é o catálogo sendo aplicado.
   */
  async garantirRolesDeSistema(empresaId: string): Promise<void> {
    for (const padrao of ROLES_DE_SISTEMA) {
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
    const nome = dto.nome.trim();
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
    if (dto.nome !== undefined) data.nome = dto.nome.trim();
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
        `${emUso} ${emUso === 1 ? 'membro usa' : 'membros usam'} esta role. Escolha por qual role ela será substituída antes de excluir.`,
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
          'A role Owner é exclusiva do responsável pela conta e não pode receber outros membros.',
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

  /** Busca escopada ao tenant: um id de outra empresa responde 404. */
  private async buscar(empresaId: string, id: string): Promise<Role> {
    const role = await this.prisma.role.findFirst({ where: { id, empresaId } });
    if (!role) throw new NotFoundException('Role não encontrada.');
    return role;
  }

  private exigirEditavel(role: Role): void {
    if (role.tipo === 'sistema') {
      throw new ForbiddenException(
        `"${role.nome}" é uma role do sistema: não pode ser editada nem excluída.`,
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
