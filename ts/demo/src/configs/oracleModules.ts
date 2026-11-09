/**
 * Módulos visíveis do Oracle — configuração CENTRAL de produto.
 *
 * O Oracle é um sistema de inteligência pessoal com um único dono. O código
 * herdado do BeCulture (plataforma corporativa multi-tenant) traz módulos que
 * não fazem sentido nesse contexto: organizações, colaboradores, estrutura
 * organizacional, roles e os produtos de RH. Eles NÃO foram removidos — rotas,
 * componentes, APIs e dados seguem intactos. Este arquivo só decide o que
 * aparece.
 *
 * Para reativar um módulo, troque o valor dele para `true`. Nenhuma outra
 * mudança é necessária: cada ponto de corte lê daqui.
 *
 * Relação com `app/data/temporarilyDisabledFeatures.ts`: aquele arquivo tem as
 * flags FINAS de funcionalidade (um botão, uma aba, uma seção opaca). Este é a
 * camada de PRODUTO, acima dele: o que o Oracle pessoal oferece.
 *
 * Oculto aqui = some da interface (menus, seções, atalhos) e o link direto cai
 * num lugar válido. Não é o padrão "opaco" das flags temporárias, porque estes
 * módulos não são novidades por vir: são outro contexto de uso.
 */

export type OracleModule =
  /**
   * Organizações: o bloco "Organizações" (trocar e excluir) e "Criar
   * organização" no menu de perfil, e o seletor "Uso pessoal / Empresa ou
   * equipe" do cadastro (o cadastro passa a ser sempre pessoal).
   * Cortes: `components/template/ProfileMenu.tsx`,
   * `app/pages/prototypes/contas/screens/ConfigurarOrganizacao.tsx`.
   * A organização interna criada no cadastro continua existindo: é o escopo
   * técnico dos dados do dono.
   */
  | "organizations"
  /**
   * Estrutura organizacional: Configurações › Estrutura (Colaboradores, Áreas,
   * Cargos, Hierarquia), com convites, gestores, realocação e organograma que
   * vivem dentro dessas seções.
   * Corte: `app/pages/ceo/configuracoes-secoes.ts` (`SECOES_POR_MODULO`).
   */
  | "orgStructure"
  /**
   * Papéis e permissões: Configurações › Acesso (Roles, matriz de permissões,
   * Owner/Admin e transferência de propriedade). A autenticação e os gates de
   * permissão do backend continuam valendo; o dono é owner e passa em todos.
   * Corte: `app/pages/ceo/configuracoes-secoes.ts` (`SECOES_POR_MODULO`).
   */
  | "rolesPermissions"
  /**
   * Produtos de RH e gestão de pessoas no seletor de produto: Learning (LMS),
   * Performance (1:1, ciclos, 360°, PDI, elogios/reconhecimento, metas),
   * Project Management e Hiring.
   * Cortes: `Sidebar/ProductSwitcher.tsx` e `middleware/OracleModuleGuard.tsx`.
   */
  | "hrProducts"
  /**
   * Áreas de sistema corporativas acessíveis por URL: organograma, pesquisas
   * (clima/pulso), feed corporativo e relatórios organizacionais.
   * Corte: `middleware/OracleModuleGuard.tsx`.
   */
  | "corporateAreas"
  /**
   * Conectores corporativos de RH e folha (categoria "RH & Folha" do
   * catálogo: Oracle HCM, Gupy etc.). Os demais conectores seguem iguais.
   * Corte: `app/pages/ceo/Conectores.tsx`.
   */
  | "corporateConnectors"
  /**
   * Slack: o item "Slack" do Painel no menu lateral, a tela /oracle/slack e o
   * conector Slack em Conectores. A integração (OAuth, API, ferramentas MCP)
   * segue intacta no código e no backend.
   * Cortes: `Sidebar/Menu/Group/index.tsx`, `app/pages/ceo/Conectores.tsx` e
   * `middleware/OracleModuleGuard.tsx`.
   */
  | "slack";

export const ORACLE_MODULES: Record<OracleModule, boolean> = {
  organizations: false,
  orgStructure: false,
  rolesPermissions: false,
  hrProducts: false,
  corporateAreas: false,
  corporateConnectors: false,
  slack: false,
};

export function isOracleModuleVisible(modulo: OracleModule): boolean {
  return ORACLE_MODULES[modulo];
}

// ----------------------------------------------------------------------
// Mapas derivados — a fonte única que cada ponto de corte consulta.

/** Produtos do seletor que pertencem ao módulo `hrProducts`. */
export const HR_PRODUCT_CODES: readonly string[] = [
  "learning",
  "performance",
  "project-management",
  "hiring",
];

/** Áreas de sistema (`/:produto/<area>`) do módulo `corporateAreas`. */
export const CORPORATE_SYSTEM_AREAS: readonly string[] = [
  "organograma",
  "pesquisas",
  "feed",
  "relatorios",
];

/** Seções de Configurações que pertencem a um módulo do Oracle. */
export const SECOES_POR_MODULO: Readonly<Record<string, OracleModule>> = {
  membros: "orgStructure",
  areas: "orgStructure",
  cargos: "orgStructure",
  hierarquia: "orgStructure",
  acesso: "rolesPermissions",
};

/** Categorias do catálogo de conectores do módulo `corporateConnectors`. */
export const CORPORATE_CONNECTOR_CATEGORIES: readonly string[] = ["rh"];

/**
 * Itens do menu lateral (último segmento do caminho, ex.: `/oracle/slack`)
 * que pertencem a um módulo. Também valem como área de sistema para o guard.
 */
export const NAV_SLUGS_POR_MODULO: Readonly<Record<string, OracleModule>> = {
  slack: "slack",
};

/** Conectores individuais (id do catálogo) que pertencem a um módulo. */
export const CONECTORES_POR_MODULO: Readonly<Record<string, OracleModule>> = {
  slack: "slack",
};

/**
 * Agentes do sistema visíveis no Oracle (catálogo pré-programado, antigos
 * squads): especialistas úteis no contexto pessoal. Os de RH, cultura
 * organizacional, comunicação interna, vendas e processos ficam ocultos —
 * continuam no banco, e conversas antigas seguem identificadas. Lida por
 * `app/data/agentesVisiveis.ts`; com `null`, todos aparecem.
 */
export const AGENTES_SISTEMA_VISIVEIS: readonly string[] | null = [
  "bp.dados",
  "bp.financeiro",
  "bp.marketing",
  "bp.produto",
  "bp.redes-sociais",
  "bp.juridico",
  "bp.conselho",
];

/** Produto visível no seletor de produto? */
export function isProductVisible(code: string): boolean {
  return !HR_PRODUCT_CODES.includes(code) || isOracleModuleVisible("hrProducts");
}

/** A seção de Configurações está oculta por um módulo do Oracle? */
export function isSecaoHiddenByOracle(secaoId: string): boolean {
  const modulo = SECOES_POR_MODULO[secaoId];
  return modulo != null && !isOracleModuleVisible(modulo);
}

/** A categoria de conector está oculta por um módulo do Oracle? */
export function isConnectorCategoryHiddenByOracle(categoria: string): boolean {
  return (
    CORPORATE_CONNECTOR_CATEGORIES.includes(categoria) &&
    !isOracleModuleVisible("corporateConnectors")
  );
}

/** O conector (id do catálogo) está oculto por um módulo do Oracle? */
export function isConnectorHiddenByOracle(id: string): boolean {
  const modulo = CONECTORES_POR_MODULO[id];
  return modulo != null && !isOracleModuleVisible(modulo);
}

/** O item do menu lateral está oculto por um módulo do Oracle? */
export function isNavItemHiddenByOracle(path: string | undefined): boolean {
  if (!path) return false;
  const slug = path.split("?")[0].split("/").filter(Boolean).pop() ?? "";
  const modulo = NAV_SLUGS_POR_MODULO[slug];
  return modulo != null && !isOracleModuleVisible(modulo);
}

/**
 * O caminho leva a um módulo oculto? Usado pelo `OracleModuleGuard` para que
 * links diretos e favoritos não exponham o que a navegação esconde.
 */
export function isPathHiddenByOracle(pathname: string): boolean {
  const [produto, area] = pathname.split("/").filter(Boolean);
  if (!produto) return false;
  if (!isProductVisible(produto)) return true;
  if (
    area != null &&
    CORPORATE_SYSTEM_AREAS.includes(area) &&
    !isOracleModuleVisible("corporateAreas")
  ) {
    return true;
  }
  const moduloDaArea = area != null ? NAV_SLUGS_POR_MODULO[area] : undefined;
  if (moduloDaArea != null && !isOracleModuleVisible(moduloDaArea)) {
    return true;
  }
  return false;
}

/** Para onde vai um link para módulo oculto. */
export const ORACLE_HOME_PATH = "/oracle";
