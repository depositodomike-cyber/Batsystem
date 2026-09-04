import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstruturaStatus,
  MembroStatus,
  Prisma,
  type Membro,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ROLE_OWNER } from '@/acesso/permissoes.catalog';
import { CriarMembroDto } from './dto/criar-membro.dto';
import { AtualizarMembroDto } from './dto/atualizar-membro.dto';
import { ExcluirMembroQuery } from './dto/excluir-membro.query';
import { ListarMembrosQuery } from './dto/listar-membros.query';
import {
  toMembroPublico,
  type MembroComGestor,
  type MembroPublico,
} from './membro.mapper';

/** Área/Cargo embutidos nas respostas. `status` atravessa porque a UI precisa
 *  distinguir associação a algo inativo (válida) de opção nova. */
const SELECT_ESTRUTURA = {
  select: { id: true, nome: true, status: true },
} as const;

/**
 * Campos do gestor embutidos nas respostas. Só exibição — nada sensível.
 *
 * Os escalares legados `cargo`/`area` continuam aqui de propósito, ao lado dos
 * refs: eles são o único rótulo de quem foi cadastrado antes da V4, e removê-los
 * deixaria o cargo do gestor em branco na listagem e no seletor.
 */
const SELECT_GESTOR = {
  select: {
    id: true,
    nome: true,
    cargo: true,
    area: true,
    areaRef: SELECT_ESTRUTURA,
    cargoRef: SELECT_ESTRUTURA,
    status: true,
  },
} as const;

/** Role embutida nas respostas, com as permissões herdadas. */
const SELECT_ROLE = {
  select: { id: true, nome: true, tipo: true, permissoes: true },
} as const;

/** Include usado nas quatro respostas, para não divergirem entre si. */
const INCLUDE_MEMBRO = {
  gestor: SELECT_GESTOR,
  /// LEGADO, junto de `Membro.roleId`. Continua no include só para o mapper
  /// poder calcular os campos de compatibilidade da resposta.
  role: SELECT_ROLE,
  /// As roles do membro (até duas). Sem `orderBy` de propósito: a ordenação
  /// vive no mapper, que é o funil único das quatro respostas — assim um call
  /// site que esqueça o orderBy não consegue vazar a ordem física do Postgres.
  rolesAtribuidas: { select: { role: SELECT_ROLE } },
  areaRef: SELECT_ESTRUTURA,
  cargoRef: SELECT_ESTRUTURA,
} as const;

/**
 * Teto de roles por membro.
 *
 * Vive aqui, e não como constraint no banco, de propósito: a única forma
 * declarativa seria uma coluna de slot com `@@unique([membroId, slot])`, que é
 * exatamente o conceito de role principal/secundária que esta versão recusa.
 * Ver o comentário de `model MembroRole` no schema.
 */
const MAX_ROLES_POR_MEMBRO = 2;

/**
 * Membros da organização e a hierarquia entre eles.
 *
 * Toda operação é escopada ao tenant: o `empresaId` entra no `where` junto com
 * o `id`, então um id de outra empresa responde 404 em vez de vazar o registro.
 *
 * A V1 NÃO cria `Usuario` e NÃO envia e-mail: um membro novo nasce como
 * `convite_pendente` sem conta, e é isso que permite cadastrar alguém sem senha
 * sem tocar em nada de autenticação.
 *
 * Consequência a não esquecer: `inativo` é DESCRITIVO nesta versão — não
 * bloqueia login. Bloquear exigiria mexer em `jwt.strategy.ts`, fora do escopo.
 *
 * Acesso (V6): um membro tem de ZERO a duas roles, em `MembroRole`. As
 * permissões efetivas são a UNIÃO das permissões dessas roles — se qualquer uma
 * concede, o membro tem, e nenhuma nega o que a outra concede. Não há
 * prioridade nem ordem entre elas.
 *
 * Acesso (V3, legado): `roleId` aponta para a role da plataforma, que responde o que o
 * membro PODE FAZER. As permissões são sempre HERDADAS da role — não existe
 * permissão individual por membro, e é isso que mantém o modelo previsível.
 *
 * Hierarquia (V2): a única relação persistida é `gestorId`. Equipe direta,
 * cadeia acima e a árvore inteira são derivadas dela, então não existe dado
 * duplicado que possa divergir. Cargo e Área NÃO participam disso: cargo é
 * posição profissional e área é contexto organizacional.
 *
 * Integridade da hierarquia (V5): sair da estrutura — por exclusão ou por
 * desativação — exige uma NOVA LIDERANÇA explícita para os liderados diretos.
 * Antes disso o `onDelete: SetNull` do banco deixava a equipe sem gestor em
 * silêncio; agora o banco só é a rede, e a política vive em
 * `resolverNovaLideranca`. A realocação e a saída vão na MESMA transação, então
 * não existe instante em que alguém aponte para um gestor que já não está lá.
 *
 * Estrutura (V4): `areaId`/`cargoId` apontam para entidades administráveis da
 * organização. Trocar qualquer um dos dois NÃO altera role, permissões nem
 * gestor direto — é só mudança de alocação ou de posição profissional.
 */
@Injectable()
export class MembrosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    empresaId: string,
    filtros: ListarMembrosQuery = {},
  ): Promise<MembroPublico[]> {
    const q = filtros.q?.trim();
    const membros = await this.prisma.membro.findMany({
      where: {
        empresaId,
        ...(filtros.status ? { status: filtros.status } : {}),
        // A busca também roda no cliente (a lista é curta), mas fica aqui para
        // o endpoint ser útil por si só e para o dia em que houver paginação.
        ...(q
          ? {
              OR: [
                { nome: { contains: q, mode: 'insensitive' as const } },
                { email: { contains: q, mode: 'insensitive' as const } },
                // Entidade E texto legado: só a entidade faria a busca regredir
                // para quem ainda não foi reconfigurado.
                {
                  areaRef: {
                    nome: { contains: q, mode: 'insensitive' as const },
                  },
                },
                {
                  cargoRef: {
                    nome: { contains: q, mode: 'insensitive' as const },
                  },
                },
                { area: { contains: q, mode: 'insensitive' as const } },
                { cargo: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: INCLUDE_MEMBRO,
      // Ativos primeiro, depois convites pendentes e inativos (ordem do enum);
      // dentro de cada grupo, por nome.
      orderBy: [{ status: 'asc' }, { nome: 'asc' }],
    });
    return membros.map(toMembroPublico);
  }

  async obter(empresaId: string, id: string): Promise<MembroPublico> {
    return toMembroPublico(await this.buscar(empresaId, id));
  }

  async criar(empresaId: string, dto: CriarMembroDto): Promise<MembroPublico> {
    const email = normalizarEmail(dto.email);

    const jaExiste = await this.prisma.membro.findUnique({
      where: { empresaId_email: { empresaId, email } },
      select: { id: true },
    });
    if (jaExiste) {
      throw new ConflictException('Já existe um membro com este e-mail.');
    }

    // Se o e-mail já é de um usuário DESTA empresa, o membro nasce vinculado e
    // ativo — evita um registro duplicado para quem já tem conta. Conta de
    // outra empresa é ignorada de propósito: responder diferente vazaria a
    // existência dela.
    const conta = await this.prisma.usuario.findFirst({
      where: { email, empresaId },
      select: { id: true },
    });

    const status = conta
      ? MembroStatus.ativo
      : (dto.status ?? MembroStatus.convite_pendente);

    // Na criação não há como formar ciclo (o membro ainda não existe, logo não
    // tem ninguém abaixo dele); basta o gestor existir no mesmo tenant.
    const gestorId = vazioParaNulo(dto.gestorId) ?? null;
    if (gestorId) await this.exigirGestorDoTenant(empresaId, gestorId);

    // `conta` é a conta já existente com este e-mail, quando houver — é ela que
    // decide se a role Owner é aceitável para este membro.
    const roleIds = await this.resolverRoles(
      empresaId,
      dto.roleIds ?? [],
      conta?.id ?? null,
    );

    const areaId = vazioParaNulo(dto.areaId) ?? null;
    if (areaId) await this.exigirAreaDoTenant(empresaId, areaId);

    const cargoId = vazioParaNulo(dto.cargoId) ?? null;
    if (cargoId) await this.exigirCargoDoTenant(empresaId, cargoId);

    try {
      const membro = await this.prisma.membro.create({
        data: {
          empresaId,
          usuarioId: conta?.id ?? null,
          nome: dto.nome.trim(),
          email,
          // As colunas legadas `area`/`cargo` NÃO são escritas: com a entidade
          // atribuída, manter o texto criaria duas fontes de verdade na mesma
          // linha. O DTO ainda aceita os campos e os ignora (ver o comentário
          // lá sobre o forbidNonWhitelisted).
          areaId,
          cargoId,
          gestorId,
          // `roleId` (a coluna legada) NÃO é escrita. Os vínculos entram como
          // create aninhado: o Prisma resolve numa transação só, então não há
          // instante com o membro criado e sem as roles dele.
          rolesAtribuidas: { create: roleIds.map((roleId) => ({ roleId })) },
          status,
          convidadoEm:
            status === MembroStatus.convite_pendente ? new Date() : null,
          desativadoEm: status === MembroStatus.inativo ? new Date() : null,
        },
        include: INCLUDE_MEMBRO,
      });
      return toMembroPublico(membro);
    } catch (err) {
      // Rede de segurança contra corrida entre a checagem acima e o insert.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um membro com este e-mail.');
      }
      throw err;
    }
  }

  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarMembroDto,
    usuarioLogadoId: string,
  ): Promise<MembroPublico> {
    const atual = await this.buscar(empresaId, id);

    // `Unchecked` e não `MembroUpdateInput`: `gestorId` é a FK da auto-relação,
    // e o input "checked" só aceitaria `gestor: { connect | disconnect }`.
    // Escrever a coluna direto deixa "sem gestor" e "com gestor" no mesmo
    // caminho de código, sem ramificar em connect/disconnect.
    const data: Prisma.MembroUncheckedUpdateInput = {};

    if (dto.nome !== undefined) data.nome = dto.nome.trim();

    // `dto.area`/`dto.cargo` são aceitos e IGNORADOS: as colunas de texto são
    // histórico congelado, e um bundle antigo que ainda os envie não pode
    // sobrescrever a entidade escolhida.
    if (dto.areaId !== undefined) {
      const areaId = vazioParaNulo(dto.areaId) ?? null;
      // Só valida quando MUDA. É o que preserva a associação de quem está numa
      // área desativada: um PATCH de outro campo não tropeça na regra, e a
      // recusa de área inativa só vale para escolha nova.
      if (areaId !== atual.areaId) {
        if (areaId) await this.exigirAreaDoTenant(empresaId, areaId);
        data.areaId = areaId;
      }
    }

    if (dto.cargoId !== undefined) {
      const cargoId = vazioParaNulo(dto.cargoId) ?? null;
      if (cargoId !== atual.cargoId) {
        if (cargoId) await this.exigirCargoDoTenant(empresaId, cargoId);
        data.cargoId = cargoId;
      }
    }

    if (dto.email !== undefined) {
      const email = normalizarEmail(dto.email);
      if (email !== atual.email) {
        // O e-mail de quem tem conta É a chave de login (unique global em
        // `usuarios`): alterá-lo aqui seria mexer em autenticação.
        if (atual.usuarioId) {
          throw new ConflictException(
            'O e-mail de quem já tem conta é alterado no perfil da conta.',
          );
        }
        const colide = await this.prisma.membro.findUnique({
          where: { empresaId_email: { empresaId, email } },
          select: { id: true },
        });
        if (colide) {
          throw new ConflictException('Já existe um membro com este e-mail.');
        }
        data.email = email;
      }
    }

    // `dto.roleId` é aceito e IGNORADO, como os campos legados area/cargo.
    // Honrá-lo seria destrutivo: o formulário manda todos os campos em todo
    // save, então um bundle antigo leria `roleId: null` na resposta, mandaria
    // `roleId: ""` e APAGARIA as duas roles numa edição de qualquer outro
    // campo — e o backend não recusaria, porque limpar é legal.
    let rolesDesejadas: string[] | null = null;
    if (dto.roleIds !== undefined) {
      rolesDesejadas = await this.resolverRoles(
        empresaId,
        dto.roleIds,
        atual.usuarioId,
        atual.rolesAtribuidas.map((v) => v.role.id),
      );
    }

    if (dto.gestorId !== undefined) {
      const gestorId = vazioParaNulo(dto.gestorId) ?? null;
      if (gestorId !== atual.gestorId) {
        if (gestorId) await this.validarGestor(empresaId, atual.id, gestorId);
        data.gestorId = gestorId;
      }
    }

    // Desativar também é sair da estrutura: os liderados não podem ficar sem
    // gestor. `dto.reatribuirLiderados` só é considerado nesta transição —
    // fora dela é aceito e ignorado, como os campos legados area/cargo.
    let novoGestorDosLiderados: string | null = null;

    if (dto.status !== undefined && dto.status !== atual.status) {
      await this.validarTransicaoDeStatus(atual, dto.status, usuarioLogadoId);
      if (dto.status === MembroStatus.inativo) {
        novoGestorDosLiderados = await this.resolverNovaLideranca(
          empresaId,
          atual,
          dto.reatribuirLiderados,
        );
      }
      data.status = dto.status;
      data.desativadoEm =
        dto.status === MembroStatus.inativo ? new Date() : null;
      if (dto.status === MembroStatus.convite_pendente) {
        data.convidadoEm = new Date();
      }
    }

    // Nome de membro vinculado é espelhado na conta, para o cabeçalho do app
    // não divergir da listagem. `Membro` continua sendo a fonte de exibição.
    const nomeNovo = typeof data.nome === 'string' ? data.nome : null;
    const usuarioId = atual.usuarioId;

    try {
      // Uma transação quando a edição toca outra tabela: a realocação de
      // liderados e a sincronização de roles precisam ser atômicas com o
      // update do membro. Nunca existe um instante em que o gestor já esteja
      // inativo e os liderados ainda apontem para ele, nem em que o membro
      // esteja salvo com o conjunto de roles antigo.
      if (novoGestorDosLiderados != null || rolesDesejadas != null) {
        const novoGestorId = novoGestorDosLiderados;
        const roles = rolesDesejadas;
        return await this.prisma.$transaction(async (tx) => {
          if (novoGestorId != null) {
            await this.aplicarRealocacao(tx, empresaId, atual.id, novoGestorId);
          }
          if (roles != null) {
            await this.sincronizarRoles(tx, atual.id, roles);
          }
          const membro = await tx.membro.update({
            where: { id: atual.id },
            data,
            include: INCLUDE_MEMBRO,
          });
          if (usuarioId != null && nomeNovo != null) {
            await tx.usuario.update({
              where: { id: usuarioId },
              data: { nome: nomeNovo },
            });
          }
          return toMembroPublico(membro);
        });
      }

      if (usuarioId == null || nomeNovo == null) {
        return toMembroPublico(
          await this.prisma.membro.update({
            where: { id: atual.id },
            data,
            include: INCLUDE_MEMBRO,
          }),
        );
      }
      const [membro] = await this.prisma.$transaction([
        this.prisma.membro.update({
          where: { id: atual.id },
          data,
          include: INCLUDE_MEMBRO,
        }),
        this.prisma.usuario.update({
          where: { id: usuarioId },
          data: { nome: nomeNovo },
        }),
      ]);
      return toMembroPublico(membro);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um membro com este e-mail.');
      }
      throw err;
    }
  }

  /**
   * Só cancela convite. Membro com conta não é excluído — o destrutivo fica
   * restrito a uma linha que nunca representou histórico de uso.
   *
   * Quem lidera alguém não sai sem realocação: ver `resolverNovaLideranca`.
   */
  async remover(
    empresaId: string,
    id: string,
    usuarioLogadoId: string,
    query: ExcluirMembroQuery = {},
  ): Promise<void> {
    const membro = await this.buscar(empresaId, id);
    // As guardas de conta vêm ANTES da contagem de liderados de propósito: se o
    // membro não pode ser excluído de jeito nenhum, o erro tem de falar da
    // conta, não pedir uma nova liderança que não resolveria nada.
    if (membro.usuarioId) {
      if (membro.usuarioId === usuarioLogadoId) {
        throw new ForbiddenException(
          'Você não pode remover o seu próprio acesso.',
        );
      }
      throw new ConflictException(
        'Membro com conta não é excluído; use o status Inativo.',
      );
    }

    const novoGestorId = await this.resolverNovaLideranca(
      empresaId,
      membro,
      query.reatribuirLiderados,
    );

    // Sem liderado nenhum, o fluxo é o mesmo de sempre — nenhuma etapa a mais.
    if (novoGestorId == null) {
      await this.prisma.membro.delete({ where: { id: membro.id } });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.aplicarRealocacao(tx, empresaId, membro.id, novoGestorId);
      await tx.membro.delete({ where: { id: membro.id } });
    });
  }

  /**
   * Resolve e valida a nova liderança dos liderados DIRETOS de `gestor`, para
   * quem está saindo da estrutura (exclusão ou desativação).
   *
   * Devolve `null` quando ninguém responde a ele — é o que preserva o fluxo
   * anterior intacto para a maioria dos casos. Com liderados e sem resolução,
   * recusa com 409 e a contagem, no formato de `RolesService.remover()`: a
   * decisão nunca é implícita.
   *
   * Conta liderados de TODOS os status. Um membro inativo mantém a posição na
   * hierarquia por decisão de projeto, então ignorá-lo o deixaria sem gestor em
   * silêncio — exatamente o que esta regra existe para evitar.
   *
   * NÃO existe valor especial para "deixar sem gestor": aceitá-lo seria a via
   * de contorno da própria regra. Quem precisa disso edita o Gestor direto dos
   * liderados antes, explicitamente.
   */
  private async resolverNovaLideranca(
    empresaId: string,
    gestor: Membro,
    reatribuirLiderados: string | undefined,
  ): Promise<string | null> {
    const liderados = await this.prisma.membro.count({
      where: { empresaId, gestorId: gestor.id },
    });
    if (liderados === 0) return null;

    if (reatribuirLiderados === undefined || reatribuirLiderados === '') {
      throw new ConflictException(
        `${liderados} ${liderados === 1 ? 'membro responde' : 'membros respondem'} a esta pessoa. Escolha uma nova liderança para ${liderados === 1 ? 'ele' : 'eles'} antes de continuar.`,
      );
    }

    // Mensagem própria, e guarda obrigatória por motivo de DADOS: sem ela o
    // `updateMany` seria um no-op e a exclusão dispararia o SetNull do banco,
    // deixando todos os liderados como raiz — o desfecho errado, sem erro.
    if (reatribuirLiderados === gestor.id) {
      throw new ConflictException(
        'A nova liderança não pode ser o próprio membro que está saindo da estrutura.',
      );
    }

    await this.exigirGestorDoTenant(empresaId, reatribuirLiderados);

    if (
      await this.estaAbaixoDe(
        this.prisma,
        empresaId,
        gestor.id,
        reatribuirLiderados,
      )
    ) {
      throw new ConflictException(
        'A nova liderança escolhida responde a este membro, direta ou indiretamente. Escolha alguém de fora da equipe dele.',
      );
    }

    return reatribuirLiderados;
  }

  /**
   * Move os liderados DIRETOS para a nova liderança. Roda sempre dentro da
   * transação que conclui a saída do gestor.
   *
   * Só os diretos: a árvore abaixo de cada um fica exatamente como estava, o
   * que preserva a estrutura interna de cada equipe.
   *
   * Revalida antes de escrever porque o modal pode ter ficado aberto enquanto
   * outra requisição mexia na hierarquia — a operação usa o estado do banco, e
   * não a contagem que a interface carregou.
   */
  private async aplicarRealocacao(
    db: Prisma.TransactionClient,
    empresaId: string,
    gestorId: string,
    novoGestorId: string,
  ): Promise<void> {
    const novoGestor = await db.membro.findFirst({
      where: { id: novoGestorId, empresaId },
      select: { gestorId: true },
    });
    if (!novoGestor) {
      throw new NotFoundException(
        'A nova liderança escolhida não faz parte desta organização.',
      );
    }
    if (
      novoGestor.gestorId === gestorId ||
      (await this.estaAbaixoDe(db, empresaId, gestorId, novoGestorId))
    ) {
      throw new ConflictException(
        'A hierarquia mudou enquanto esta operação estava aberta: a liderança escolhida agora responde a este membro. Recarregue e tente de novo.',
      );
    }

    // `id: { not: novoGestorId }` é cinto redundante: torna o auto-laço — o
    // único desfecho que a interface não conseguiria desfazer — impossível de
    // gravar, mesmo que a revalidação acima falhasse.
    //
    // O `where` é avaliado AQUI, dentro da transação: quem virou liderado
    // depois de a tela carregar também é movido.
    await db.membro.updateMany({
      where: { empresaId, gestorId, id: { not: novoGestorId } },
      data: { gestorId: novoGestorId },
    });
  }

  // --------------------------------------------------------------------

  /** Busca escopada ao tenant. `findFirst` e não `findUnique`: o id sozinho
   *  não pode ser suficiente para alcançar o registro de outra empresa. */
  private async buscar(
    empresaId: string,
    id: string,
  ): Promise<MembroComGestor> {
    const membro = await this.prisma.membro.findFirst({
      where: { id, empresaId },
      include: INCLUDE_MEMBRO,
    });
    if (!membro) {
      throw new NotFoundException('Membro não encontrado.');
    }
    return membro;
  }

  /**
   * Normaliza e valida a lista de roles de um membro, devolvendo o conjunto
   * final a gravar.
   *
   * Deduplica ANTES de contar: na ordem inversa, `["A","A"]` contaria dois e
   * gravaria um só. O `@ArrayMaxSize(2)` do DTO é a primeira barreira, mas não
   * deduplica — então o teto real é verificado aqui.
   *
   * Valida apenas as ADIÇÕES, mesmo *skip-if-unchanged* já usado para área,
   * cargo e gestor: uma role que ficou inválida depois (a Owner de alguém que
   * deixou de ser o responsável, por exemplo) não pode derrubar um PATCH de
   * outro campo. E reusa `exigirRoleDoTenant` em vez de repetir a regra — é
   * ele que aplica o isolamento por organização e a exclusividade da Owner, e
   * chamá-lo por role adicionada faz a regra valer em qualquer um dos dois
   * lugares sem uma linha nova.
   */
  private async resolverRoles(
    empresaId: string,
    roleIdsBrutos: string[],
    usuarioIdDoMembro: string | null,
    jaAtribuidas: readonly string[] = [],
  ): Promise<string[]> {
    const roleIds = [
      ...new Set(roleIdsBrutos.map((r) => r.trim()).filter(Boolean)),
    ];

    if (roleIds.length > MAX_ROLES_POR_MEMBRO) {
      throw new BadRequestException(
        `Um membro pode ter no máximo ${MAX_ROLES_POR_MEMBRO} roles.`,
      );
    }

    const atuais = new Set(jaAtribuidas);
    for (const roleId of roleIds) {
      if (atuais.has(roleId)) continue;
      await this.exigirRoleDoTenant(empresaId, roleId, usuarioIdDoMembro);
    }

    return roleIds;
  }

  /**
   * Aplica o conjunto de roles de um membro dentro de uma transação.
   *
   * Remove os vínculos que saíram e cria os que entraram, em vez de apagar
   * tudo e recriar: preserva o `criadoEm` de quem continua, e não gera
   * escrita para uma edição que não mexeu em role.
   */
  private async sincronizarRoles(
    db: Prisma.TransactionClient,
    membroId: string,
    roleIds: readonly string[],
  ): Promise<void> {
    const atuais = await db.membroRole.findMany({
      where: { membroId },
      select: { roleId: true },
    });
    const atual = new Set(atuais.map((v) => v.roleId));
    const desejado = new Set(roleIds);

    const remover = [...atual].filter((r) => !desejado.has(r));
    const adicionar = [...desejado].filter((r) => !atual.has(r));

    if (remover.length > 0) {
      await db.membroRole.deleteMany({
        where: { membroId, roleId: { in: remover } },
      });
    }
    if (adicionar.length > 0) {
      await db.membroRole.createMany({
        data: adicionar.map((roleId) => ({ membroId, roleId })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * A área tem de existir, ser da MESMA organização e estar ATIVA.
   *
   * O `empresaId` no `where` é o que garante o isolamento: uma área de outra
   * organização responde 404 e nunca é selecionável.
   *
   * Área inativa é recusada como escolha NOVA. Quem já está numa área
   * desativada permanece nela — quem chama só valida quando o valor muda.
   */
  private async exigirAreaDoTenant(
    empresaId: string,
    areaId: string,
  ): Promise<void> {
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, empresaId },
      select: { nome: true, status: true },
    });
    if (!area) {
      throw new NotFoundException(
        'A área escolhida não faz parte desta organização.',
      );
    }
    if (area.status === EstruturaStatus.inativo) {
      throw new ConflictException(
        `A área "${area.nome}" está inativa e não pode ser atribuída. Reative-a em Estrutura › Áreas.`,
      );
    }
  }

  /** Mesma regra da área, no masculino. */
  private async exigirCargoDoTenant(
    empresaId: string,
    cargoId: string,
  ): Promise<void> {
    const cargo = await this.prisma.cargo.findFirst({
      where: { id: cargoId, empresaId },
      select: { nome: true, status: true },
    });
    if (!cargo) {
      throw new NotFoundException(
        'O cargo escolhido não faz parte desta organização.',
      );
    }
    if (cargo.status === EstruturaStatus.inativo) {
      throw new ConflictException(
        `O cargo "${cargo.nome}" está inativo e não pode ser atribuído. Reative-o em Estrutura › Cargos.`,
      );
    }
  }

  /**
   * A role tem de existir e ser da MESMA organização. Mesmo mecanismo do
   * gestor: o `empresaId` no `where` é o que garante o isolamento.
   *
   * Também aplica a EXCLUSIVIDADE da role Owner: ela pertence à conta que criou
   * a organização e não pode ser atribuída a mais ninguém. A checagem vive aqui
   * porque este é o único caminho por onde toda atribuição passa (criação e
   * edição) — deixá-la em cada call site abriria a porta de esquecer uma.
   *
   * `usuarioIdDoMembro` é a conta vinculada ao membro que vai receber a role;
   * `null`/`undefined` é um convidado sem conta, que nunca pode ser Owner.
   */
  private async exigirRoleDoTenant(
    empresaId: string,
    roleId: string,
    usuarioIdDoMembro?: string | null,
  ): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, empresaId },
      select: { id: true, codigo: true },
    });
    if (!role) {
      throw new NotFoundException(
        'A role escolhida não faz parte desta organização.',
      );
    }

    if (role.codigo !== ROLE_OWNER) return;

    // Compara pela conta, e não pelo e-mail do membro: o vínculo real é
    // `Membro.usuarioId`, e `Usuario.role` é a mesma fonte que já protege o
    // responsável de ser desativado (ver `validarTransicaoDeStatus`).
    const conta = usuarioIdDoMembro
      ? await this.prisma.usuario.findUnique({
          where: { id: usuarioIdDoMembro },
          select: { role: true },
        })
      : null;

    if (conta?.role !== 'owner') {
      throw new ForbiddenException(
        'A role Owner é exclusiva do responsável pela conta e não pode ser atribuída a outro membro.',
      );
    }
  }

  /**
   * Regra 01 — o gestor tem de existir e ser da MESMA organização. O `where`
   * com `empresaId` é o que garante isso: um id de outro tenant não é achado.
   */
  private async exigirGestorDoTenant(
    empresaId: string,
    gestorId: string,
  ): Promise<void> {
    const gestor = await this.prisma.membro.findFirst({
      where: { id: gestorId, empresaId },
      select: { id: true },
    });
    if (!gestor) {
      throw new NotFoundException(
        'O gestor escolhido não faz parte desta organização.',
      );
    }
  }

  /**
   * Regras 01, 02 e 04 para uma troca de gestor.
   *
   * A checagem de ciclo sobe a cadeia a partir do gestor proposto: se em algum
   * ponto ela chega no próprio membro, é porque o gestor está abaixo dele na
   * árvore e a mudança fecharia um laço. Cobre o ciclo curto (A→B→A) e os
   * longos (A→B→C→A) com o mesmo caminhamento.
   */
  private async validarGestor(
    empresaId: string,
    membroId: string,
    gestorId: string,
  ): Promise<void> {
    // Regra 02 — ninguém é gestor de si mesmo.
    if (gestorId === membroId) {
      throw new ConflictException('Um membro não pode ser gestor de si mesmo.');
    }

    await this.exigirGestorDoTenant(empresaId, gestorId);

    if (await this.estaAbaixoDe(this.prisma, empresaId, membroId, gestorId)) {
      throw new ConflictException(
        'Essa escolha criaria um ciclo na hierarquia: o gestor escolhido já responde a este membro.',
      );
    }
  }

  /**
   * `candidatoId` está abaixo de `ancestralId` na cadeia de gestores?
   *
   * Como `gestorId` é único por membro, "estar abaixo de X" e "ter X na cadeia
   * acima" são a MESMA pergunta — daí uma subida simples responder as duas.
   *
   * Uma query e o caminhamento em memória, e não uma query por salto: assim a
   * checagem aceita o cliente de transação (a realocação precisa revalidar
   * DENTRO dela) e o caminhamento não para no meio quando uma aresta aponta
   * para fora do tenant.
   *
   * O `Set` de visitados encerra a subida num ciclo pré-existente entre
   * terceiros sem culpar a operação atual — que não é responsável por ele.
   */
  private async estaAbaixoDe(
    db: Prisma.TransactionClient,
    empresaId: string,
    ancestralId: string,
    candidatoId: string,
  ): Promise<boolean> {
    if (candidatoId === ancestralId) return false;

    const membros = await db.membro.findMany({
      where: { empresaId },
      select: { id: true, gestorId: true },
    });
    const gestorDe = new Map(membros.map((m) => [m.id, m.gestorId]));

    const visitados = new Set<string>();
    let atual: string | null = candidatoId;

    while (atual != null) {
      if (atual === ancestralId) return true;
      if (visitados.has(atual)) return false;
      visitados.add(atual);
      atual = gestorDe.get(atual) ?? null;
    }
    return false;
  }

  private async validarTransicaoDeStatus(
    membro: Membro,
    destino: MembroStatus,
    usuarioLogadoId: string,
  ): Promise<void> {
    if (destino === MembroStatus.convite_pendente && membro.usuarioId) {
      throw new ConflictException(
        'Quem já tem conta não volta para convite pendente.',
      );
    }

    if (destino !== MembroStatus.inativo) return;

    if (membro.usuarioId === usuarioLogadoId) {
      throw new ForbiddenException(
        'Você não pode desativar o seu próprio acesso.',
      );
    }

    if (membro.usuarioId) {
      const conta = await this.prisma.usuario.findUnique({
        where: { id: membro.usuarioId },
        select: { role: true },
      });
      if (conta?.role === 'owner') {
        throw new ForbiddenException(
          'O responsável pela conta não pode ser desativado.',
        );
      }
    }
  }
}

/** A unique do Postgres é case-sensitive; normalizar é o que a torna efetiva. */
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** String vazia vira null, para não conviverem dois jeitos de dizer "sem área". */
function vazioParaNulo(valor: string | undefined): string | null | undefined {
  if (valor === undefined) return undefined;
  const limpo = valor.trim();
  return limpo === '' ? null : limpo;
}
