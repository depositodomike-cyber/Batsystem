/**
 * Flags de desabilitação temporária de funcionalidades do produto.
 *
 * IMPORTANTE: as features NÃO são removidas do código — só ficam
 * inacessíveis na UI (visíveis, opacas, sem clique). Para reativar,
 * altere a flag correspondente para `false`.
 *
 * Padrão visual: `cursor-not-allowed opacity-40`.
 */

export type TemporarilyDisabledFeature =
  | "aiStudio"
  | "squads"
  | "groups"
  | "history"
  | "insights"
  | "notes"
  | "email"
  | "slack"
  | "calendar"
  | "connectors"
  | "notifications"
  | "settingsAppearance"
  | "settingsVoice"
  | "settingsMemory"
  | "settingsHierarchy"
  | "settingsTokenUsage"
  | "memoryUploadAudio"
  | "memoryUploadTranscript"
  | "memoryGraph"
  | "memoryNoteEditing"
  | "rulesCorporatePin"
  // Funil legado de criação de conta — ver bloco no fim deste arquivo.
  | "legacySignup"
  | "legacyOnboarding"
  | "legacyPriceCalculator";

export const TEMPORARILY_DISABLED: Record<TemporarilyDisabledFeature, boolean> =
  {
    // true = AI Studio inteiro inacessível (grade opaca + modal "Em breve"),
    // incluindo "Criar Dashboard". A saída do modal leva ao Repositório.
    aiStudio: true,
    squads: true,
    groups: true,
    history: false,

    insights: true,
    notes: true,
    email: true,
    slack: true,
    calendar: true,
    // Conectores REATIVADO: o ícone de link no header e o card no menu
    // "Funcionalidades" voltam a ser clicáveis, e /:produto/conectores renderiza a
    // tela normalmente. Com a flag em true os dois pontos de entrada ficam
    // visíveis, opacos e sem clique — ver SYSTEM_AREA_FEATURE (Header) e
    // FEATURE_FLAG_BY_SLUG (Funcionalidades).
    connectors: false,
    notifications: true,
    settingsAppearance: true,
    settingsVoice: true,
    settingsMemory: false,
    // true = a seção Hierarquia de Configurações fica OCULTA — não renderizada.
    //
    // Atenção: esta flag se comporta diferente das outras três de Configurações.
    // Aparência, Voz e Repositório seguem o padrão da casa (visíveis, opacas, sem
    // clique); Hierarquia SOME do menu, e `?secao=hierarquia` passa a cair na
    // seção padrão como qualquer valor desconhecido. O padrão de "opaco" existe
    // para anunciar o que vem; esta seção já existiu e funciona, então anunciá-la
    // como novidade indisponível seria mentira — o precedente de ocultar em vez
    // de opacar é o funil legado, no fim deste arquivo.
    //
    // Nada foi removido: o painel, o organograma, a árvore e a rota continuam
    // intactos, e voltar a flag para `false` traz a seção de volta ao mesmo
    // lugar, com o mesmo id.
    settingsHierarchy: true,
    // true = o bloco "Consumo de tokens" some da aba IA & API, e a menção a ele
    // sai do texto de ajuda de Configurações. O painel e o GET /uso/tokens
    // seguem intactos no código.
    settingsTokenUsage: true,
    memoryUploadAudio: true,
    memoryUploadTranscript: true,
    // Grafo REATIVADO. Com a flag ligada o item fica visível mas sem clique,
    // a rota /memoria-grafo redireciona para /memoria-lista e o modal do AI
    // Studio aponta para a LISTA do Repositório — ver `grafoPath` em Ia.tsx.
    memoryGraph: false,
    // true = NotaMemoriaModal só-leitura: sem o seletor "Editar / Ler", sem a
    // caixa de edição e sem "Salvar", só a nota renderizada. Vale para os dois
    // caminhos que abrem o modal (grafo e lista do Repositório).
    memoryNoteEditing: true,
    rulesCorporatePin: true,
    legacySignup: true,
    legacyOnboarding: true,
    legacyPriceCalculator: true,
  };

/** Classe Tailwind do estado desabilitado (padrão do produto). */
export const DISABLED_MENU_CLASS = "cursor-not-allowed opacity-40";

// ----------------------------------------------------------------------
// Conectores liberados
//
// Diferente das flags acima, aqui a lista é de quem ESTÁ habilitado, e não de
// quem está desabilitado: a decisão do produto é "só estes três por enquanto".
// Assim, um conector novo no catálogo entra desativado por padrão — o contrário
// (lista de bloqueados) o liberaria em silêncio, que é o erro mais caro dos
// dois.
//
// Os demais continuam VISÍVEIS na tela de Conectores, opacos e sem clique
// (mesmo padrão dos itens de menu), em vez de sumirem: a lista mostra o que o
// produto vai integrar. Para liberar um, basta incluir o id aqui.

export const CONECTORES_HABILITADOS: string[] = [
  "google-calendar",
  "google-drive",
  "slack",
];

/** True quando o conector está visível mas indisponível para conectar. */
export function isConnectorTemporarilyDisabled(connectorId: string): boolean {
  return !CONECTORES_HABILITADOS.includes(connectorId);
}

export function isFeatureTemporarilyDisabled(
  feature: TemporarilyDisabledFeature,
): boolean {
  return TEMPORARILY_DISABLED[feature];
}

/**
 * Resolve se um item de navegação (ceoOs) está temporariamente desabilitado,
 * a partir do `id` (ex.: "behuman.insights") ou do último segmento do `path`.
 */
export function isNavItemTemporarilyDisabled(
  id: string,
  path?: string,
): boolean {
  const bySuffix: Record<string, TemporarilyDisabledFeature> = {
    insights: "insights",
    notas: "notes",
    email: "email",
    slack: "slack",
    agenda: "calendar",
    "upload-audio": "memoryUploadAudio",
    "upload-transcricao": "memoryUploadTranscript",
    "memoria-grafo": "memoryGraph",
  };

  const suffix = id.split(".").pop() ?? "";
  const fromId = bySuffix[suffix];
  if (fromId && TEMPORARILY_DISABLED[fromId]) return true;

  if (path) {
    const seg = path.split("/").filter(Boolean).pop()?.split("?")[0] ?? "";
    const fromPath = bySuffix[seg];
    if (fromPath && TEMPORARILY_DISABLED[fromPath]) return true;

    // Deep links /ia?fn=audio|transcricao (uploads sob Memória).
    if (
      /[?&]fn=audio(?:&|$)/.test(path) &&
      TEMPORARILY_DISABLED.memoryUploadAudio
    ) {
      return true;
    }
    if (
      /[?&]fn=transcricao(?:&|$)/.test(path) &&
      TEMPORARILY_DISABLED.memoryUploadTranscript
    ) {
      return true;
    }
  }

  return false;
}

/** Bloqueia abertura de modal de upload do Repositório via `?fn=`. */
export function isMemoryUploadFnTemporarilyDisabled(fnId: string): boolean {
  if (fnId === "audio") return TEMPORARILY_DISABLED.memoryUploadAudio;
  if (fnId === "transcricao")
    return TEMPORARILY_DISABLED.memoryUploadTranscript;
  return false;
}

// ----------------------------------------------------------------------
// Funil legado de criação de conta
//
// O modelo de contas mudou: a criação de conta passa a ser só nome/e-mail/senha,
// a organização (com o pagador CPF ou CNPJ) é uma etapa separada, e a
// classificação de cobrança B2C/B2B é DERIVADA do pagador — nunca uma escolha do
// usuário. O funil antigo contradiz isso em cheio: `/cadastro` é um precificador
// completo com um toggle explícito "Empresa (CNPJ)" / "Pessoa física (CPF)"
// dentro do próprio cadastro.
//
// Por isso ele fica OCULTO, não removido. As páginas seguem intactas no
// repositório — parte delas será reaproveitada no modelo novo (a lógica PF/PJ é
// justamente a base da etapa de pagador). Para reativar o funil inteiro, mude as
// três flags abaixo para `false`.

/**
 * Primeiro segmento de rota do funil legado → feature correspondente.
 *
 * Usa o PRIMEIRO segmento (e não o último, como `isNavItemTemporarilyDisabled`)
 * para que `/cadastro/qualquer-coisa` também caia no bloqueio.
 */
const LEGACY_FUNNEL_FEATURE_BY_SEGMENT: Record<
  string,
  TemporarilyDisabledFeature
> = {
  cadastro: "legacySignup",
  onboarding: "legacyOnboarding",
  calculadora: "legacyPriceCalculator",
};

/** Feature do funil legado correspondente a um pathname (ou null). */
export function legacyFunnelFeatureForPath(
  pathname: string,
): TemporarilyDisabledFeature | null {
  const seg = pathname.split("/").filter(Boolean)[0]?.split("?")[0] ?? "";
  return LEGACY_FUNNEL_FEATURE_BY_SEGMENT[seg] ?? null;
}

/** Bloqueia deep links para /cadastro, /onboarding e /calculadora. */
export function isLegacyFunnelPathTemporarilyDisabled(
  pathname: string,
): boolean {
  const feature = legacyFunnelFeatureForPath(pathname);
  return feature != null && TEMPORARILY_DISABLED[feature];
}
