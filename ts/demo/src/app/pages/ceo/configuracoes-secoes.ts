// Import Dependencies
import {
  BookOpenIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CircleStackIcon,
  CpuChipIcon,
  KeyIcon,
  ShareIcon,
  SpeakerWaveIcon,
  SwatchIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import {
  isFeatureTemporarilyDisabled,
  type TemporarilyDisabledFeature,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// As seções de Configurações, agrupadas — fonte única do menu e do painel.
//
// Existe um arquivo próprio (precedente na mesma pasta: `estrutura-copy.ts`,
// `membros-status.ts`) porque a MESMA lista alimenta dois consumidores: a
// navegação lateral e o despacho do corpo. Com a lista dentro da página, os
// dois divergiam na primeira seção nova.
//
// Antes desta versão havia duas telas irmãs — Configurações e Administração —
// com a navegação lateral copiada literalmente e nenhuma das duas suportando
// grupo. Administração deixou de ser uma área: os itens dela vivem aqui, e o
// que era a sub-aba `?aba=` de Estrutura (Áreas, Cargos, Hierarquia) virou item
// de primeiro nível, com o rótulo do GRUPO carregando o nível que a sub-aba
// carregava.
// ----------------------------------------------------------------------

/**
 * Grupos, na ordem em que aparecem.
 *
 * Geral antes do específico. Os rótulos são apenas organização visual: não são
 * páginas, não têm rota, não são clicáveis e não abrem nem fecham nada.
 */
export const GRUPOS = [
  { id: "geral", titulo: "Geral" },
  { id: "ia", titulo: "IA" },
  { id: "estrutura", titulo: "Estrutura" },
  { id: "acesso", titulo: "Acesso" },
] as const;

export type GrupoId = (typeof GRUPOS)[number]["id"];

/**
 * A forma de uma seção — usada só para conferir a lista abaixo com
 * `satisfies`. O tipo que circula pelo app é `Secao`, derivado da lista, e é
 * ele que mantém `id` como união de literais em vez de `string`.
 */
interface FormaDaSecao {
  id: string;
  grupo: GrupoId;
  titulo: string;
  icon: typeof UsersIcon;
  /** Flag que torna a seção visível-mas-inacessível. Null = sempre acessível. */
  feature: TemporarilyDisabledFeature | null;
}

/**
 * As seções. A ordem DENTRO de cada grupo é a de leitura, não alfabética: em
 * Estrutura vai do que se administra todo dia (Membros) para a visualização das
 * relações (Hierarquia).
 *
 * Os ids `membros` e `acesso` são os mesmos de quando Administração era uma
 * tela — de propósito, para os redirects de URLs antigas continuarem valendo
 * trocando só uma palavra.
 */
export const SECOES = [
  // ------------------------------------------------------------ Geral
  {
    id: "aparencia",
    grupo: "geral",
    titulo: "Aparência",
    icon: SwatchIcon,
    feature: "settingsAppearance",
  },
  {
    id: "voz",
    grupo: "geral",
    titulo: "Voz",
    icon: SpeakerWaveIcon,
    feature: "settingsVoice",
  },
  {
    id: "memoria",
    grupo: "geral",
    titulo: "Repositório",
    icon: CircleStackIcon,
    feature: "settingsMemory",
  },
  // --------------------------------------------------------------- IA
  // Regras fica AQUI, e não em Geral: são as orientações que a IA segue em toda
  // resposta, e a própria tela mede o custo delas em tokens de contexto. "IA &
  // API" é a plumbing de credenciais e prioridade de modelos — as duas metades
  // da mesma pergunta, "como a IA se comporta".
  {
    id: "regras",
    grupo: "ia",
    titulo: "Regras",
    icon: BookOpenIcon,
    feature: null,
  },
  {
    id: "ia",
    grupo: "ia",
    titulo: "IA & API",
    icon: CpuChipIcon,
    feature: null,
  },
  // -------------------------------------------------------- Estrutura
  {
    id: "membros",
    grupo: "estrutura",
    titulo: "Membros",
    icon: UsersIcon,
    feature: null,
  },
  {
    id: "areas",
    grupo: "estrutura",
    titulo: "Áreas",
    icon: BuildingOffice2Icon,
    feature: null,
  },
  {
    id: "cargos",
    grupo: "estrutura",
    titulo: "Cargos",
    icon: BriefcaseIcon,
    feature: null,
  },
  {
    id: "hierarquia",
    grupo: "estrutura",
    titulo: "Hierarquia",
    icon: ShareIcon,
    feature: null,
  },
  // ----------------------------------------------------------- Acesso
  // "Roles" e não "Acessos": um item que repete o nome do próprio grupo é
  // ruído, e Roles é o que a tela administra.
  {
    id: "acesso",
    grupo: "acesso",
    titulo: "Roles",
    icon: KeyIcon,
    feature: null,
  },
] as const satisfies readonly FormaDaSecao[];

export type Secao = (typeof SECOES)[number];
export type SecaoId = Secao["id"];

/**
 * Seção em que `/configuracoes` sem parâmetro pousa.
 *
 * Uma constante, e NÃO "o primeiro item habilitado da lista": a derivação por
 * posição fazia a landing page mudar sozinha a cada reordenação do menu — e
 * agrupar as seções é justamente uma reordenação. Este é o pouso de sempre.
 */
export const SECAO_PADRAO: SecaoId = "ia";

/**
 * Valores de `?secao=` que não existem mais e para onde vão.
 *
 * `estrutura` era a seção que continha as sub-abas Áreas/Cargos/Hierarquia. O
 * redirect de rota já entrega mapeado; isto é o cinto para URL editada à mão.
 */
export const ALIASES: Readonly<Record<string, SecaoId>> = {
  estrutura: "areas",
};

/**
 * A seção está inacessível por feature flag?
 *
 * Inacessível é diferente de OCULTA: a doutrina do repo (ver
 * `temporarilyDisabledFeatures.ts`) é que a feature continua renderizada,
 * opaca e sem clique. Por isso uma seção desabilitada ainda CONTA como item
 * visível do grupo dela — ver `gruposVisiveis`.
 */
export function secaoEstaDesabilitada(secao: Secao): boolean {
  return secao.feature != null && isFeatureTemporarilyDisabled(secao.feature);
}

/**
 * Seções OCULTAS por flag — as que não são renderizadas.
 *
 * Mora num mapa à parte, e não num campo ao lado de `feature`, porque é o mapa
 * que deixa a distinção legível: ter `feature` é ficar opaco, estar aqui é
 * sumir. Com dois campos parecidos na mesma lista, a diferença dependeria de
 * lembrar qual é qual.
 *
 * Ocultar é a exceção; o padrão do produto é opacar (ver
 * `temporarilyDisabledFeatures.ts`). Vale para seção que já existiu e
 * funciona, onde o item opaco prometeria uma novidade que não é novidade.
 */
const FEATURE_QUE_OCULTA: Partial<Record<SecaoId, TemporarilyDisabledFeature>> =
  {
    hierarquia: "settingsHierarchy",
  };

/** A seção não deve ser renderizada em lugar nenhum? */
export function secaoEstaOculta(secao: Secao): boolean {
  const feature = FEATURE_QUE_OCULTA[secao.id];
  return feature != null && isFeatureTemporarilyDisabled(feature);
}

/** As seções que vieram da tela de Administração e compartilham um painel. */
const SECOES_DE_ADMINISTRACAO = [
  "membros",
  "areas",
  "cargos",
  "hierarquia",
  "acesso",
] as const;

export type SecaoAdministracao = (typeof SECOES_DE_ADMINISTRACAO)[number];

export function ehSecaoAdministracao(id: string): id is SecaoAdministracao {
  return (SECOES_DE_ADMINISTRACAO as readonly string[]).includes(id);
}

/**
 * Resolve `?secao=` para uma seção válida, aplicando alias e o padrão.
 *
 * Uma seção oculta cai no padrão pelo MESMO caminho de um `?secao=` que nunca
 * existiu, em silêncio e sem corrigir a URL. É de propósito que não haja regra
 * própria: um link salvo para uma seção temporariamente oculta não é um caso
 * novo, e mandá-lo para a seção vizinha do grupo inventaria um comportamento
 * que teria de ser desfeito quando a flag voltar.
 */
export function resolverSecao(solicitada: string | null): SecaoId {
  const pedida =
    solicitada != null ? (ALIASES[solicitada] ?? solicitada) : null;
  const achada = SECOES.find(
    (s) => s.id === pedida && !secaoEstaDesabilitada(s) && !secaoEstaOculta(s),
  );
  return achada?.id ?? SECAO_PADRAO;
}

/**
 * Os grupos que têm ao menos uma seção renderizada, com as seções de cada um.
 *
 * Seção OCULTA sai da lista; seção DESABILITADA continua nela, opaca — é a
 * distinção de `secaoEstaOculta` contra `secaoEstaDesabilitada`, e trocar uma
 * pela outra aqui faria Geral desaparecer inteiro quando Aparência e Voz estão
 * desligadas.
 *
 * O rótulo de um grupo que ficou sem nenhum item não aparece. Hoje isso não
 * acontece — com Hierarquia oculta, Estrutura ainda tem três seções —, mas o
 * filtro é o que impede um rótulo órfão no dia em que a última seção de um
 * grupo for ocultada.
 */
export function gruposVisiveis(): {
  id: GrupoId;
  titulo: string;
  itens: readonly Secao[];
}[] {
  return GRUPOS.map((g) => ({
    id: g.id,
    titulo: g.titulo,
    itens: SECOES.filter((s) => s.grupo === g.id && !secaoEstaOculta(s)),
  })).filter((g) => g.itens.length > 0);
}
