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
      { code: 'membros.visualizar', rotulo: 'Visualizar membros' },
      {
        code: 'membros.criar',
        rotulo: 'Adicionar membros',
        requer: 'membros.visualizar',
      },
      {
        code: 'membros.editar',
        rotulo: 'Editar membros',
        requer: 'membros.visualizar',
      },
      {
        code: 'membros.desativar',
        rotulo: 'Desativar membros',
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
        rotulo: 'Gerenciar configurações e chaves de IA',
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
      'Responsável pela conta que criou a organização. Acesso total e exclusivo: não pode ser atribuída a outro membro.',
    permissoes: TODAS,
  },
  {
    codigo: 'admin',
    nome: 'Admin',
    descricao:
      'Acesso administrativo amplo: gerencia membros, estrutura, roles e as configurações da organização.',
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
];
