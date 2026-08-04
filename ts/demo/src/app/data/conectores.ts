// ----------------------------------------------------------------------
// Catálogo de Conectores — "Top 50 Integrações Estratégicas" do GregHub.
// Fonte de verdade para a página /<produto>/conectores. Cada conector
// declara categoria, objetivo, permissões e identidade visual (cor + sigla)
// usada para renderizar o "logo" como monograma colorido.
//
// O catálogo completo é mantido aqui como referência, mas o produto só
// exibe os conectores listados em VISIBLE_CONNECTOR_IDS (ver no fim do
// arquivo) — para revelar outra integração, basta incluir o id lá.
// ----------------------------------------------------------------------

export interface ConnectorCategory {
  id: string;
  label: string;
  /** Descrição curta exibida no cabeçalho da seção. */
  description: string;
  /** Classe de cor (texto) usada nos realces da categoria. */
  tint: string;
}

const allConnectorCategories: ConnectorCategory[] = [
  { id: "comunicacao", label: "Comunicação", description: "Conversas, reuniões e notificações entre pessoas e squads.", tint: "text-sky-500" },
  { id: "email", label: "E-mail", description: "Caixa de entrada corporativa: leitura, organização e envio.", tint: "text-red-500" },
  { id: "agenda", label: "Agenda", description: "Calendário, reuniões e disponibilidade.", tint: "text-blue-500" },
  { id: "identidade", label: "Identidade & Acessos", description: "Login único, provisionamento e diretório corporativo.", tint: "text-indigo-500" },
  { id: "rh", label: "RH & Folha", description: "Colaboradores, cargos, folha e movimentações.", tint: "text-emerald-500" },
  { id: "recrutamento", label: "Recrutamento", description: "Vagas, candidatos e captação de talentos.", tint: "text-amber-500" },
  { id: "produtividade", label: "Produtividade & Projetos", description: "Tarefas, documentos e colaboração visual.", tint: "text-violet-500" },
  { id: "analytics", label: "BI & Analytics", description: "Dashboards, indicadores e relatórios.", tint: "text-cyan-500" },
  { id: "automacao", label: "Automação", description: "Fluxos automáticos e orquestração low-code.", tint: "text-rose-500" },
  { id: "crm", label: "CRM & Marketing", description: "Leads, oportunidades e campanhas.", tint: "text-orange-500" },
  { id: "atendimento", label: "Atendimento", description: "Tickets, chamados e SLA.", tint: "text-teal-500" },
  { id: "documentos", label: "Assinatura & Documentos", description: "Contratos e assinaturas eletrônicas.", tint: "text-fuchsia-500" },
  { id: "financeiro", label: "Financeiro & Pagamentos", description: "Cobranças, faturamento e fluxo de caixa.", tint: "text-lime-600" },
  { id: "conteudo", label: "Conteúdo", description: "Vídeos e materiais de treinamento.", tint: "text-pink-500" },
];

export interface Connector {
  id: string;
  rank: number;
  name: string;
  category: string;
  objective: string;
  permissions: string[];
  /** Cor da marca (hex) usada no monograma. */
  brand: string;
  /** Sigla exibida no monograma quando não há logo. */
  initials: string;
  /** Conectado por padrão no ambiente de demonstração. */
  connectedByDefault?: boolean;
  /**
   * Conectar abre o consentimento OAuth do provedor. O estado destes nunca é
   * semeado no modo demo: só o servidor sabe se há autorização de fato.
   */
  oauth?: boolean;
  /** Integração recém-adicionada ao catálogo. */
  isNew?: boolean;
}

const connectorCatalog: Connector[] = [
  // Comunicação
  { id: "teams", rank: 1, name: "Microsoft Teams", category: "comunicacao", objective: "Comunicação corporativa", permissions: ["Ler usuários", "Enviar mensagens", "Criar reuniões", "Acessar calendário", "Criar canais", "Ler grupos"], brand: "#4f52b2", initials: "T", connectedByDefault: true },
  { id: "slack", rank: 2, name: "Slack", category: "comunicacao", objective: "Comunicação entre squads", permissions: ["Ler canais", "Enviar mensagens", "Criar bots", "Acessar usuários", "Publicar notificações"], brand: "#611f69", initials: "S", oauth: true },
  { id: "zoom", rank: 4, name: "Zoom", category: "comunicacao", objective: "Reuniões online", permissions: ["Criar reuniões", "Acessar participantes", "Gravar reuniões"], brand: "#2d8cff", initials: "Z" },
  { id: "whatsapp", rank: 5, name: "WhatsApp Business", category: "comunicacao", objective: "Comunicação e IA", permissions: ["Enviar mensagens", "Receber mensagens", "Criar fluxos IA", "Acessar templates"], brand: "#25d366", initials: "W", connectedByDefault: true },
  { id: "linkedin-pages", rank: 51, name: "LinkedIn", category: "comunicacao", objective: "Publicação em redes sociais", permissions: ["Publicar posts", "Agendar publicações", "Compartilhar artigos"], brand: "#0a66c2", initials: "in", isNew: true },
  { id: "facebook", rank: 52, name: "Facebook", category: "comunicacao", objective: "Publicação em páginas", permissions: ["Publicar posts", "Agendar publicações", "Enviar mensagens"], brand: "#1877f2", initials: "f", isNew: true },
  { id: "instagram", rank: 53, name: "Instagram", category: "comunicacao", objective: "Publicação em redes sociais", permissions: ["Publicar posts", "Publicar stories", "Enviar mensagens diretas"], brand: "#e4405f", initials: "Ig", isNew: true },

  // E-mail — conectam de verdade via OAuth (backend: src/conectores).
  { id: "gmail", rank: 54, name: "Gmail", category: "email", objective: "E-mail corporativo (Google)", permissions: ["Ler e-mails", "Enviar e-mails", "Acessar a conta autorizada"], brand: "#ea4335", initials: "M", oauth: true, isNew: true },
  { id: "outlook", rank: 55, name: "Outlook", category: "email", objective: "E-mail corporativo (Microsoft 365)", permissions: ["Ler e-mails", "Enviar e-mails", "Acessar a conta autorizada"], brand: "#0072c6", initials: "O", oauth: true, isNew: true },

  // Agenda — OAuth real (backend: src/conectores/agenda.controller.ts).
  { id: "google-calendar", rank: 56, name: "Google Calendar", category: "agenda", objective: "Agenda e reuniões", permissions: ["Acessar agenda", "Criar eventos", "Convidar participantes", "Ler disponibilidade"], brand: "#1a73e8", initials: "GC", oauth: true, isNew: true },

  // Identidade & Acessos
  { id: "azure-ad", rank: 6, name: "Azure AD", category: "identidade", objective: "Gestão de acessos", permissions: ["Autenticar usuários", "Sincronizar usuários", "Acessar grupos", "Provisionar contas"], brand: "#0078d4", initials: "AD" },
  { id: "okta", rank: 7, name: "Okta", category: "identidade", objective: "Identity management", permissions: ["SSO", "MFA", "Provisionamento", "Sincronização de acessos"], brand: "#007dc1", initials: "O" },
  { id: "ldap", rank: 8, name: "LDAP", category: "identidade", objective: "Diretório corporativo", permissions: ["Ler usuários", "Sincronizar cargos e departamentos"], brand: "#64748b", initials: "LD" },

  // RH & Folha
  { id: "successfactors", rank: 9, name: "SAP SuccessFactors", category: "rh", objective: "RH enterprise", permissions: ["Ler colaboradores", "Cargos", "Férias", "Líderes", "Desligamentos"], brand: "#0faaff", initials: "SF" },
  { id: "oracle-hcm", rank: 10, name: "Oracle HCM", category: "rh", objective: "Gestão de pessoas", permissions: ["Ler estrutura organizacional", "Cargos", "Jornadas"], brand: "#c74634", initials: "HCM" },
  { id: "totvs-rm", rank: 11, name: "TOTVS RM", category: "rh", objective: "RH e folha", permissions: ["Sincronizar colaboradores", "Folha", "Férias", "Centros de custo"], brand: "#0c9abe", initials: "RM", connectedByDefault: true },
  { id: "senior", rank: 12, name: "Senior Sistemas", category: "rh", objective: "RH e gestão", permissions: ["Ler base RH", "Cargos", "Líderes", "Movimentações"], brand: "#00a859", initials: "SR" },
  { id: "lg", rank: 13, name: "LG Lugar de Gente", category: "rh", objective: "Gestão de RH", permissions: ["Sincronizar avaliações", "Organograma", "Colaboradores"], brand: "#e30613", initials: "LG" },
  { id: "solides", rank: 14, name: "Sólides", category: "rh", objective: "RH para PMEs", permissions: ["Ler colaboradores", "Clima", "Dados comportamentais"], brand: "#6d28d9", initials: "SO" },
  { id: "convenia", rank: 15, name: "Convenia", category: "rh", objective: "RH simplificado", permissions: ["Admissão", "Desligamento", "Férias", "Documentos"], brand: "#1fb6a6", initials: "CV" },
  { id: "apdata", rank: 16, name: "Apdata", category: "rh", objective: "RH corporativo", permissions: ["Sincronizar usuários", "Áreas", "Cargos"], brand: "#1d4ed8", initials: "AP" },
  { id: "pontomais", rank: 17, name: "PontoMais", category: "rh", objective: "Controle de ponto", permissions: ["Ler jornada", "Banco de horas", "Ausências"], brand: "#00b8d4", initials: "PM" },
  { id: "adp", rank: 18, name: "ADP", category: "rh", objective: "Folha global", permissions: ["Payroll", "Benefícios", "Dados cadastrais"], brand: "#d0271d", initials: "ADP" },

  // Recrutamento
  { id: "gupy", rank: 19, name: "Gupy", category: "recrutamento", objective: "ATS", permissions: ["Ler vagas", "Candidatos", "Etapas do funil"], brand: "#ff5a5f", initials: "G", connectedByDefault: true },
  { id: "kenoby", rank: 20, name: "Kenoby", category: "recrutamento", objective: "Recrutamento", permissions: ["Sincronizar candidatos", "Vagas", "Entrevistas"], brand: "#2563eb", initials: "K" },
  { id: "linkedin", rank: 21, name: "LinkedIn Recruiter", category: "recrutamento", objective: "Sourcing", permissions: ["Importar candidatos", "Vagas", "Perfis"], brand: "#0a66c2", initials: "in" },
  { id: "catho", rank: 22, name: "Catho", category: "recrutamento", objective: "Divulgação de vagas", permissions: ["Publicar vagas", "Receber candidaturas"], brand: "#f97316", initials: "C" },
  { id: "indeed", rank: 23, name: "Indeed", category: "recrutamento", objective: "Recrutamento", permissions: ["Distribuir vagas", "Captar currículos"], brand: "#003a9b", initials: "I" },
  { id: "infojobs", rank: 24, name: "InfoJobs", category: "recrutamento", objective: "Captação de candidatos", permissions: ["Publicar vagas", "Receber candidatos"], brand: "#1453b3", initials: "IJ" },

  // Produtividade & Projetos
  { id: "google-workspace", rank: 3, name: "Google Workspace", category: "produtividade", objective: "Produtividade e colaboração", permissions: ["Login SSO", "Acessar agenda", "Criar eventos", "Ler diretório", "Acessar Drive"], brand: "#1a73e8", initials: "G", connectedByDefault: true },
  { id: "clickup", rank: 25, name: "ClickUp", category: "produtividade", objective: "Produtividade", permissions: ["Criar tarefas", "Atualizar status", "Ler projetos"], brand: "#7b68ee", initials: "CU" },
  { id: "jira", rank: 26, name: "Jira", category: "produtividade", objective: "Gestão ágil", permissions: ["Criar issues", "Acessar backlog", "Sincronizar sprint"], brand: "#0052cc", initials: "J" },
  { id: "trello", rank: 27, name: "Trello", category: "produtividade", objective: "Gestão visual", permissions: ["Criar cards", "Mover etapas", "Ler boards"], brand: "#0079bf", initials: "Tr" },
  { id: "monday", rank: 28, name: "Monday.com", category: "produtividade", objective: "Operação", permissions: ["Criar workflows", "Atualizar tarefas"], brand: "#ff3d57", initials: "M" },
  { id: "asana", rank: 29, name: "Asana", category: "produtividade", objective: "Gestão de projetos", permissions: ["Ler tarefas", "Atualizar projetos"], brand: "#f06a6a", initials: "As" },
  { id: "notion", rank: 30, name: "Notion", category: "produtividade", objective: "Conhecimento", permissions: ["Ler documentos", "Criar páginas", "Sincronizar wiki"], brand: "#111111", initials: "N" },
  { id: "miro", rank: 31, name: "Miro", category: "produtividade", objective: "Colaboração visual", permissions: ["Criar boards", "Acessar workshops"], brand: "#ffd02f", initials: "Mi" },
  { id: "figma", rank: 32, name: "Figma", category: "produtividade", objective: "Design system", permissions: ["Ler protótipos", "Comentários", "Componentes"], brand: "#a259ff", initials: "Fi" },

  // BI & Analytics
  { id: "power-bi", rank: 33, name: "Power BI", category: "analytics", objective: "Analytics", permissions: ["Ler dashboards", "Importar KPIs"], brand: "#f2c811", initials: "BI" },
  { id: "tableau", rank: 34, name: "Tableau", category: "analytics", objective: "BI corporativo", permissions: ["Sincronizar indicadores", "Relatórios"], brand: "#e97627", initials: "Tb" },
  { id: "looker", rank: 35, name: "Looker Studio", category: "analytics", objective: "Relatórios", permissions: ["Ler dashboards", "Métricas"], brand: "#4285f4", initials: "Lk" },

  // Automação
  { id: "zapier", rank: 36, name: "Zapier", category: "automacao", objective: "Automação", permissions: ["Disparar automações", "Consumir webhooks"], brand: "#ff4f00", initials: "Za" },
  { id: "make", rank: 37, name: "Make", category: "automacao", objective: "Integrações", permissions: ["Orquestrar fluxos automáticos"], brand: "#6d00cc", initials: "Mk" },
  { id: "pluga", rank: 38, name: "Pluga", category: "automacao", objective: "Automação nacional", permissions: ["Integrar sistemas via low-code"], brand: "#00b3a4", initials: "Pl" },

  // CRM & Marketing
  { id: "hubspot", rank: 39, name: "HubSpot", category: "crm", objective: "CRM", permissions: ["Ler leads", "Negócios", "Contatos"], brand: "#ff7a59", initials: "Hs" },
  { id: "salesforce", rank: 40, name: "Salesforce", category: "crm", objective: "CRM enterprise", permissions: ["Sincronizar contas", "Oportunidades", "Contatos"], brand: "#00a1e0", initials: "SF" },
  { id: "pipedrive", rank: 41, name: "Pipedrive", category: "crm", objective: "Gestão comercial", permissions: ["Ler pipeline", "Negócios", "Atividades"], brand: "#017737", initials: "Pd" },
  { id: "rd-station", rank: 42, name: "RD Station", category: "crm", objective: "Marketing", permissions: ["Leads", "Automações", "Campanhas"], brand: "#19c1d8", initials: "RD" },

  // Atendimento
  { id: "zendesk", rank: 43, name: "Zendesk", category: "atendimento", objective: "Atendimento", permissions: ["Ler tickets", "Criar chamados"], brand: "#03363d", initials: "Ze" },
  { id: "freshdesk", rank: 44, name: "Freshdesk", category: "atendimento", objective: "Service desk", permissions: ["Sincronizar tickets", "SLA"], brand: "#25c16f", initials: "Fd" },

  // Assinatura & Documentos
  { id: "docusign", rank: 45, name: "DocuSign", category: "documentos", objective: "Assinatura eletrônica", permissions: ["Assinar documentos", "Acompanhar status"], brand: "#ffce00", initials: "DS" },
  { id: "clicksign", rank: 46, name: "Clicksign", category: "documentos", objective: "Assinatura digital", permissions: ["Gerar contratos", "Acompanhar assinatura"], brand: "#3b5bdb", initials: "Cs" },

  // Financeiro & Pagamentos
  { id: "stripe", rank: 47, name: "Stripe", category: "financeiro", objective: "Pagamentos", permissions: ["Cobrança recorrente", "Assinaturas", "Invoices"], brand: "#635bff", initials: "St", isNew: true },
  { id: "omie", rank: 48, name: "Omie", category: "financeiro", objective: "ERP", permissions: ["Financeiro", "Faturamento", "Clientes"], brand: "#00a859", initials: "Om" },
  { id: "conta-azul", rank: 49, name: "Conta Azul", category: "financeiro", objective: "Financeiro", permissions: ["Fluxo de caixa", "Cobranças", "Notas"], brand: "#0099e8", initials: "CA" },

  // Conteúdo
  { id: "video", rank: 50, name: "Vimeo / YouTube", category: "conteudo", objective: "Conteúdo", permissions: ["Publicar vídeos", "Incorporar treinamentos"], brand: "#ff0000", initials: "▶", isNew: true },
];

// ----------------------------------------------------------------------
// Visibilidade — o produto expõe apenas estas integrações. Os demais
// conectores continuam no catálogo acima (e no espelho do backend), mas
// ficam ocultos em toda a interface: página de Conectores, filtros de
// categoria e destinos de compartilhamento.

export const VISIBLE_CONNECTOR_IDS: string[] = [
  "gmail",
  "slack",
  "google-calendar",
];

/** Conectores exibidos no produto, na ordem do catálogo. */
export const connectors: Connector[] = connectorCatalog.filter((c) =>
  VISIBLE_CONNECTOR_IDS.includes(c.id),
);

/** Categorias que possuem ao menos um conector visível. */
export const connectorCategories: ConnectorCategory[] =
  allConnectorCategories.filter((cat) =>
    connectors.some((c) => c.category === cat.id),
  );

/** Conectores visíveis de uma categoria, preservando a ordem do catálogo. */
export function connectorsByCategory(categoryId: string): Connector[] {
  return connectors.filter((c) => c.category === categoryId);
}

/** Mapa id → categoria para lookups rápidos (inclui categorias ocultas). */
export const categoryById: Record<string, ConnectorCategory> = Object.fromEntries(
  allConnectorCategories.map((c) => [c.id, c]),
);

// ----------------------------------------------------------------------
// Compartilhamento — conectores de Comunicação que permitem disparo de
// mensagem ou postagem (usados como destinos do botão "Compartilhar").

const SHARE_PERMISSION_RE = /enviar mensagens|publicar|postar/i;
const POST_PERMISSION_RE = /publicar post|publicar stories|postar|publicação/i;

/**
 * Conectores da categoria Comunicação cujas permissões habilitam disparo de
 * mensagem ou postagem (ex.: Teams, Slack, WhatsApp, LinkedIn, Facebook,
 * Instagram). Reuniões puras (ex.: Zoom) ficam de fora.
 */
export function shareableConnectors(): Connector[] {
  return connectors.filter(
    (c) =>
      c.category === "comunicacao" &&
      c.permissions.some((p) => SHARE_PERMISSION_RE.test(p)),
  );
}

/** Tipo de compartilhamento do conector: postagem ou mensagem. */
export function connectorShareKind(connector: Connector): "post" | "message" {
  return connector.permissions.some((p) => POST_PERMISSION_RE.test(p))
    ? "post"
    : "message";
}
