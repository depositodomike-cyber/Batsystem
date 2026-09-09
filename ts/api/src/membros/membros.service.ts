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
  MembroTipo,
  Prisma,
  type Membro,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  MAX_ROLES_POR_MEMBRO,
  ROLE_CONVIDADO,
  ROLE_OWNER,
} from '@/acesso/permissoes.catalog';
import { RolesService } from '@/acesso/roles.service';
import { MAX_GESTORES_INDIRETOS } from './membros.constants';
import { CriarMembroDto } from './dto/criar-membro.dto';
import { AtualizarMembroDto } from './dto/atualizar-membro.dto';
import { ExcluirMembroQuery } from './dto/excluir-membro.query';
import { ListarMembrosQuery } from './dto/listar-membros.query';
import {
  toMembroPublico,
  type MembroComGestor,
  type MembroPublico,
} from './membro.mapper';

/**
 * O tipo do membro DEPOIS da operação, mais a role Convidado da organização
 * quando ela é necessária.
 *
 * `tipoMudou` é o que separa "o cliente acabou de reclassificar esta pessoa"
 * de "o cliente está afirmando algo sobre quem já era convidado" — e é essa
 * distinção que decide entre ignorar em silêncio e recusar com 409.
 */
interface ContextoDeTipo {
  tipo: MembroTipo;
  tipoMudou: boolean;
  /** Obrigatório quando `tipo === convidado`; irrelevante no outro caso. */
  roleConvidadoId: string | null;
}

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
  /// Gestores indiretos. Reusa `SELECT_GESTOR` de propósito: a UI já sabe
  /// renderizar esse resumo, e é o `status` dele que faz o selo "inativo"
  /// valer aqui sem uma linha nova. Sem `orderBy`, mesmo motivo das roles —
  /// e aqui o argumento é mais forte, porque `sincronizarGestoresIndiretos`
  /// reescreve linhas e a ordem física muda de verdade.
  ///
  /// NÃO filtre por status. `exigirGestoresDoTenant` não checa status (gestor
  /// inativo continua gestor, a UI só sinaliza), e um `where` aqui faria
  /// desativar alguém encolher a lista de TERCEIROS em silêncio — e então um
  /// sincronizar calculado sobre a lista truncada apagaria de verdade as
  /// linhas que a leitura escondeu.
  gestoresIndiretos: { select: { gestorIndireto: SELECT_GESTOR } },
  areaRef: SELECT_ESTRUTURA,
  cargoRef: SELECT_ESTRUTURA,
} as const;

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
  constructor(
    private readonly prisma: PrismaService,
    // Só para `idDaRoleConvidado`: a conversão precisa da role Convidado da
    // organização, e garanti-la é responsabilidade de quem é dono do catálogo.
    private readonly roles: RolesService,
  ) {}

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

    const tipo = dto.tipo ?? MembroTipo.membro;
    const ehConvidado = tipo === MembroTipo.convidado;

    // Na CRIAÇÃO, campo estrutural junto de `convidado` é recusado — e a
    // assimetria com `atualizar` (que zera em silêncio) é deliberada: lá o
    // payload pode ser eco do estado anterior, aqui o cliente está afirmando
    // tudo do zero, então não há o que reinterpretar. Aceitar e descartar
    // esconderia um cliente que não entendeu o conceito.
    if (ehConvidado) {
      const estruturais =
        vazioParaNulo(dto.areaId) ??
        vazioParaNulo(dto.cargoId) ??
        vazioParaNulo(dto.gestorId) ??
        // Os textos legados entram na checagem, mas NUNCA são gravados (o
        // create abaixo não os escreve para ninguém). Estão aqui porque um
        // bundle antigo que os enviasse estaria afirmando uma estrutura que
        // este membro não pode ter — e o silêncio pareceria aceitação.
        vazioParaNulo(dto.area) ??
        vazioParaNulo(dto.cargo) ??
        (dto.gestorIndiretoIds?.length ? 'indiretos' : null) ??
        (dto.roleIds?.length ? 'roles' : null);
      if (estruturais != null) {
        throw new ConflictException(
          'Um membro convidado não tem área, cargo, gestores nem roles próprias: ele recebe a role Convidado automaticamente.',
        );
      }
    }

    // Fora de qualquer transação, como `transferirPropriedade` faz: o upsert
    // da role é escrita própria e não pertence ao lock da criação.
    const roleConvidadoId = ehConvidado
      ? await this.roles.idDaRoleConvidado(empresaId)
      : null;

    // Na criação não há como formar ciclo (o membro ainda não existe, logo não
    // tem ninguém abaixo dele); basta o gestor existir no mesmo tenant.
    const gestorId = ehConvidado ? null : (vazioParaNulo(dto.gestorId) ?? null);
    if (gestorId) await this.exigirGestorDoTenant(empresaId, gestorId);

    // Logo depois do gestor direto, porque depende dele: é ele que o item da
    // regra "o direto não pode ser também indireto" compara. Na criação isso é
    // trivial — os dois valores vêm no mesmo payload —, e `membroId: null`
    // porque o membro ainda não tem id, logo não há como auto-associar.
    const gestoresIndiretos = await this.resolverGestoresIndiretos(
      empresaId,
      null,
      gestorId,
      true,
      dto.gestorIndiretoIds ?? [],
    );

    // `conta` é a conta já existente com este e-mail, quando houver — é ela que
    // decide se a role Owner é aceitável para este membro.
    const roleIds = await this.resolverRoles(
      empresaId,
      dto.roleIds ?? [],
      conta?.id ?? null,
      // `tipoMudou: true` na criação: não existe estado anterior, então o tipo
      // é sempre uma afirmação nova — e é ele que decide a lista.
      { tipo, tipoMudou: true, roleConvidadoId },
    );

    // Todo membro nasce com ao menos uma role: é regra da plataforma, não do
    // formulário. Sem role a pessoa entra no cadastro sem poder fazer nada, e
    // nada na tela diz isso — o mesmo motivo que já exigia a escolha na
    // conversão de convidado para membro, agora valendo desde a criação.
    //
    // A guarda de tipo é pela MENSAGEM, não pela regra: para um convidado a
    // lista nunca é vazia (`resolverRoles` devolve a role Convidado, ou falha
    // antes), e mandar "escolha uma role" a quem não escolhe role nenhuma
    // seria uma instrução impossível de cumprir.
    if (!ehConvidado && roleIds.length === 0) {
      throw new BadRequestException(
        'Escolha ao menos uma role para o membro: ela é o que define o que a pessoa pode fazer na plataforma.',
      );
    }

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
          tipo,
          // `roleId` (a coluna legada) NÃO é escrita. Os vínculos entram como
          // create aninhado: o Prisma resolve numa transação só, então não há
          // instante com o membro criado e sem as roles dele.
          rolesAtribuidas: { create: roleIds.map((roleId) => ({ roleId })) },
          // Mesmo create aninhado das roles, e pelo mesmo motivo: o Prisma
          // resolve numa transação só, então não há instante com o membro
          // criado e a lista de indiretos faltando. Nenhuma `$transaction`
          // explícita é necessária aqui.
          gestoresIndiretos: {
            create: gestoresIndiretos.map((gestorIndiretoId) => ({
              gestorIndiretoId,
            })),
          },
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

    // O tipo ALVO, derivado do DTO e nunca de `data`: o padrão
    // skip-if-unchanged só preenche `data` quando o campo muda, então ler dali
    // faria um PATCH de outro campo qualquer calcular "membro" e a regra sumir
    // sem erro nenhum. Mesmo argumento de `gestorDiretoFinal`.
    const tipoFinal = dto.tipo ?? atual.tipo;
    const tipoMudou = dto.tipo !== undefined && dto.tipo !== atual.tipo;
    const ehConvidado = tipoFinal === MembroTipo.convidado;
    const viraConvidado = tipoMudou && ehConvidado;
    if (tipoMudou) data.tipo = tipoFinal;

    // O responsável pela conta não vira convidado. A checagem vem ANTES de
    // tudo — se a conversão é impossível, o erro tem de falar de propriedade e
    // não pedir uma realocação de liderados que não resolveria nada. É o mesmo
    // ordenamento que `remover` usa para as guardas de conta.
    //
    // E é sobre `Usuario.role`, não sobre o vínculo com a role Owner: um
    // proprietário sem o vínculo (estado alcançável — `cadastrar()` cria a
    // conta e não cria o membro) escaparia da guarda de `resolverRoles` e
    // viraria convidado com a conta ainda proprietária.
    if (viraConvidado && atual.usuarioId) {
      const conta = await this.prisma.usuario.findUnique({
        where: { id: atual.usuarioId },
        select: { role: true },
      });
      if (conta?.role === 'owner') {
        throw new ForbiddenException(
          'O responsável pela conta não pode ser convertido em convidado. Use "Transferir propriedade" na aba Acesso antes.',
        );
      }
    }

    const roleConvidadoId = ehConvidado
      ? await this.roles.idDaRoleConvidado(empresaId)
      : null;

    /**
     * Um campo estrutural (área, cargo, gestor) para quem termina convidado.
     *
     * Dois ramos, e são a mesma distinção de `resolverGestoresIndiretos`:
     * quando o TIPO mudou nesta requisição, o campo alterado é a afirmação e o
     * valor no payload é eco do formulário — zera em silêncio, inclusive
     * quando o payload NÃO o mandou, quebrando o skip-if-unchanged de
     * propósito (senão um PATCH que só manda `{tipo:'convidado'}` deixaria
     * área, cargo e gestor intactos e a regra seria violada por omissão).
     * Quando já era convidado, não há campo alterado para reinterpretar: o
     * cliente afirmou algo que contradiz o estado, e leva 409.
     */
    const zerarEstrutural = (
      enviado: string | undefined,
      atualValor: string | null,
      rotulo: string,
    ): { limpar: boolean } => {
      if (!viraConvidado && vazioParaNulo(enviado) != null) {
        throw new ConflictException(
          `Um membro convidado não tem ${rotulo}. Converta-o em membro antes de definir este campo.`,
        );
      }
      return { limpar: atualValor != null };
    };

    if (dto.nome !== undefined) data.nome = dto.nome.trim();

    // `dto.area`/`dto.cargo` são aceitos e IGNORADOS: as colunas de texto são
    // histórico congelado, e um bundle antigo que ainda os envie não pode
    // sobrescrever a entidade escolhida.
    if (ehConvidado) {
      // `exigirAreaDoTenant` NÃO roda aqui: validar se uma área está ativa
      // para alguém que vai ficar sem área é trabalho jogado fora — e pior, uma
      // área inativa daria 409 numa operação que ia justamente removê-la.
      if (zerarEstrutural(dto.areaId, atual.areaId, 'área').limpar) {
        data.areaId = null;
      }
      if (zerarEstrutural(dto.cargoId, atual.cargoId, 'cargo').limpar) {
        data.cargoId = null;
      }

      // As colunas de TEXTO legadas também. É a única escrita que o código
      // novo faz nelas, e ela é necessária: quem exibe resolve o rótulo com
      // precedência `areaRef` → texto legado, então um convidado com `areaId`
      // nulo e `area: "marketing"` continuaria mostrando "Marketing" na coluna
      // Área — e alimentando o filtro por área com uma opção que ele não tem.
      //
      // Não contradiz o "histórico congelado" daqueles campos: o congelamento
      // impede que um bundle antigo sobrescreva a ENTIDADE escolhida. Aqui a
      // entidade está sendo removida de propósito, e deixar o texto para trás
      // manteria na tela exatamente o que a conversão foi feita para desfazer.
      if (atual.area != null) data.area = null;
      if (atual.cargo != null) data.cargo = null;
    } else {
      if (dto.areaId !== undefined) {
        const areaId = vazioParaNulo(dto.areaId) ?? null;
        // Só valida quando MUDA. É o que preserva a associação de quem está
        // numa área desativada: um PATCH de outro campo não tropeça na regra, e
        // a recusa de área inativa só vale para escolha nova.
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
    // `|| tipoMudou` NÃO é redundante — é a linha que faz a conversão
    // funcionar. A transação só é acionada quando algum destes três é não
    // nulo; se `dto.roleIds` viesse `undefined` num PATCH que só flipa o
    // tipo, `rolesDesejadas` ficaria nulo, `sincronizarRoles` não rodaria, e
    // o membro viraria convidado CARREGANDO a role Admin — com HTTP 200 e
    // nenhum log.
    let rolesDesejadas: string[] | null = null;
    if (dto.roleIds !== undefined || tipoMudou) {
      rolesDesejadas = await this.resolverRoles(
        empresaId,
        dto.roleIds ?? [],
        atual.usuarioId,
        { tipo: tipoFinal, tipoMudou, roleConvidadoId },
        atual.rolesAtribuidas.map((v) => v.role.id),
      );
    }

    // "Ao menos uma role" na edição, em duas mensagens porque são duas
    // situações diferentes para quem está na tela.
    //
    // A conversão vem primeiro: quem deixa de ser convidado não está removendo
    // role nenhuma, está escolhendo a primeira, e a instrução tem de dizer
    // isso.
    if (tipoMudou && !ehConvidado && (rolesDesejadas?.length ?? 0) === 0) {
      throw new ConflictException(
        'Escolha a role que este membro terá ao deixar de ser convidado.',
      );
    }

    // E aqui a remoção da ÚLTIMA role de um membro comum.
    //
    // `atual.rolesAtribuidas.length > 0` está na condição de propósito, e é o
    // mesmo *skip-if-unchanged* que já vale para área, cargo, gestor e para as
    // adições de role: quem JÁ está sem nenhuma (cadastro anterior a esta
    // regra, ou linha mexida à mão) continua editável nos outros campos.
    // Recusar ali daria 409 numa edição de nome, num estado que o operador não
    // criou — e o formulário dele nem oferece o que consertar se a organização
    // não tiver role atribuível. Na primeira role que ele receber, esta guarda
    // passa a valer para ele também: o dado converge sem migration.
    //
    // Quem impede o estado de nascer é `criar`; quem impede de acontecer pela
    // tela é o formulário, que exige a role antes de enviar. Esta linha é a
    // que fecha o caminho da API.
    if (
      !ehConvidado &&
      rolesDesejadas != null &&
      rolesDesejadas.length === 0 &&
      atual.rolesAtribuidas.length > 0
    ) {
      throw new ConflictException(
        'Um membro precisa de ao menos uma role. Escolha a nova antes de remover a atual.',
      );
    }

    if (ehConvidado) {
      // `validarGestor` NÃO roda: checar ciclo para quem vai ficar sem gestor
      // é trabalho jogado fora, e um ciclo pré-existente daria 409 numa
      // operação que ia justamente desfazê-lo.
      if (zerarEstrutural(dto.gestorId, atual.gestorId, 'gestor direto').limpar) {
        data.gestorId = null;
      }
    } else if (dto.gestorId !== undefined) {
      const gestorId = vazioParaNulo(dto.gestorId) ?? null;
      if (gestorId !== atual.gestorId) {
        if (gestorId) await this.validarGestor(empresaId, atual.id, gestorId);
        data.gestorId = gestorId;
      }
    }

    // Gestores indiretos — DEPOIS do bloco acima, para que uma troca de gestor
    // recusada por ciclo nunca chegue a validar indiretos contra um gestor
    // direto que não vai valer.
    //
    // Os dois valores saem do DTO, NUNCA de `data.gestorId`: o padrão
    // skip-if-unchanged só preenche `data` quando o campo MUDA, então
    // `undefined` ali significa "não mudou" e não "sem gestor". Ler `data`
    // faria um PATCH que só troca o nome calcular `gestorDiretoFinal = null`,
    // e a regra do gestor direto sumiria sem erro nenhum.
    const gestorDiretoFinal =
      dto.gestorId !== undefined
        ? (vazioParaNulo(dto.gestorId) ?? null)
        : atual.gestorId;
    const gestorDiretoMudou =
      dto.gestorId !== undefined && gestorDiretoFinal !== atual.gestorId;

    const indiretosAtuais = atual.gestoresIndiretos.map(
      (v) => v.gestorIndireto.id,
    );
    let indiretosDesejados: string[] | null = null;

    if (ehConvidado) {
      // Convidado não tem gestores indiretos, e a lista dele é esvaziada pelo
      // mesmo par de ramos dos outros campos estruturais.
      if (
        !viraConvidado &&
        dto.gestorIndiretoIds != null &&
        dto.gestorIndiretoIds.length > 0
      ) {
        throw new ConflictException(
          'Um membro convidado não tem gestores indiretos. Converta-o em membro antes de definir este campo.',
        );
      }
      if (indiretosAtuais.length > 0) indiretosDesejados = [];
    } else if (dto.gestorIndiretoIds != null) {
      indiretosDesejados = await this.resolverGestoresIndiretos(
        empresaId,
        atual.id,
        gestorDiretoFinal,
        gestorDiretoMudou,
        dto.gestorIndiretoIds,
        indiretosAtuais,
      );
    } else if (
      gestorDiretoFinal != null &&
      indiretosAtuais.includes(gestorDiretoFinal)
    ) {
      // Promover alguém que já era indireto, SEM a lista no payload. O PATCH
      // pode trazer só `gestorId`, e aí o skip-if-unchanged deixaria o vínculo
      // indireto intacto — a regra seria violada por omissão, em silêncio.
      //
      // A condição é o ESTADO FINAL, não "mudou": assim um registro que já
      // estivesse inconsistente (SQL manual, seed, versão anterior) se repara
      // no próximo save, em vez de carregar a violação para sempre.
      //
      // E a subtração é do conjunto PERSISTIDO, sem passar por
      // `resolverGestoresIndiretos`: revalidar aqui faria um registro que já
      // estoura o teto recusar PATCHes de campos sem relação com hierarquia.
      indiretosDesejados = indiretosAtuais.filter(
        (id) => id !== gestorDiretoFinal,
      );
    }

    // Desativar também é sair da estrutura: os liderados não podem ficar sem
    // gestor. `dto.reatribuirLiderados` só é considerado nesta transição —
    // fora dela é aceito e ignorado, como os campos legados area/cargo.
    let novoGestorDosLiderados: string | null = null;

    // Converter em convidado é sair da estrutura, exatamente como desativar —
    // então tem a MESMA exigência: quem lidera alguém não sai sem que a equipe
    // receba uma nova liderança. Sem isto, o organograma perderia o nó e os
    // liderados virariam raízes em silêncio, porque a árvore trata "gestor
    // ausente da lista" como topo.
    //
    // Antes do bloco de status de propósito: as duas transições podem vir no
    // mesmo PATCH, e a realocação é uma só — resolver aqui deixa o bloco
    // abaixo encontrar o valor já definido em vez de recalculá-lo.
    if (viraConvidado) {
      novoGestorDosLiderados = await this.resolverNovaLideranca(
        empresaId,
        atual,
        dto.reatribuirLiderados,
      );
    }

    if (dto.status !== undefined && dto.status !== atual.status) {
      await this.validarTransicaoDeStatus(atual, dto.status, usuarioLogadoId);
      if (
        dto.status === MembroStatus.inativo &&
        novoGestorDosLiderados == null
      ) {
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
      if (
        novoGestorDosLiderados != null ||
        rolesDesejadas != null ||
        indiretosDesejados != null ||
        viraConvidado
      ) {
        const novoGestorId = novoGestorDosLiderados;
        const roles = rolesDesejadas;
        const indiretos = indiretosDesejados;
        const converteuParaConvidado = viraConvidado;
        return await this.prisma.$transaction(async (tx) => {
          if (novoGestorId != null) {
            await this.aplicarRealocacao(tx, empresaId, atual.id, novoGestorId);
          }
          if (roles != null) {
            await this.sincronizarRoles(tx, atual.id, roles);
          }
          // Antes do update: primeiro solta o vínculo que virou redundante,
          // depois promove. Nenhuma constraint do banco liga as duas tabelas,
          // então a ordem não é exigida por integridade — mas quem acrescentar
          // um trigger amanhã não descobre a ordem errada em produção.
          if (indiretos != null) {
            await this.sincronizarGestoresIndiretos(tx, atual.id, indiretos);
          }
          // A direção INVERSA: as linhas em que ELE é o gestor indireto de
          // terceiros. `sincronizarGestoresIndiretos` não alcança essas — ele
          // só apaga `WHERE membroId = M`, que é a lista dele. Sem este
          // deleteMany, um convidado continuaria acompanhando gente na
          // hierarquia de quem ele saiu.
          //
          // Escopo por relação, e não por `empresaId`: a tabela de vínculo não
          // tem essa coluna (o Cascade de Empresa a alcança por Membro dos dois
          // lados), então o tenant se prova pelo membro.
          if (converteuParaConvidado) {
            await tx.membroGestorIndireto.deleteMany({
              where: { gestorIndiretoId: atual.id, membro: { empresaId } },
            });
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

    // Quem acabou de ser movido pode já ter `novoGestorId` como gestor
    // INDIRETO — e a realocação nunca olhou essa lista. Sem isto, sair da
    // estrutura seria um caminho para gravar a mesma pessoa nas duas relações,
    // violando a regra por uma porta que nenhuma validação cobre: nem
    // `remover` nem a desativação passam por `resolverGestoresIndiretos`.
    //
    // Fica AQUI e não em `remover` porque os dois call sites (exclusão e
    // desativação) precisam da mesma limpeza.
    //
    // O `where` navega pelo estado JÁ atualizado acima, então também repara
    // pares pré-existentes do mesmo novo gestor. Idempotente, escopado ao
    // tenant, e sem precisar dos ids — que o `updateMany` não devolve.
    await db.membroGestorIndireto.deleteMany({
      where: {
        gestorIndiretoId: novoGestorId,
        membro: { empresaId, gestorId: novoGestorId },
      },
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
   * NÃO é aqui que "ao menos uma role" é exigido: esta função normaliza e
   * valida o CONTEÚDO da lista, e a aritmética de quantas roles a lista pode
   * ter depende de qual operação está em curso — criar, converter de convidado
   * ou editar têm mensagens diferentes e, no caso da edição, uma exceção para
   * quem já estava sem nenhuma. Os três ficam nos call sites.
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
    contexto: ContextoDeTipo,
    jaAtribuidas: readonly string[] = [],
  ): Promise<string[]> {
    const roleIds = [
      ...new Set(roleIdsBrutos.map((r) => r.trim()).filter(Boolean)),
    ];

    // Convidado tem EXCLUSIVAMENTE a role Convidado, e o motivo é a aritmética
    // das roles: as permissões são a UNIÃO das roles atribuídas, então
    // "Convidado + Admin" resultaria em Admin. Somar qualquer coisa dissolveria
    // o conceito de convidado.
    if (contexto.tipo === MembroTipo.convidado) {
      const alvo = contexto.roleConvidadoId;
      if (alvo == null) {
        // Falha de programação: quem chama com tipo convidado tem de resolver a
        // role antes. Explícito para não gravar um convidado sem role nenhuma.
        throw new ConflictException(
          'A role Convidado não foi resolvida para esta organização. Recarregue e tente de novo.',
        );
      }
      if (contexto.tipoMudou) {
        // O formulário manda o payload inteiro em todo save, então uma
        // conversão ecoa as roles antigas. O campo que o cliente MUDOU é o
        // tipo; a lista é contexto. Mesma distinção de
        // `resolverGestoresIndiretos`, e pelo mesmo motivo: recusar aqui
        // transformaria toda conversão feita pela tela num 409 em que o
        // operador não errou nada.
        return [alvo];
      }
      // Já era convidado e o cliente afirmou outra lista: são duas afirmações
      // contraditórias na mesma requisição, e nenhuma delas é eco.
      if (roleIds.length > 0 && (roleIds.length !== 1 || roleIds[0] !== alvo)) {
        throw new ConflictException(
          'Um membro convidado tem exclusivamente a role Convidado. Converta-o em membro para atribuir outras roles.',
        );
      }
      return [alvo];
    }

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

    // Daqui para baixo, as duas regras que dependem das roles PROTEGIDAS da
    // organização. Uma consulta só, com no máximo duas linhas, porque as duas
    // perguntas caem no mesmo lugar:
    //
    //   - alguma role PERDIDA é a Owner?      → recusa
    //   - alguma role MANTIDA é a Convidado?  → subtrai (auto-reparo)
    //
    // Só roda quando há o que perguntar: numa criação, ou num save que apenas
    // acrescenta roles, não há consulta nenhuma.
    const perdidas = [...atuais].filter((r) => !roleIds.includes(r));
    const mantidas = roleIds.filter((r) => atuais.has(r));
    if (perdidas.length === 0 && mantidas.length === 0) return roleIds;

    const protegidas = await this.prisma.role.findMany({
      where: { empresaId, codigo: { in: [ROLE_OWNER, ROLE_CONVIDADO] } },
      select: { id: true, codigo: true },
    });
    const idOwner = protegidas.find((r) => r.codigo === ROLE_OWNER)?.id;
    const idConvidado = protegidas.find(
      (r) => r.codigo === ROLE_CONVIDADO,
    )?.id;

    // A REMOÇÃO do vínculo Owner é recusada, não só a atribuição.
    //
    // Sem isto o proprietário abre o próprio cadastro, troca de role, e a
    // sincronização apaga o vínculo Owner: a conta continua sendo a owner e a
    // aba Acesso passa a mostrar a role Owner com zero membros — os dois eixos
    // de propriedade discordando, em silêncio. Quem quer mudar de dono usa
    // "Transferir propriedade".
    if (idOwner != null && perdidas.includes(idOwner)) {
      throw new ConflictException(
        'A role Owner não pode ser removida no cadastro do membro. Use "Transferir propriedade" na aba Acesso.',
      );
    }

    // Auto-reparo: um membro COMUM não carrega a role Convidado. Ela não
    // chegaria por `exigirRoleDoTenant` — aquele método recusa —, mas ele só
    // valida ADIÇÕES, então um vínculo que já existisse (SQL manual, ou uma
    // conversão que correu com uma atribuição) atravessaria todo save em
    // silêncio. Subtrair aqui faz o dado convergir no próximo save, no mesmo
    // espírito do "a condição é o ESTADO FINAL, não mudou" dos indiretos.
    if (idConvidado != null && roleIds.includes(idConvidado)) {
      return roleIds.filter((r) => r !== idConvidado);
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

    // A role Convidado é consequência do TIPO do membro, nunca uma escolha do
    // cadastro. Recusar aqui cobre criação e edição de uma vez, porque este é o
    // único caminho por onde toda atribuição passa — mesmo argumento que pôs a
    // exclusividade da Owner neste método.
    if (role.codigo === ROLE_CONVIDADO) {
      throw new ForbiddenException(
        'A role Convidado é atribuída automaticamente aos membros do tipo convidado e não pode ser escolhida no cadastro.',
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
    await this.exigirGestoresDoTenant(empresaId, [gestorId], {
      foraDoTenant: 'O gestor escolhido não faz parte desta organização.',
      convidado:
        'Um membro convidado não pode ser gestor: convidados não participam da estrutura da organização.',
    });
  }

  /**
   * Versão em lote, com o MESMO `where` da singular — que agora delega para
   * ela, para a cláusula de tenant não existir em dois lugares.
   *
   * Uma query em vez de N. `resolverRoles` valida num laço `for` porque
   * `exigirRoleDoTenant` carrega também a regra Owner e o teto é 2; aqui o
   * único critério é o tenant, então batchar não perde regra nenhuma e evita
   * cinco round-trips por save.
   *
   * Deliberadamente NÃO checa status: gestor inativo continua gestor, e é a UI
   * que sinaliza. Vale igual para direto e indireto — preservar esse critério
   * é o que mantém as duas relações com as mesmas regras de elegibilidade.
   */
  private async exigirGestoresDoTenant(
    empresaId: string,
    ids: readonly string[],
    copy: { foraDoTenant: string; convidado: string },
  ): Promise<void> {
    if (ids.length === 0) return;
    // `findMany` e não `count`: a contagem respondia "todos são desta
    // organização?" — que continua sendo verdade —, mas não responde "algum é
    // convidado?". Como `ids` já vem deduplicado de quem chama e a unique de
    // `id` garante um registro por id, "achou menos do que pedi" continua
    // sendo exatamente "algum não é desta organização".
    const encontrados = await this.prisma.membro.findMany({
      where: { id: { in: [...ids] }, empresaId },
      select: { id: true, tipo: true },
    });
    if (encontrados.length !== ids.length) {
      throw new NotFoundException(copy.foraDoTenant);
    }

    // Convidado não é gestor de ninguém, nem direto nem indireto nem como
    // destino de realocação. A regra vive AQUI, e não em cada chamador, porque
    // este é o funil único das três — é o que mantém os critérios de
    // elegibilidade idênticos entre elas, como a ausência de checagem de status
    // logo abaixo também exige.
    if (encontrados.some((m) => m.tipo === MembroTipo.convidado)) {
      throw new ConflictException(copy.convidado);
    }
  }

  /**
   * Normaliza e valida a lista de gestores indiretos, devolvendo o conjunto a
   * gravar. Espelha `resolverRoles`: dedupe antes de contar, teto real aqui, e
   * validação só das ADIÇÕES.
   *
   * `membroId` é null na criação — o membro ainda não tem id, logo não há como
   * auto-associar (mesmo argumento que dispensa a checagem de ciclo do gestor
   * direto em `criar`).
   *
   * `gestorDiretoFinal` é o gestor direto DEPOIS desta operação, nunca
   * `atual.gestorId`: é ele que decide a regra do gestor direto.
   *
   * `gestorDiretoMudou` decide entre recusar e subtrair, e a distinção é
   * necessária porque o formulário manda o payload INTEIRO em todo save:
   *
   *   - o gestor direto NÃO mudou e a lista o contém → o cliente afirmou os
   *     dois valores na mesma requisição e eles se contradizem. 409.
   *   - o gestor direto MUDOU → o campo alterado é a afirmação, a lista é
   *     contexto que o cliente apenas ecoou. Subtrai em silêncio, que é a
   *     única resolução correta: o vínculo indireto virou redundante.
   *
   * Sem essa distinção, trocar o gestor direto na tela viraria 409 num fluxo
   * em que o operador não errou nada — e a API passaria a depender de o
   * cliente filtrar a lista para funcionar.
   *
   * Ciclo NÃO é validado, de propósito: um par A→B e B→A é permitido e inerte,
   * porque nada caminha por esta tabela. A árvore é montada só por `gestorId`
   * (ver `estaAbaixoDe`), e é essa separação que torna a relação indireta
   * incapaz de mudar posição hierárquica. Quem "melhorar" `estaAbaixoDe` para
   * incluir indiretos torna esta decisão letra morta.
   */
  private async resolverGestoresIndiretos(
    empresaId: string,
    membroId: string | null,
    gestorDiretoFinal: string | null,
    gestorDiretoMudou: boolean,
    idsBrutos: string[],
    jaAtribuidos: readonly string[] = [],
  ): Promise<string[]> {
    let ids = [...new Set(idsBrutos.map((g) => g.trim()).filter(Boolean))];

    if (membroId != null && ids.includes(membroId)) {
      throw new ConflictException(
        'Um membro não pode ser gestor indireto de si mesmo.',
      );
    }

    if (gestorDiretoFinal != null && ids.includes(gestorDiretoFinal)) {
      if (gestorDiretoMudou) {
        ids = ids.filter((id) => id !== gestorDiretoFinal);
      } else {
        throw new ConflictException(
          'O gestor direto não pode ser também um gestor indireto. Escolha outra pessoa ou troque o gestor direto.',
        );
      }
    }

    // Depois do dedupe e da subtração: é este o teto real. O
    // `@ArrayMaxSize` do DTO é a primeira barreira e conta ids repetidos.
    if (ids.length > MAX_GESTORES_INDIRETOS) {
      throw new BadRequestException(
        `Um membro pode ter no máximo ${MAX_GESTORES_INDIRETOS} gestores indiretos.`,
      );
    }

    // Só as adições, como em `resolverRoles` — mas por um motivo mais modesto:
    // aqui a única forma de um indireto ficar inválido é sair da organização, e
    // nesse caso o Cascade já apagou a linha. O ganho é não gastar query quando
    // a lista não mudou.
    const atuais = new Set(jaAtribuidos);
    const adicionados = ids.filter((id) => !atuais.has(id));
    await this.exigirGestoresDoTenant(empresaId, adicionados, {
      foraDoTenant:
        'Um dos gestores indiretos escolhidos não faz parte desta organização.',
      convidado:
        'Um dos gestores indiretos escolhidos é um membro convidado: convidados não participam da estrutura da organização.',
    });

    return ids;
  }

  /**
   * Aplica o conjunto de gestores indiretos dentro de uma transação.
   *
   * Cópia estrutural de `sincronizarRoles`: remove quem saiu e cria quem
   * entrou, em vez de apagar tudo e recriar — preserva o `criadoEm` de quem
   * continua e não gera escrita para uma edição que não mexeu na lista.
   */
  private async sincronizarGestoresIndiretos(
    db: Prisma.TransactionClient,
    membroId: string,
    gestorIndiretoIds: readonly string[],
  ): Promise<void> {
    const atuais = await db.membroGestorIndireto.findMany({
      where: { membroId },
      select: { gestorIndiretoId: true },
    });
    const atual = new Set(atuais.map((v) => v.gestorIndiretoId));
    const desejado = new Set(gestorIndiretoIds);

    const remover = [...atual].filter((g) => !desejado.has(g));
    const adicionar = [...desejado].filter((g) => !atual.has(g));

    if (remover.length > 0) {
      await db.membroGestorIndireto.deleteMany({
        where: { membroId, gestorIndiretoId: { in: remover } },
      });
    }
    if (adicionar.length > 0) {
      await db.membroGestorIndireto.createMany({
        data: adicionar.map((gestorIndiretoId) => ({
          membroId,
          gestorIndiretoId,
        })),
        skipDuplicates: true,
      });
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
