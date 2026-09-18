/**
 * Catálogo de permissões da plataforma.
 *
 * Cada permissão corresponde a uma funcionalidade que EXISTE hoje no protótipo.
 * Deliberadamente não há permissão para:
 *   • Notas, Insights, E-mail, Slack, Agenda — desligados por feature flag
 *     (ver ts/demo/src/app/data/temporarilyDisabledFeatures.ts).
 * Criar permissão para o que não existe daria a impressão de controle que a
 * plataforma não tem. Quando essas funcionalidades entrarem, acrescente aqui.
 *
 * O rótulo de cada item é duplicado em ts/demo/src/app/data/permissoes.ts, que
 * é o que a interface consome — mesma convenção do catálogo de conectores
 * (src/conectores/catalog.ts + app/data/conectores.ts). Este arquivo é a
 * autoridade de VALIDAÇÃO; o do front é a autoridade de TEXTO. Ao mexer em um,
 * mexa no outro.
 */

/** Ação de uma permissão. Só separamos o que faz sentido para o recurso. */
export interface Permissao {
  /** Código persistido em `roles.permissoes`. Estável — não renomear. */
  code: string;
  rotulo: string;
  /**
   * Permissão da qual esta depende. Editar algo exige poder visualizá-lo, então
   * o service normaliza o conjunto salvo incluindo as dependências — o que é
   * gravado nunca fica incoerente, independente do que o cliente enviou.
   */
  requer?: string;
}

export interface GrupoPermissoes {
  /** Prefixo dos códigos do grupo. */
  id: string;
  titulo: string;
  permissoes: Permissao[];
}

export const GRUPOS_PERMISSOES: GrupoPermissoes[] = [
  {
    id: 'membros',
    titulo: 'Membros',
    permissoes: [
      { code: 'membros.visualizar', rotulo: 'Visualizar colaboradores' },
      {
        code: 'membros.criar',
        rotulo: 'Adicionar colaboradores',
        requer: 'membros.visualizar',
      },
      {
        code: 'membros.editar',
        rotulo: 'Editar colaboradores',
        requer: 'membros.visualizar',
      },
      {
        code: 'membros.desativar',
        rotulo: 'Desativar colaboradores',
        requer: 'membros.visualizar',
      },
    ],
  },
  {
    id: 'estrutura',
    titulo: 'Estrutura',
    permissoes: [
      { code: 'estrutura.visualizar', rotulo: 'Visualizar estrutura' },
      {
        code: 'estrutura.gerenciar',
        // O código é o valor persistido em `roles.permissoes` e não muda; o
        // rótulo passou a cobrir Áreas e Cargos, que agora são entidades
        // administráveis. A hierarquia em si é editada pelo campo Gestor
        // direto do membro, ou seja, por `membros.editar`.
        rotulo: 'Gerenciar áreas e cargos',
        requer: 'estrutura.visualizar',
      },
    ],
  },
  {
    id: 'acesso',
    titulo: 'Acesso',
    permissoes: [
      { code: 'acesso.visualizar', rotulo: 'Visualizar roles' },
      {
        code: 'acesso.gerenciar',
        rotulo: 'Gerenciar roles e permissões',
        requer: 'acesso.visualizar',
      },
    ],
  },
  {
    id: 'repositorio',
    titulo: 'Repositório',
    permissoes: [
      { code: 'repositorio.visualizar', rotulo: 'Visualizar repositório' },
      {
        code: 'repositorio.sincronizar',
        rotulo: 'Sincronizar repositório',
        requer: 'repositorio.visualizar',
      },
    ],
  },
  {
    id: 'grafo',
    titulo: 'Grafo',
    permissoes: [{ code: 'grafo.visualizar', rotulo: 'Visualizar grafo' }],
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    permissoes: [
      { code: 'documentos.visualizar', rotulo: 'Visualizar documentos' },
      {
        code: 'documentos.enviar',
        rotulo: 'Enviar documentos',
        requer: 'documentos.visualizar',
      },
      {
        code: 'documentos.excluir',
        rotulo: 'Excluir documentos',
        requer: 'documentos.visualizar',
      },
    ],
  },
  {
    id: 'ia',
    titulo: 'IA e Chat',
    permissoes: [
      { code: 'ia.usar', rotulo: 'Conversar com a IA' },
      {
        code: 'ia.criar_conteudo',
        rotulo: 'Gerar conteúdo com IA',
        requer: 'ia.usar',
      },
    ],
  },
  {
    id: 'conectores',
    titulo: 'Conectores',
    permissoes: [
      { code: 'conectores.visualizar', rotulo: 'Visualizar conectores' },
      {
        code: 'conectores.configurar',
        rotulo: 'Configurar conectores',
        requer: 'conectores.visualizar',
      },
    ],
  },
  {
    id: 'configuracoes',
    titulo: 'Configurações',
    permissoes: [
      { code: 'configuracoes.visualizar', rotulo: 'Visualizar configurações' },
      {
        code: 'configuracoes.gerenciar',
        // O 'code' é o valor persistido em 'roles.permissoes' e não muda; o
        // rótulo passou a cobrir também os guias de marca, que agora são
        // entidades da organização administradas em Configurações › Geral ›
        // Aparência. Mesmo movimento já feito em 'estrutura.gerenciar'.
        rotulo: 'Gerenciar configurações, chaves de IA e guias de marca',
        requer: 'configuracoes.visualizar',
      },
    ],
  },
];

/** Todos os códigos válidos. */
export const PERMISSOES_VALIDAS: readonly string[] = GRUPOS_PERMISSOES.flatMap(
  (g) => g.permissoes.map((p) => p.code),
);

const REQUER_POR_CODE = new Map(
  GRUPOS_PERMISSOES.flatMap((g) => g.permissoes).map((p) => [p.code, p.requer]),
);

/**
 * Normaliza um conjunto de permissões: descarta código desconhecido, acrescenta
 * as dependências e devolve na ordem do catálogo.
 *
 * É o que garante a coerência do que é gravado — "editar sem visualizar" não
 * existe no banco, mesmo que alguém chame a API direto.
 */
export function normalizarPermissoes(codes: string[]): string[] {
  const conjunto = new Set<string>();
  for (const code of codes) {
    if (!REQUER_POR_CODE.has(code)) continue;
    conjunto.add(code);
    // Cadeia de dependências (hoje só um nível, mas o laço não assume isso).
    let requer = REQUER_POR_CODE.get(code);
    while (requer) {
      conjunto.add(requer);
      requer = REQUER_POR_CODE.get(requer);
    }
  }
  return PERMISSOES_VALIDAS.filter((code) => conjunto.has(code));
}

// ----------------------------------------------------------------------
// Roles de sistema.
//
// Existem em toda organização, servem de ponto de partida e são IMUTÁVEIS:
// não podem ser editadas nem excluídas. Isso é o que garante que a
// organização nunca fique sem uma role com acesso administrativo completo.
// ----------------------------------------------------------------------

export interface RoleDeSistema {
  /** Chave estável. Persistida em `roles.codigo`. */
  codigo: string;
  nome: string;
  descricao: string;
  permissoes: string[];
}

const TODAS = [...PERMISSOES_VALIDAS];

const SOMENTE_VISUALIZAR = PERMISSOES_VALIDAS.filter((c) =>
  c.endsWith('.visualizar'),
);

/**
 * Código da role do responsável pela conta. Exportado porque a exclusividade é
 * verificada fora daqui (ver `MembrosService`): só o membro vinculado ao
 * `Usuario` com `role = 'owner'` pode carregá-la.
 */
export const ROLE_OWNER = 'owner';

/**
 * Código da role do membro CONVIDADO. Exportado pelo mesmo motivo de
 * `ROLE_OWNER`: a exclusividade é verificada fora daqui — um membro de tipo
 * `convidado` tem esta role e só ela, e um membro comum não pode recebê-la.
 *
 * As duas são as roles protegidas do sistema, e a checagem é sempre por
 * CÓDIGO, nunca por nome: um rename ou um dado legado não dissolve a regra.
 */
export const ROLE_CONVIDADO = 'convidado';

export const ROLES_DE_SISTEMA: RoleDeSistema[] = [
  {
    // Primeira da lista de propósito: é o topo do acesso e é assim que aparece
    // na tela de Acesso, que preserva a ordem do catálogo.
    //
    // Tem as MESMAS permissões de Admin, e não uma a mais: o catálogo não tem
    // nada acima de "todas". O que a distingue não é o alcance, é a
    // EXCLUSIVIDADE — pertence à conta que criou a organização e não pode ser
    // atribuída a mais ninguém. Por isso não substitui Admin: Admin continua
    // sendo a role administrativa que se dá a outras pessoas.
    codigo: ROLE_OWNER,
    nome: 'Owner',
    descricao:
      'Responsável pela conta que criou a organização. Acesso total e exclusivo: não pode ser atribuída a outro colaborador.',
    permissoes: TODAS,
  },
  {
    codigo: 'admin',
    nome: 'Admin',
    descricao:
      'Acesso administrativo amplo: gerencia colaboradores, estrutura, roles e as configurações da organização.',
    permissoes: TODAS,
  },
  {
    codigo: 'editor',
    nome: 'Editor',
    descricao:
      'Usa e alimenta os recursos do dia a dia — repositório, documentos e IA — sem acesso às configurações administrativas.',
    permissoes: normalizarPermissoes([
      'membros.visualizar',
      'estrutura.visualizar',
      'acesso.visualizar',
      'repositorio.sincronizar',
      'grafo.visualizar',
      'documentos.enviar',
      'ia.criar_conteudo',
      'conectores.visualizar',
      'configuracoes.visualizar',
    ]),
  },
  {
    codigo: 'viewer',
    nome: 'Viewer',
    descricao:
      'Consulta o que já existe na organização e conversa com a IA, sem alterar nada.',
    permissoes: normalizarPermissoes([...SOMENTE_VISUALIZAR, 'ia.usar']),
  },
  {
    // Última da lista: é o menor acesso, e a tela de Acesso preserva esta
    // ordem. Atribuída AUTOMATICAMENTE quando o membro é do tipo convidado, e
    // recusada para qualquer outro (ver `exigirRoleDoTenant`).
    //
    // UMA permissão, e a escolha exige honestidade sobre o que ela protege:
    //
    // Não existe escopo de dados nesta versão — a Role não tem coluna de
    // escopo, não há model de Repositório, e o repositório ativo vem de um
    // header que o cliente envia e que ninguém confere. Além disso, só 6 dos
    // 35 controllers passam pelo `PermissoesGuard`: os de `ai/` e o do vault
    // NÃO passam.
    //
    // Consequência: enquanto isso for verdade, `ia.usar` alcança o mesmo
    // conteúdo que `repositorio.visualizar` alcançaria, porque os endpoints de
    // IA leem o vault sem checar permissão nenhuma. A ausência de
    // `repositorio.visualizar`, `documentos.visualizar` e `grafo.visualizar`
    // aqui é uma DECLARAÇÃO DE INTENÇÃO, não um controle em vigor — no dia em
    // que `ai/*` for guardado, esta é a permissão que o convidado precisa ter,
    // e aquelas são as que ele precisa NÃO ter.
    //
    // O que a role entrega de verdade hoje: nenhuma escrita administrativa nas
    // 16 rotas guardadas (membros, áreas, cargos, roles, convites, chaves MCP).
    // O que ela NÃO entrega: confinamento de leitura.
    codigo: ROLE_CONVIDADO,
    nome: 'Convidado',
    descricao:
      'Acesso pontual à plataforma, sem participação na organização: sem área, sem cargo, sem posição na hierarquia e sem qualquer permissão de administração.',
    permissoes: normalizarPermissoes(['ia.usar']),
  },
];

/** As roles de sistema que nenhum administrador pode editar ou excluir. */
export const CODIGOS_DE_ROLE_PROTEGIDA: ReadonlySet<string> = new Set([
  ROLE_OWNER,
  ROLE_CONVIDADO,
]);

/**
 * Teto de roles por membro.
 *
 * Vive neste módulo, e não num service, porque `MembrosService` (que valida a
 * atribuição), `RolesService` (que valida a transferência de propriedade) e os
 * seeds precisam do MESMO número. É o único arquivo desta área sem imports,
 * então nenhum deles cria dependência ao usá-lo.
 *
 * Não é constraint de banco de propósito: a única forma declarativa seria uma
 * coluna de slot com `@@unique([membroId, slot])`, que é exatamente o conceito
 * de role principal/secundária que o modelo recusa. Ver o comentário de
 * `model MembroRole` no schema.
 */
export const MAX_ROLES_POR_MEMBRO = 2;

/**
 * Chave de comparação de nome de role: `trim` + caixa baixa.
 *
 * A unique `@@unique([empresaId, nome])` é case-sensitive no Postgres, então
 * sem normalizar "Suporte" e "suporte" convivem na mesma organização — e a
 * listagem, que ordena por nome, mostra duas roles que quem administra não
 * distingue. Mesma relação entre unique e normalização já documentada em
 * `Membro.email`.
 */
export function chaveDeNomeDeRole(nome: string): string {
  return nome.trim().toLowerCase();
}

/**
 * Nomes que uma role personalizada NÃO pode usar.
 *
 * Só a Owner: Admin, Editor e Viewer passaram a ser administráveis como
 * qualquer outra role, e reservar os nomes delas contradiria isso.
 *
 * Entram o NOME e o CÓDIGO, os dois. `garantirRolesDeSistema` resolve o upsert
 * por (empresaId, codigo) mas colide em (empresaId, nome): uma personalizada
 * chamada "owner" não colide com "Owner" (a unique é case-sensitive), mas uma
 * chamada "Owner" derruba o upsert com P2002 — e como a Owner é o primeiro item
 * do catálogo, o throw acontece antes de qualquer outra coisa ser criada.
 *
 * Derivado de `ROLES_DE_SISTEMA`, nunca escrito à mão.
 */
export const NOMES_DE_ROLE_RESERVADOS: ReadonlySet<string> = new Set(
  ROLES_DE_SISTEMA.filter((r) => CODIGOS_DE_ROLE_PROTEGIDA.has(r.codigo))
    .flatMap((r) => [r.nome, r.codigo])
    .map(chaveDeNomeDeRole),
);
