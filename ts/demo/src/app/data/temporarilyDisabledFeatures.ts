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
  | "settingsAppearancePanel"
  | "brandGuideSecoesAvancadas"
  | "brandGuideMarcaAtiva"
  | "brandGuideContextosDeUso"
  | "brandGuideElementosVisuais"
  | "spreadsheetGeneration"
  | "aiStudioGenerationChat"
  | "settingsVoice"
  | "settingsMemory"
  | "settingsHierarchy"
  | "settingsTokenUsage"
  | "memoryUploadAudio"
  | "memoryUploadTranscript"
  | "memoryGraph"
  | "memoryNoteEditing"
  | "rulesCorporatePin"
  | "sendToGroup"
  | "presentationRepositorySource"
  // Funil legado de criação de conta — ver bloco no fim deste arquivo.
  | "legacySignup"
  | "legacyOnboarding"
  | "legacyPriceCalculator";

export const TEMPORARILY_DISABLED: Record<TemporarilyDisabledFeature, boolean> =
  {
    // AI Studio PARCIALMENTE reaberto: a tela e o bloco da sidebar voltam a
    // ser acessíveis, e a liberação por função fica em
    // AI_STUDIO_ENABLED_FUNCTION_IDS (ia-functions.ts) — hoje só "Criar
    // apresentação". Voltar esta flag para true fecha o Studio inteiro de novo
    // (grade opaca + modal "Em breve"), independentemente daquela lista.
    aiStudio: false,
    squads: true,
    // Grupos DESABILITADO de novo: o bloco "GRUPOS" da sidebar fica visível,
    // opaco e sem clique — o "+" não cria, os itens não navegam nem
    // renomeiam/excluem, e o "ver mais" some. Ponto de corte único, em
    // AgrupamentosGroup.tsx.
    //
    // A rota /:produto/agrupamentos/:id continua NÃO bloqueada — quem tiver o
    // link salvo ainda abre o grupo. É o mesmo comportamento das outras flags de
    // navegação (E-mail, Slack, Conectores): elas decidem o que é clicável, não
    // o que existe. Se um dia o corte precisar valer também para links diretos,
    // o lugar é uma guarda na rota, em ceoRoutes.tsx.
    groups: true,
    history: false,

    // Insights REATIVADO: o item "Insights" do PAINEL volta a ficar clicável na
    // sidebar e a página abre normalmente. O corte era um só, em
    // `isNavItemTemporarilyDisabled` (mais abaixo), que resolve pelo sufixo
    // `insights` do id/caminho — a rota nunca esteve bloqueada.
    //
    // A tela já lê dados de verdade: `listarInsightsApi()` chama GET
    // /ai/insights (InsightsController, em ts/api), e sem nenhum insight
    // gerado ela mostra o estado vazio em vez de lista estática.
    //
    // Quem grava insight é a geração automática no fim de dois fluxos do
    // backend: upload de Áudio (audio.controller.ts) e de Transcrição
    // (transcricao.controller.ts), que chamam `insights.gerarDeMaterial`
    // depois de salvar a ata. Os dois estavam fechados na UI e voltaram
    // junto com esta flag — ver `memoryUploadAudio` e
    // `memoryUploadTranscript` mais abaixo. Sem um upload desses, a tela
    // segue no estado vazio: é o esperado, não defeito.
    //
    // POST /ai/insights/gerar existe e `gerarInsightsApi` também, mas
    // nenhuma tela os chama. O pós-upload do Repositório (SugerirPosUpload)
    // NÃO é esse caminho: ele usa /ai/prompt em modo vault e só mostra o
    // texto num modal — nada é persistido.
    //
    // Insights é por produto: só `behuman` tem página própria
    // (`insightsPages` em ceoRoutes.tsx); nos demais o caminho cai no
    // Placeholder.
    insights: false,
    notes: true,
    // E-mail, Slack e Agenda DESABILITADOS: os três itens do PAINEL ficam
    // visíveis, opacos e sem clique na sidebar. O corte é um só, em
    // `isNavItemTemporarilyDisabled` (mais abaixo), que resolve pelo último
    // segmento do caminho — `email`, `slack` e `agenda`.
    //
    // As ROTAS continuam abertas: quem tiver `/:produto/email` salvo ainda abre
    // a tela. É o mesmo comportamento das outras flags de navegação — elas
    // decidem o que é clicável, não o que existe. Para valer também em link
    // direto, o lugar é uma guarda em ceoRoutes.tsx.
    //
    // E-mail e Slack têm tela própria (`pageBySlug` em ceoRoutes.tsx); Agenda
    // nunca teve, e caía no `Placeholder` ("em construção") enquanto esteve
    // clicável.
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
    // Aparência REATIVADA: a seção volta a ser clicável no menu de
    // Configurações e `?secao=aparencia` volta a resolver para ela.
    //
    // Ela volta com DUAS abas: a de sempre (animação de fundo e vinheta,
    // preferências deste navegador) e Guia de marca, que passou a ser o único
    // lugar onde se cria, edita e exclui as marcas da organização — o AI Studio
    // inteiro virou consumidor e apenas seleciona (ver DesignSystemBar). Manter
    // a flag ligada deixaria a gestão de marcas inalcançável.
    settingsAppearance: false,
    // true = a ABA "Aparência" (animação de fundo e vinheta) fica OCULTA dentro
    // da seção Aparência, que passa a mostrar só "Guia de marca". Com uma aba
    // só, a barra de abas também some — dois rótulos para um conteúdo seriam
    // ruído.
    //
    // OCULTA, e não opaca: é o mesmo caso de `settingsHierarchy` e
    // `sendToGroup`. O padrão de "visível e opaco" existe para anunciar o que
    // vem, e estes dois toggles já existiam e funcionavam — anunciá-los como
    // novidade indisponível seria mentira.
    //
    // Nada foi removido: `AbaPainel` e as preferências em `beculturePrefs`
    // seguem intactas, e voltar a flag para `false` traz a aba de volta ao
    // mesmo lugar, com o mesmo id de `?aba=`.
    settingsAppearancePanel: true,
    // true = as seções "Espaçamento e forma", "Componentes" e "Tokens e regras"
    // ficam OCULTAS no formulário do guia de marca (criar e editar). Sobram
    // Marca, Cores, Tipografia, Elementos visuais e Logos.
    //
    // OCULTAS, e não opacas: o formulário já existia inteiro e funcionava, e
    // anunciar campos como novidade indisponível seria mentira — mesmo
    // raciocínio de `settingsHierarchy` e `settingsAppearancePanel`.
    //
    // Os DADOS continuam: o formulário é controlado e passa o documento inteiro
    // adiante, então o que estas seções guardam é preservado ao salvar. Marca
    // nova nasce com os valores do PADRAO nesses campos. Consequência a saber:
    // `tokens.dos` e `tokens.donts` alimentam o prompt de geração
    // (`designBrief`), e com a seção fora do ar eles deixam de ser editáveis —
    // sem deixar de ser enviados.
    brandGuideSecoesAvancadas: true,
    // true = o estado "ativo" some da tabela de guias de marca: o selo "Ativa"
    // ao lado do nome e a ação "Definir como marca ativa" no kebab.
    //
    // As duas juntas, de propósito. O selo sozinho seria um estado que não dá
    // para mudar; a ação sozinha mudaria algo que não aparece em lugar nenhum.
    //
    // O CONCEITO continua vivo por baixo: a marca ativa é o que
    // `useActiveDesignSystem()` devolve e o que o AI Studio usa por padrão. Sem
    // esta tela, ela passa a ser definida só pela criação (marca nova nasce
    // ativa) e pelo seletor de marca do AI Studio.
    brandGuideMarcaAtiva: true,
    // true = "Contextos de uso" some do formulário de guia de marca E a
    // coluna Contextos some da tabela.
    //
    // As duas juntas, pelo mesmo motivo das outras daqui: a coluna sozinha
    // mostraria um dado que ninguém consegue mais editar. A busca da tabela
    // também deixa de olhar os contextos — casar por um texto invisível
    // pareceria defeito.
    //
    // Os DADOS continuam: o formulário é controlado e devolve o documento
    // inteiro, então `marca.contexto` é preservado ao salvar, e segue indo
    // para o prompt de geração.
    brandGuideContextosDeUso: true,
    // true = a seção "Elementos visuais" (Ícones, Ilustrações e fotos,
    // Sombras, Loading e feedback) fica OCULTA no formulário do guia de
    // marca. Flag própria, e não junto de `brandGuideSecoesAvancadas`: as
    // duas saíram por pedidos diferentes e podem voltar separadas.
    //
    // Os DADOS continuam, como nas outras: o formulário devolve o documento
    // inteiro. Consequência a saber: `visual.ilustracoes` alimenta o
    // `designImagemHint` da geração de imagem — segue sendo enviado, só
    // deixa de ser editável.
    brandGuideElementosVisuais: true,
    // true = em Criar planilha, o CTA "Gerar planilha" da revisão do plano
    // fica visível e sem clique — o padrão da casa para o que está a caminho.
    //
    // Hoje é FALSE: a geração existe (POST /ai/planilha/gerar + build-xlsx.ts).
    // A flag fica de pé como interruptor: se o provedor de IA ou a construção
    // do arquivo derem problema, ligá-la devolve a tela ao estado "planejar
    // funciona, gerar chega depois" sem tirar nada do ar.
    spreadsheetGeneration: false,
    // true = os fluxos do AI Studio deixam de ABRIR o painel do assistente
    // sozinhos ao terminar o plano ou o arquivo.
    //
    // Nada é apagado e nada entra no lugar: `anunciar()` continua existindo no
    // provider, o histórico segue guardado, os endpoints seguem de pé, e voltar
    // a flag para false devolve o comportamento exato de antes. O que muda é só
    // quem chama — as duas telas de geração.
    //
    // O aviso era redundante de todo jeito: quando o plano fica pronto a tela
    // mostra o plano, e quando o arquivo fica pronto a tela diz "pronta".
    //
    // "Ajustar com IA" não tem relação com isto: é ação contextual na própria
    // tela, não o chat geral, e continua igual.
    aiStudioGenerationChat: true,
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
    // Uploads de Áudio e Transcrição REATIVADOS. São eles que fazem a página
    // de Insights sair do zero: os dois controllers chamam
    // `insights.gerarDeMaterial` depois de salvar a ata na Memória
    // (audio.controller.ts e transcricao.controller.ts, em ts/api). Com as
    // flags ligadas, o gerador existia e nada o alcançava.
    //
    // Cada flag acende três pontos de uma vez: a aba do UploadModal (a barra
    // de abas volta a ter três), o item da sidebar sob Repositório
    // (`upload-audio` / `upload-transcricao`, via
    // `isNavItemTemporarilyDisabled`) e o deep link `/ia?fn=audio|transcricao`
    // (`isMemoryUploadFnTemporarilyDisabled`).
    //
    // A allow-list do AI Studio NÃO interfere aqui: os ids de upload vivem em
    // `UPLOAD_FUNCTIONS`, e `isAiStudioFunction` só olha `FUNCTIONS` (a grade).
    //
    // Dependência a saber, só no Áudio: a transcrição é Whisper, então exige
    // uma chave OpenAI — conexão de Texto, Imagem ou Vídeo do tenant, ou a
    // OPENAI_API_KEY do servidor. Sem nenhuma, o POST responde 400 com esse
    // texto. Transcrição (texto colado) usa o provedor de texto normal.
    memoryUploadAudio: false,
    memoryUploadTranscript: false,
    // Grafo REATIVADO. Com a flag ligada o item fica visível mas sem clique,
    // a rota /memoria-grafo redireciona para /memoria-lista e o modal do AI
    // Studio aponta para a LISTA do Repositório — ver `grafoPath` em Ia.tsx.
    memoryGraph: false,
    // true = NotaMemoriaModal só-leitura: sem o seletor "Editar / Ler", sem a
    // caixa de edição e sem "Salvar", só a nota renderizada. Vale para os dois
    // caminhos que abrem o modal (grafo e lista do Repositório).
    memoryNoteEditing: true,
    rulesCorporatePin: true,
    // true = o botão "Enviar para o grupo" SOME das 15 telas do AI Studio que o
    // usam (Apresentação, Ata, Artigo, Análise, Carrossel, Cortes, Vídeo,
    // Imagem, Dashboard, Melhorar, Documento e os painéis de upload).
    //
    // Some em vez de ficar opaco, pelo mesmo motivo de `settingsHierarchy`: o
    // padrão de "visível e opaco" existe para anunciar o que vem, e este botão
    // já existia e funcionava — anunciá-lo como novidade indisponível seria
    // mentira.
    //
    // O corte é um só, dentro do próprio `EnviarParaGrupo.tsx` — nenhuma das 15
    // telas foi tocada, e voltar esta flag para `false` traz o botão de volta em
    // todas elas ao mesmo tempo.
    sendToGroup: true,
    // true = "Buscar no Repositório", no menu "+" do campo de Sobre em Criar
    // apresentação, fica visível e sem clique.
    //
    // O que falta para virar false: o Repositório é CEGO para o que não é .md
    // (três filtros `.endsWith(".md")` em memoria-inventario.ts e
    // memoriaVault.ts), e a busca do vault indexa só texto de nota. Puxar as
    // especificações visuais de um arquivo de lá exige enxergar esse arquivo
    // primeiro — é outra natureza de dado, não um botão a mais.
    //
    // O upload do mesmo menu JÁ funciona: PDF e .docx passam por `extrairTexto`,
    // que a plataforma já usa em Análise, Ata e Documento.
    presentationRepositorySource: true,
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
