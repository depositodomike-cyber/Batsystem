/**
 * Modelo do protótipo do novo modelo de contas.
 *
 * Sistema ÚNICO para contas B2C e B2B: a diferença é só lógica de cobrança e
 * NUNCA aparece como escolha para o usuário. Ver `regras.ts`.
 *
 * Diferenças propositais em relação ao modelo atual (`@/app/contexts/companies`):
 *
 * - `Usuario.empresaId` (1:1) é substituído por `Membro` (N:N com papel), para
 *   que um usuário possa pertencer a várias organizações com papel diferente
 *   em cada uma.
 * - `Empresa` (que mistura tenant + pagador + plano) é separada em
 *   `Organizacao` + `Pagador`.
 * - `Repositorio` é conceito novo: 1 organização → N repositórios.
 */

export type PapelNaOrganizacao = "admin" | "usuario";

export type TipoPagador = "pf" | "pj";

export type ClassificacaoCobranca = "b2c" | "b2b";

/**
 * O PAGADOR é um dado separado do usuário: pessoa física (CPF) ou jurídica
 * (CNPJ). Quem paga não é necessariamente quem usa.
 */
export interface Pagador {
  id: string;
  tipo: TipoPagador;
  /** CPF ou CNPJ, com máscara. */
  documento: string;
  /** Nome do titular (pf) ou razão social (pj). */
  nomeLegal: string;
}

/** A ORGANIZAÇÃO é a entidade central: container de repositórios e membros. */
export interface Organizacao {
  id: string;
  nome: string;
  /** Referência, não embutido — o pagador é entidade própria. */
  pagadorId: string;
  criadoEm: string;
}

export interface UsuarioProto {
  id: string;
  nome: string;
  email: string;
  /**
   * Senha em texto puro. É um protótipo de front-end sem backend: não há hash
   * nem sessão de verdade, e guardar a senha é o que permite o login validar o
   * que foi digitado em vez de aceitar qualquer coisa. Nunca replique isto no
   * produto.
   */
  senha: string;
  criadoEm: string;
  // NÃO existe organizacaoId aqui: o vínculo vive em `Membro`.
}

/**
 * Vínculo usuário ↔ organização COM papel. É esta entidade que permite o mesmo
 * usuário ser admin numa organização e usuário comum em outra.
 */
export interface Membro {
  id: string;
  usuarioId: string;
  organizacaoId: string;
  papel: PapelNaOrganizacao;
  criadoEm: string;
}

/**
 * União discriminada: torna impossível, no tipo, um repositório pertencer a uma
 * organização E a uma pessoa ao mesmo tempo.
 */
export type EscopoRepositorio =
  | { tipo: "pessoal"; usuarioId: string }
  | { tipo: "organizacao"; organizacaoId: string };

/**
 * O REPOSITÓRIO é a junção de tudo que compõe a ferramenta — o container de
 * escopo completo. Uma organização tem N repositórios, e repositórios de
 * organizações diferentes NÃO conversam entre si (ver `selectors.ts`).
 */
export interface Repositorio {
  id: string;
  nome: string;
  escopo: EscopoRepositorio;
  criadoEm: string;
}

export interface ItemMemoria {
  id: string;
  titulo: string;
  origem: string;
  criadoEm: string;
}

export interface Agrupamento {
  id: string;
  nome: string;
  itens: number;
}

export interface Insight {
  id: string;
  titulo: string;
}

/** Conteúdo de UM repositório. Sempre indexado por `repositorioId`. */
export interface ConteudoRepositorio {
  memoria: ItemMemoria[];
  agrupamentos: Agrupamento[];
  insights: Insight[];
}

export type ConviteStatus = "pendente" | "aceito";

export interface ConviteProto {
  id: string;
  organizacaoId: string;
  email: string;
  papel: PapelNaOrganizacao;
  status: ConviteStatus;
  criadoEm: string;
}

/**
 * Contexto ativo: UM único repositório aberto por sessão.
 *
 * É objeto (ou null), nunca array — o invariante "nunca dois repositórios
 * abertos ao mesmo tempo" está na FORMA do estado, não em código defensivo.
 */
export interface ContextoAtivo {
  repositorioId: string;
}

export interface EstadoPrototipo {
  versao: 8;
  usuarios: UsuarioProto[];
  organizacoes: Organizacao[];
  pagadores: Pagador[];
  membros: Membro[];
  repositorios: Repositorio[];
  /**
   * Chave = repositorioId. NUNCA organizacaoId: não existe consulta de conteúdo
   * por organização, logo não existe vazamento entre repositórios.
   */
  conteudo: Record<string, ConteudoRepositorio>;
  convites: ConviteProto[];
  sessao: { usuarioId: string } | null;
  contexto: ContextoAtivo | null;
  /** Slice EXCLUSIVO da demonstração — fora das regras de negócio. */
  demo: { papelForcado: PapelNaOrganizacao | null };
}
