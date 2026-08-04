// ----------------------------------------------------------------------
// Catálogo de Conectores — espelho backend da fonte do front:
//   ts/demo/src/app/data/conectores.ts
// Mantém apenas os campos de domínio (sem identidade visual). Qualquer
// alteração no catálogo deve ser refletida nos dois arquivos.
// ----------------------------------------------------------------------

export interface ConnectorCategory {
  id: string;
  label: string;
  /** Descrição curta da categoria. */
  description: string;
}

export const connectorCategories: ConnectorCategory[] = [
  { id: 'comunicacao', label: 'Comunicação', description: 'Conversas, reuniões e notificações entre pessoas e squads.' },
  { id: 'email', label: 'E-mail', description: 'Caixa de entrada corporativa: leitura, organização e envio.' },
  { id: 'agenda', label: 'Agenda', description: 'Calendário, reuniões e disponibilidade.' },
  { id: 'identidade', label: 'Identidade & Acessos', description: 'Login único, provisionamento e diretório corporativo.' },
  { id: 'rh', label: 'RH & Folha', description: 'Colaboradores, cargos, folha e movimentações.' },
  { id: 'recrutamento', label: 'Recrutamento', description: 'Vagas, candidatos e captação de talentos.' },
  { id: 'produtividade', label: 'Produtividade & Projetos', description: 'Tarefas, documentos e colaboração visual.' },
  { id: 'analytics', label: 'BI & Analytics', description: 'Dashboards, indicadores e relatórios.' },
  { id: 'automacao', label: 'Automação', description: 'Fluxos automáticos e orquestração low-code.' },
  { id: 'crm', label: 'CRM & Marketing', description: 'Leads, oportunidades e campanhas.' },
  { id: 'atendimento', label: 'Atendimento', description: 'Tickets, chamados e SLA.' },
  { id: 'documentos', label: 'Assinatura & Documentos', description: 'Contratos e assinaturas eletrônicas.' },
  { id: 'financeiro', label: 'Financeiro & Pagamentos', description: 'Cobranças, faturamento e fluxo de caixa.' },
  { id: 'conteudo', label: 'Conteúdo', description: 'Vídeos e materiais de treinamento.' },
];

export interface Connector {
  id: string;
  rank: number;
  name: string;
  category: string;
  objective: string;
  permissions: string[];
}

export const connectors: Connector[] = [
  // Comunicação
  { id: 'teams', rank: 1, name: 'Microsoft Teams', category: 'comunicacao', objective: 'Comunicação corporativa', permissions: ['Ler usuários', 'Enviar mensagens', 'Criar reuniões', 'Acessar calendário', 'Criar canais', 'Ler grupos'] },
  { id: 'slack', rank: 2, name: 'Slack', category: 'comunicacao', objective: 'Comunicação entre squads', permissions: ['Ler canais', 'Ler conversas e threads', 'Enviar mensagens', 'Criar bots', 'Acessar usuários', 'Publicar notificações'] },
  { id: 'zoom', rank: 4, name: 'Zoom', category: 'comunicacao', objective: 'Reuniões online', permissions: ['Criar reuniões', 'Acessar participantes', 'Gravar reuniões'] },
  { id: 'whatsapp', rank: 5, name: 'WhatsApp Business', category: 'comunicacao', objective: 'Comunicação e IA', permissions: ['Enviar mensagens', 'Receber mensagens', 'Criar fluxos IA', 'Acessar templates'] },
  { id: 'linkedin-pages', rank: 51, name: 'LinkedIn', category: 'comunicacao', objective: 'Publicação em redes sociais', permissions: ['Publicar posts', 'Agendar publicações', 'Compartilhar artigos'] },
  { id: 'facebook', rank: 52, name: 'Facebook', category: 'comunicacao', objective: 'Publicação em páginas', permissions: ['Publicar posts', 'Agendar publicações', 'Enviar mensagens'] },
  { id: 'instagram', rank: 53, name: 'Instagram', category: 'comunicacao', objective: 'Publicação em redes sociais', permissions: ['Publicar posts', 'Publicar stories', 'Enviar mensagens diretas'] },

  // E-mail (OAuth real — ver oauth-provider.service.ts)
  { id: 'gmail', rank: 54, name: 'Gmail', category: 'email', objective: 'E-mail corporativo (Google)', permissions: ['Ler e-mails', 'Enviar e-mails', 'Acessar a conta autorizada'] },
  { id: 'outlook', rank: 55, name: 'Outlook', category: 'email', objective: 'E-mail corporativo (Microsoft 365)', permissions: ['Ler e-mails', 'Enviar e-mails', 'Acessar a conta autorizada'] },

  // Agenda (OAuth real — ver oauth-provider.service.ts)
  { id: 'google-calendar', rank: 56, name: 'Google Calendar', category: 'agenda', objective: 'Agenda e reuniões', permissions: ['Acessar agenda', 'Criar eventos', 'Convidar participantes', 'Ler disponibilidade'] },

  // Identidade & Acessos
  { id: 'azure-ad', rank: 6, name: 'Azure AD', category: 'identidade', objective: 'Gestão de acessos', permissions: ['Autenticar usuários', 'Sincronizar usuários', 'Acessar grupos', 'Provisionar contas'] },
  { id: 'okta', rank: 7, name: 'Okta', category: 'identidade', objective: 'Identity management', permissions: ['SSO', 'MFA', 'Provisionamento', 'Sincronização de acessos'] },
  { id: 'ldap', rank: 8, name: 'LDAP', category: 'identidade', objective: 'Diretório corporativo', permissions: ['Ler usuários', 'Sincronizar cargos e departamentos'] },

  // RH & Folha
  { id: 'successfactors', rank: 9, name: 'SAP SuccessFactors', category: 'rh', objective: 'RH enterprise', permissions: ['Ler colaboradores', 'Cargos', 'Férias', 'Líderes', 'Desligamentos'] },
  { id: 'oracle-hcm', rank: 10, name: 'Oracle HCM', category: 'rh', objective: 'Gestão de pessoas', permissions: ['Ler estrutura organizacional', 'Cargos', 'Jornadas'] },
  { id: 'totvs-rm', rank: 11, name: 'TOTVS RM', category: 'rh', objective: 'RH e folha', permissions: ['Sincronizar colaboradores', 'Folha', 'Férias', 'Centros de custo'] },
  { id: 'senior', rank: 12, name: 'Senior Sistemas', category: 'rh', objective: 'RH e gestão', permissions: ['Ler base RH', 'Cargos', 'Líderes', 'Movimentações'] },
  { id: 'lg', rank: 13, name: 'LG Lugar de Gente', category: 'rh', objective: 'Gestão de RH', permissions: ['Sincronizar avaliações', 'Organograma', 'Colaboradores'] },
  { id: 'solides', rank: 14, name: 'Sólides', category: 'rh', objective: 'RH para PMEs', permissions: ['Ler colaboradores', 'Clima', 'Dados comportamentais'] },
  { id: 'convenia', rank: 15, name: 'Convenia', category: 'rh', objective: 'RH simplificado', permissions: ['Admissão', 'Desligamento', 'Férias', 'Documentos'] },
  { id: 'apdata', rank: 16, name: 'Apdata', category: 'rh', objective: 'RH corporativo', permissions: ['Sincronizar usuários', 'Áreas', 'Cargos'] },
  { id: 'pontomais', rank: 17, name: 'PontoMais', category: 'rh', objective: 'Controle de ponto', permissions: ['Ler jornada', 'Banco de horas', 'Ausências'] },
  { id: 'adp', rank: 18, name: 'ADP', category: 'rh', objective: 'Folha global', permissions: ['Payroll', 'Benefícios', 'Dados cadastrais'] },

  // Recrutamento
  { id: 'gupy', rank: 19, name: 'Gupy', category: 'recrutamento', objective: 'ATS', permissions: ['Ler vagas', 'Candidatos', 'Etapas do funil'] },
  { id: 'kenoby', rank: 20, name: 'Kenoby', category: 'recrutamento', objective: 'Recrutamento', permissions: ['Sincronizar candidatos', 'Vagas', 'Entrevistas'] },
  { id: 'linkedin', rank: 21, name: 'LinkedIn Recruiter', category: 'recrutamento', objective: 'Sourcing', permissions: ['Importar candidatos', 'Vagas', 'Perfis'] },
  { id: 'catho', rank: 22, name: 'Catho', category: 'recrutamento', objective: 'Divulgação de vagas', permissions: ['Publicar vagas', 'Receber candidaturas'] },
  { id: 'indeed', rank: 23, name: 'Indeed', category: 'recrutamento', objective: 'Recrutamento', permissions: ['Distribuir vagas', 'Captar currículos'] },
  { id: 'infojobs', rank: 24, name: 'InfoJobs', category: 'recrutamento', objective: 'Captação de candidatos', permissions: ['Publicar vagas', 'Receber candidatos'] },

  // Produtividade & Projetos
  { id: 'google-workspace', rank: 3, name: 'Google Workspace', category: 'produtividade', objective: 'Produtividade e colaboração', permissions: ['Login SSO', 'Acessar agenda', 'Criar eventos', 'Ler diretório', 'Acessar Drive'] },
  { id: 'clickup', rank: 25, name: 'ClickUp', category: 'produtividade', objective: 'Produtividade', permissions: ['Criar tarefas', 'Atualizar status', 'Ler projetos'] },
  { id: 'jira', rank: 26, name: 'Jira', category: 'produtividade', objective: 'Gestão ágil', permissions: ['Criar issues', 'Acessar backlog', 'Sincronizar sprint'] },
  { id: 'trello', rank: 27, name: 'Trello', category: 'produtividade', objective: 'Gestão visual', permissions: ['Criar cards', 'Mover etapas', 'Ler boards'] },
  { id: 'monday', rank: 28, name: 'Monday.com', category: 'produtividade', objective: 'Operação', permissions: ['Criar workflows', 'Atualizar tarefas'] },
  { id: 'asana', rank: 29, name: 'Asana', category: 'produtividade', objective: 'Gestão de projetos', permissions: ['Ler tarefas', 'Atualizar projetos'] },
  { id: 'notion', rank: 30, name: 'Notion', category: 'produtividade', objective: 'Conhecimento', permissions: ['Ler documentos', 'Criar páginas', 'Sincronizar wiki'] },
  { id: 'miro', rank: 31, name: 'Miro', category: 'produtividade', objective: 'Colaboração visual', permissions: ['Criar boards', 'Acessar workshops'] },
  { id: 'figma', rank: 32, name: 'Figma', category: 'produtividade', objective: 'Design system', permissions: ['Ler protótipos', 'Comentários', 'Componentes'] },

  // BI & Analytics
  { id: 'power-bi', rank: 33, name: 'Power BI', category: 'analytics', objective: 'Analytics', permissions: ['Ler dashboards', 'Importar KPIs'] },
  { id: 'tableau', rank: 34, name: 'Tableau', category: 'analytics', objective: 'BI corporativo', permissions: ['Sincronizar indicadores', 'Relatórios'] },
  { id: 'looker', rank: 35, name: 'Looker Studio', category: 'analytics', objective: 'Relatórios', permissions: ['Ler dashboards', 'Métricas'] },

  // Automação
  { id: 'zapier', rank: 36, name: 'Zapier', category: 'automacao', objective: 'Automação', permissions: ['Disparar automações', 'Consumir webhooks'] },
  { id: 'make', rank: 37, name: 'Make', category: 'automacao', objective: 'Integrações', permissions: ['Orquestrar fluxos automáticos'] },
  { id: 'pluga', rank: 38, name: 'Pluga', category: 'automacao', objective: 'Automação nacional', permissions: ['Integrar sistemas via low-code'] },

  // CRM & Marketing
  { id: 'hubspot', rank: 39, name: 'HubSpot', category: 'crm', objective: 'CRM', permissions: ['Ler leads', 'Negócios', 'Contatos'] },
  { id: 'salesforce', rank: 40, name: 'Salesforce', category: 'crm', objective: 'CRM enterprise', permissions: ['Sincronizar contas', 'Oportunidades', 'Contatos'] },
  { id: 'pipedrive', rank: 41, name: 'Pipedrive', category: 'crm', objective: 'Gestão comercial', permissions: ['Ler pipeline', 'Negócios', 'Atividades'] },
  { id: 'rd-station', rank: 42, name: 'RD Station', category: 'crm', objective: 'Marketing', permissions: ['Leads', 'Automações', 'Campanhas'] },

  // Atendimento
  { id: 'zendesk', rank: 43, name: 'Zendesk', category: 'atendimento', objective: 'Atendimento', permissions: ['Ler tickets', 'Criar chamados'] },
  { id: 'freshdesk', rank: 44, name: 'Freshdesk', category: 'atendimento', objective: 'Service desk', permissions: ['Sincronizar tickets', 'SLA'] },

  // Assinatura & Documentos
  { id: 'docusign', rank: 45, name: 'DocuSign', category: 'documentos', objective: 'Assinatura eletrônica', permissions: ['Assinar documentos', 'Acompanhar status'] },
  { id: 'clicksign', rank: 46, name: 'Clicksign', category: 'documentos', objective: 'Assinatura digital', permissions: ['Gerar contratos', 'Acompanhar assinatura'] },

  // Financeiro & Pagamentos
  { id: 'stripe', rank: 47, name: 'Stripe', category: 'financeiro', objective: 'Pagamentos', permissions: ['Cobrança recorrente', 'Assinaturas', 'Invoices'] },
  { id: 'omie', rank: 48, name: 'Omie', category: 'financeiro', objective: 'ERP', permissions: ['Financeiro', 'Faturamento', 'Clientes'] },
  { id: 'conta-azul', rank: 49, name: 'Conta Azul', category: 'financeiro', objective: 'Financeiro', permissions: ['Fluxo de caixa', 'Cobranças', 'Notas'] },

  // Conteúdo
  { id: 'video', rank: 50, name: 'Vimeo / YouTube', category: 'conteudo', objective: 'Conteúdo', permissions: ['Publicar vídeos', 'Incorporar treinamentos'] },
];

const connectorById = new Map(connectors.map((c) => [c.id, c]));

export function getConnector(id: string): Connector | undefined {
  return connectorById.get(id);
}

export function getCategory(id: string): ConnectorCategory | undefined {
  return connectorCategories.find((c) => c.id === id);
}
