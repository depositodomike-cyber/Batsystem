/* Gerador da Especificação Técnica — beculture (para a CEIA).
 * Documento de REQUISITOS (greenfield): descreve O QUE o produto deve fazer.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TableOfContents, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
} = require("docx");

// ---------- paleta / constantes ----------
const NAVY = "1F3A5F";
const BLUE = "2E6FB0";
const GREY = "555555";
const LIGHT = "EAF1F8";
const ZEBRA = "F4F7FB";
const CONTENT_W = 9360; // US Letter, margens de 1"

// ---------- helpers ----------
const T = (text, o = {}) => new TextRun({ text, ...o });

const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [T(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [T(text)] });
const H3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [T(text)] });

const P = (text, o = {}) =>
  new Paragraph({ spacing: { after: 120, line: 276 }, children: typeof text === "string" ? [T(text, o)] : text });

const LEAD = (runs) => new Paragraph({ spacing: { after: 140, line: 276 }, children: runs });

const BUL = (text, level = 0) =>
  new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60, line: 268 },
    children: typeof text === "string" ? [T(text)] : text,
  });

const NUM = (text, ref = "nums") =>
  new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60, line: 268 },
    children: typeof text === "string" ? [T(text)] : text,
  });

const SPACER = (after = 80) => new Paragraph({ spacing: { after }, children: [T("")] });

// bloco de requisito: "RF-01  Título" + descrição
const REQ = (id, title, descRuns) => [
  new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [
      new TextRun({ text: id + "  ", bold: true, color: BLUE }),
      new TextRun({ text: title, bold: true }),
    ],
  }),
  new Paragraph({
    spacing: { after: 100, line: 272 },
    indent: { left: 360 },
    children: typeof descRuns === "string" ? [T(descRuns)] : descRuns,
  }),
];

const cell = (content, { header = false, w, fill, bold = false, align } = {}) => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCD6E0" };
  const paras = (Array.isArray(content) ? content : [content]).map((c) =>
    new Paragraph({
      alignment: align,
      spacing: { after: 0, line: 252 },
      children: [new TextRun({ text: String(c), bold: header || bold, color: header ? "FFFFFF" : "222222", size: header ? 19 : 19 })],
    })
  );
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: header ? NAVY : fill || "FFFFFF", type: ShadingType.CLEAR },
    borders: { top: border, bottom: border, left: border, right: border },
    children: paras,
  });
};

// tabela: headers[], rows[][], widths[]
const TABLE = (headers, rows, widths, { zebra = true } = {}) => {
  const headRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { header: true, w: widths[i], align: i === 0 ? AlignmentType.LEFT : AlignmentType.LEFT })),
  });
  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((c, ci) =>
        cell(c, { w: widths[ci], fill: zebra && ri % 2 ? ZEBRA : "FFFFFF" })
      ),
    })
  );
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headRow, ...bodyRows],
  });
};

// faixa colorida de destaque (callout)
const CALLOUT = (label, text) =>
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            shading: { fill: LIGHT, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT },
              left: { style: BorderStyle.SINGLE, size: 18, color: BLUE },
              right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT },
            },
            children: [
              new Paragraph({
                spacing: { after: 0, line: 272 },
                children: [
                  new TextRun({ text: label + ": ", bold: true, color: NAVY }),
                  new TextRun({ text, color: "333333" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

// ============================================================
// CONTEÚDO
// ============================================================
const body = [];
const add = (...x) => x.forEach((e) => (Array.isArray(e) ? body.push(...e) : body.push(e)));

// ---------- CAPA ----------
add(
  new Paragraph({ spacing: { before: 1800, after: 0 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "ESPECIFICAÇÃO TÉCNICA", bold: true, size: 56, color: NAVY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: "Plataforma beculture", bold: true, size: 40, color: BLUE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({ text: "Business Partner de IA · Multi-tenant SaaS B2B", size: 26, color: GREY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: "Documento de Requisitos para Desenvolvimento da Versão Definitiva", size: 24, italics: true, color: "333333" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 1000 },
    children: [new TextRun({ text: "Fornecedor de desenvolvimento: CEIA", size: 24, color: GREY })],
  }),
);
// tabela de metadados na capa
add(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [] }),
  TABLE(
    ["Campo", "Valor"],
    [
      ["Documento", "Especificação Técnica de Requisitos — Plataforma beculture"],
      ["Destinatário", "CEIA (fornecedor de desenvolvimento)"],
      ["Natureza", "Requisitos de produto — define O QUE construir; stack de frontend obrigatória"],
      ["Versão", "1.0"],
      ["Data", "Junho de 2026"],
      ["Status", "Para análise e proposta técnica"],
      ["Confidencialidade", "Confidencial — uso restrito ao projeto"],
    ],
    [3000, 6360],
    { zebra: true }
  ),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---------- SUMÁRIO ----------
add(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [T("Sumário")] }),
  new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ============================================================
// 1. INTRODUÇÃO
// ============================================================
add(H1("1. Introdução"));

add(H2("1.1 Propósito deste documento"));
add(LEAD([
  T("Este documento especifica os "),
  T("requisitos funcionais e não-funcionais", { bold: true }),
  T(" da plataforma "),
  T("beculture", { bold: true }),
  T(", para que a "),
  T("CEIA", { bold: true }),
  T(" desenvolva a versão definitiva (produção) do produto. O documento descreve "),
  T("o que", { italics: true }),
  T(" o sistema deve fazer — regras de negócio, fluxos, modelo de domínio, integrações e qualidade esperada. A "),
  T("stack de frontend é obrigatória", { bold: true }),
  T(" (ver Seção 3); a arquitetura de backend e as demais decisões internas de implementação ficam a critério técnico do fornecedor."),
]));
add(P("Existe um protótipo funcional (MVP) já construído que valida os fluxos descritos aqui. Esse protótipo serve como referência de comportamento e de experiência do usuário, mas não vincula a CEIA a nenhuma tecnologia específica. Sempre que um requisito for ilustrado por uma decisão já tomada no protótipo, isso será sinalizado como referência não-vinculante."));
add(CALLOUT("Como ler", "Requisitos funcionais são identificados por RF-xx e não-funcionais por RNF-xx. Tabelas de regras de negócio (preços, planos, papéis) são normativas: devem ser implementadas exatamente como descritas. Os anexos trazem catálogos completos e uma arquitetura de referência."));

add(H2("1.2 Visão geral do produto"));
add(LEAD([
  T("O beculture é um "),
  T("“business partner” de inteligência artificial para empresas", { bold: true }),
  T(": um ambiente web onde líderes e equipes conversam com squads de especialistas de IA, recebem insights sobre pessoas e negócio, consultam relatórios, conectam suas ferramentas corporativas e acumulam uma memória organizacional de longo prazo que personaliza as respostas da IA."),
]));
add(P("A plataforma é vendida como SaaS B2B multi-tenant, em modelo de assinatura por módulos, com teste grátis (trial) self-service. O produto se organiza em torno de:"));
add(
  BUL([T("Business Partner / Cockpit de IA", { bold: true }), T(" — squads de agentes de IA, chat com streaming, feed de conteúdo, insights, relatórios, memória da IA e conectores.")]),
  BUL([T("Módulos de negócio vendáveis", { bold: true }), T(" — Performance, Learning, Hiring (recrutamento) e Project Management.")]),
  BUL([T("Plataforma de integrações", { bold: true }), T(" — catálogo de conectores corporativos e um servidor MCP (Model Context Protocol) que permite a clientes externos operarem a conta da empresa.")]),
  BUL([T("Camada comercial", { bold: true }), T(" — cadastro, trial, onboarding, planos, precificação e cobrança (gateway de pagamento).")]),
);

add(H2("1.3 Escopo da versão definitiva"));
add(P("A versão definitiva deve entregar, em produção, com qualidade e segurança de SaaS comercial:"));
add(
  NUM("Cadastro self-service de empresas (PJ e PF), trial de 14 dias sem cartão e onboarding guiado."),
  NUM("Autenticação, multi-tenancy com isolamento total de dados por empresa e controle de papéis."),
  NUM("Catálogo de squads/agentes de IA e chat com IA em streaming, com histórico persistente."),
  NUM("Memória de longo prazo da IA (corporativa e de usuário), injetada no contexto das respostas."),
  NUM("Conectores corporativos com OAuth real e servidor MCP autenticado por chave de API por empresa."),
  NUM("IA por tenant (BYOK — cada empresa usa o próprio provedor/chave), com fallback gerenciado no trial."),
  NUM("Feed de conteúdo, insights e relatórios."),
  NUM("Billing recorrente com gateway de pagamento (Pix, cartão, boleto), faturas e controle de assinatura/paywall."),
);

add(H2("1.4 Fora de escopo (nesta fase)"));
add(
  BUL("Implementação funcional aprofundada de cada módulo de negócio (telas internas de Performance, Learning, Hiring e Project Management) além do que está descrito — o foco desta versão é a plataforma de IA + camada comercial + estrutura multi-tenant que sustenta os módulos."),
  BUL("Aplicativos móveis nativos (a aplicação é web responsiva)."),
  BUL("Emissão fiscal (NF-e) — prevista para evolução, integrada ao gateway."),
);

add(H2("1.5 Glossário"));
add(TABLE(
  ["Termo", "Definição"],
  [
    ["Tenant / Empresa", "Cliente da plataforma (PJ ou PF). Unidade de isolamento de dados e de cobrança."],
    ["Usuário", "Pessoa com acesso à plataforma, pertencente a uma empresa, com um papel (owner/admin/membro)."],
    ["Squad", "Grupo temático de agentes de IA especialistas (ex.: Cultura, Gestão de Pessoas)."],
    ["Agente", "Persona de IA dentro de um squad, com prompt/sistema próprio (ex.: um especialista de referência)."],
    ["Conversa", "Sessão de chat entre um usuário e um squad/agente, com histórico de mensagens."],
    ["Memória", "Fato de longo prazo que a IA usa para personalizar respostas (corporativa ou de usuário)."],
    ["Conector", "Integração com uma ferramenta externa (Slack, Google Workspace, etc.)."],
    ["MCP", "Model Context Protocol — protocolo que permite clientes externos (ex.: assistentes de IA) operarem conectores da empresa."],
    ["BYOK", "Bring Your Own Key — a empresa fornece a própria chave de provedor de IA; o consumo recai na conta dela."],
    ["Trial", "Período de teste grátis (14 dias, sem cartão)."],
    ["Módulo", "Produto vendável (Performance, Learning, Hiring, Project Management)."],
    ["Plano", "Nível de assinatura (Basic, Profissional, Expert)."],
  ],
  [2400, 6960]
));
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 2. VISÃO DE PRODUTO E ATORES
// ============================================================
add(H1("2. Atores, papéis e multi-tenancy"));

add(H2("2.1 Atores"));
add(TABLE(
  ["Ator", "Descrição", "Principais interações"],
  [
    ["Owner (Dono)", "Quem cadastra a empresa. Controle administrativo total.", "Cadastro, billing, convites, papéis, memória corporativa, chaves MCP, conectores."],
    ["Admin", "Usuário com privilégios administrativos delegados.", "Convites, memória corporativa, chaves MCP, conectores, configurações."],
    ["Membro", "Usuário operacional padrão.", "Chat com IA, memórias pessoais, leitura de feed/insights/relatórios, uso de conectores."],
    ["Visitante", "Pessoa não autenticada.", "Site comercial, cadastro, calculadora de preço, trial."],
    ["Cliente MCP", "Sistema externo (ex.: assistente de IA) autenticado por chave de API da empresa.", "Operar conectores da empresa via servidor MCP."],
    ["Sistema de IA", "Provedor de modelo (Anthropic/OpenAI) acionado por tenant.", "Gerar respostas de chat em streaming."],
    ["Gateway de pagamento", "Processador financeiro (ex.: Iugu).", "Cobrança recorrente, webhooks de status."],
  ],
  [1700, 3830, 3830]
));

add(H2("2.2 Multi-tenancy e isolamento"));
add(REQ("RF-01", "Isolamento por empresa", "Todos os dados operacionais (usuários, assinatura, conversas, memórias, conectores, chaves, documentos) devem pertencer a uma empresa e ser estritamente isolados entre tenants. Nenhuma requisição autenticada pode acessar, listar ou alterar dados de outra empresa, mesmo conhecendo identificadores."));
add(REQ("RF-02", "Escopo derivado da identidade", "O escopo de tenant de toda operação deve ser derivado da identidade autenticada do usuário (do lado servidor), nunca de parâmetros enviados pelo cliente. O papel do usuário deve ser verificado contra a fonte de verdade (banco), não confiando apenas no conteúdo do token."));
add(REQ("RF-03", "Catálogos globais compartilhados", "O catálogo de squads/agentes e o catálogo de conectores são globais (compartilhados por todas as empresas), enquanto o estado (squads fixados, conectores conectados, memórias, conversas) é por empresa/usuário. O modelo deve permitir, no futuro, squads específicos por empresa."));

add(H2("2.3 Papéis e permissões"));
add(P("As permissões mínimas por papel são normativas:"));
add(TABLE(
  ["Recurso / Ação", "Owner", "Admin", "Membro"],
  [
    ["Cadastro e dados da empresa", "Gerencia", "Lê", "Lê"],
    ["Billing e assinatura", "Gerencia", "—", "—"],
    ["Convidar / remover usuários", "Sim", "Sim", "Não"],
    ["Definir papéis", "Sim", "Parcial", "Não"],
    ["Chat com IA e histórico próprio", "Sim", "Sim", "Sim"],
    ["Conectar / desconectar conectores", "Sim", "Sim", "Sim*"],
    ["Criar / revogar chaves MCP", "Sim", "Sim", "Não"],
    ["Memória de usuário (criar/editar/excluir as próprias)", "Sim", "Sim", "Sim"],
    ["Memória corporativa (criar/editar/excluir)", "Sim", "Sim", "Não"],
    ["Configurar conexão de IA (BYOK)", "Sim", "Sim", "Não"],
  ],
  [4560, 1600, 1600, 1600]
));
add(P("* O acesso de membros a conectar/desconectar pode ser configurável por política da empresa; por padrão, leitura para todos e escrita para admin/owner é aceitável. A CEIA deve tornar isso parametrizável.", { italics: true, color: GREY, size: 19 }));
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 3. ARQUITETURA (requisitos)
// ============================================================
add(H1("3. Requisitos de arquitetura"));
add(P("Esta seção define a stack obrigatória de frontend e as restrições gerais de arquitetura. A stack de frontend é normativa (deve ser seguida). A arquitetura de backend e a infraestrutura ficam a critério técnico da CEIA, desde que cumpram os requisitos funcionais e não-funcionais deste documento."));

add(H2("3.1 Stack de frontend (obrigatória)"));
add(P("O frontend da versão definitiva deve ser desenvolvido com as seguintes tecnologias:"));
add(TABLE(
  ["Tecnologia", "Versão / detalhe", "Uso"],
  [
    ["React", "React 19", "Biblioteca de UI base da aplicação web (SPA)."],
    ["Tailwind CSS", "Tailwind CSS", "Framework de estilização utility-first (padrão de design system)."],
    ["JavaScript e TypeScript", "JS + TS", "Linguagens do frontend, com TypeScript para tipagem estática."],
  ],
  [2600, 2760, 4000]
));
add(REQ("RNF-FE-01", "Stack de frontend mandatória", [
  T("O frontend deve ser implementado em "),
  T("React 19", { bold: true }),
  T(", estilizado com "),
  T("Tailwind CSS", { bold: true }),
  T(", utilizando "),
  T("JavaScript e TypeScript", { bold: true }),
  T(". Não é permitido substituir React por outra biblioteca/framework de UI, nem Tailwind pela abordagem principal de estilização, sem aprovação formal do contratante."),
]));
add(REQ("RNF-FE-02", "Boas práticas do ecossistema React", "Adotar componentização, hooks e padrões idiomáticos do React 19; build moderno (bundler à escolha da CEIA, ex.: Vite); e organização de código com TypeScript tipado nas regras de negócio do cliente. Bibliotecas complementares (roteamento, formulários, gráficos, etc.) ficam a critério da CEIA, desde que compatíveis com a stack obrigatória."));

add(H2("3.2 Restrições gerais de arquitetura"));
add(P("Restrições de alto nível que a solução deve respeitar (a implementação interna é decisão da CEIA):"));
add(
  BUL([T("Aplicação web SPA responsiva", { bold: true }), T(" (desktop e mobile-web), em React 19, consumindo uma API de backend.")]),
  BUL([T("API de backend stateless e horizontalmente escalável", { bold: true }), T(", com autenticação por token e autorização por papel/tenant.")]),
  BUL([T("Banco de dados relacional", { bold: true }), T(" como fonte de verdade transacional (multi-tenant). NoSQL/cache podem complementar.")]),
  BUL([T("Streaming de respostas de IA", { bold: true }), T(" do servidor para o cliente (ex.: SSE), com cancelamento.")]),
  BUL([T("Endpoint de servidor MCP", { bold: true }), T(" exposto publicamente, autenticado por chave de API por empresa.")]),
  BUL([T("Segredos criptografados em repouso", { bold: true }), T(" (chaves de IA, tokens OAuth) e geríveis por um cofre de chaves (KMS) em produção.")]),
  BUL([T("Implantação conteinerizada", { bold: true }), T(", com ambientes separados (dev/homolog/produção), migrações versionadas e observabilidade.")]),
);
add(CALLOUT("Referência de backend (não-vinculante)", "O protótipo usa API NestJS + PostgreSQL no backend; provedores Anthropic e OpenAI para IA; e o SDK oficial de MCP. Para o backend e a infraestrutura, a CEIA pode adotar, adaptar ou substituir essas escolhas, desde que cumpra os requisitos deste documento. A stack de frontend (Seção 3.1), porém, é obrigatória."));
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 4. REQUISITOS FUNCIONAIS POR MÓDULO
// ============================================================
add(H1("4. Requisitos funcionais"));

// ---- 4.1 Cadastro / contratação ----
add(H2("4.1 Cadastro e contratação (trial self-service)"));
add(P("Fluxo de aquisição self-service: o site comercial encaminha o visitante para o cadastro, já indicando o plano escolhido. O app é dono do cadastro, trial, onboarding e paywall."));
add(REQ("RF-10", "Cadastro PJ e PF", [
  T("Permitir cadastro de empresa como "),
  T("Pessoa Jurídica (CNPJ)", { bold: true }),
  T(" ou "),
  T("Pessoa Física (CPF)", { bold: true }),
  T(", via alternância. PJ coleta razão social e nome fantasia; PF coleta nome completo e oculta razão social/nome fantasia. O documento (CNPJ/CPF) deve ser validado (formato + dígitos verificadores)."),
]));
add(REQ("RF-11", "Seleção comercial no cadastro", "No cadastro a empresa escolhe módulo(s), plano (Basic/Profissional/Expert), ciclo de cobrança (mensal/anual) e a quantidade — número de usuários (módulos por usuário) e/ou número de posições (Hiring). O total estimado deve ser exibido em tempo real (ver Seção 5 — Precificação)."));
add(REQ("RF-12", "Dados do responsável e credenciais", "Coletar nome, e-mail, telefone e senha do responsável (owner). Senha mínima de 8 caracteres, com pelo menos uma letra e um número, com confirmação e opção de exibir/ocultar. O e-mail deve ser único na plataforma e validado para disponibilidade antes da conclusão."));
add(REQ("RF-13", "Setor de atuação", "Coletar o setor de atuação (lista controlada) e, para PJ, o nome fantasia. Esses dados alimentam o perfil da empresa e a personalização inicial da IA."));
add(REQ("RF-14", "Criação atômica da conta", "Ao concluir, o sistema deve criar — em uma única transação — a empresa, o usuário owner (senha com hash forte) e a assinatura em estado de trial, autenticando o usuário automaticamente (sessão ativa) e encaminhando ao onboarding."));
add(REQ("RF-15", "Trial sem cartão", "O trial dura 14 dias e não exige cartão de crédito. A contagem do trial é registrada na assinatura (início/fim)."));

// ---- 4.2 Onboarding ----
add(H2("4.2 Onboarding"));
add(REQ("RF-20", "Wizard de onboarding", "Após o cadastro, apresentar um assistente de duas etapas: (1) Seu time — convidar usuários por e-mail (com chips removíveis e opção de pular); (2) Comece a usar — checklist com dias de trial restantes, número de convites e módulos contratados, reforçando que não há cobrança no teste."));
add(REQ("RF-21", "Conclusão e entrada no produto", "Ao concluir, registrar a data de conclusão do onboarding e direcionar o usuário ao cockpit do produto. O sistema deve tolerar o caso de o usuário pular convites."));

// ---- 4.3 Auth ----
add(H2("4.3 Autenticação e sessão"));
add(REQ("RF-30", "Login por e-mail e senha", "Autenticação por e-mail + senha, com verificação de hash em tempo constante (resistente a enumeração). Em caso de sucesso, emitir um token de sessão e retornar o perfil do usuário (id, nome, e-mail, papel, avatar)."));
add(REQ("RF-31", "Sessão persistente e reidratação", "A sessão deve persistir entre recarregamentos da página e ser reidratada a partir do token, recuperando o perfil atual. Logout deve invalidar a sessão no cliente."));
add(REQ("RF-32", "Proteção de rotas", "Todas as áreas do produto exigem autenticação. Rotas públicas restringem-se a site/cadastro/calculadora/onboarding e páginas de erro. Endpoints sensíveis exigem papel adequado."));
add(REQ("RF-33", "Gestão de empresa, usuários e convites", "Expor a leitura dos dados da empresa; a listagem, criação (múltiplos e-mails de uma vez, com papel) e remoção de convites; e a conclusão de onboarding. Convites inválidos ou duplicados devem ser ignorados de forma idempotente."));
add(CALLOUT("Recomendação de evolução", "Prever recuperação de senha, verificação de e-mail, aceite de convite com criação de conta vinculada à empresa, e (no plano Expert) SSO/SAML — citado como diferencial de plano."));

// ---- 4.4 Squads ----
add(H2("4.4 Squads e agentes de IA"));
add(LEAD([
  T("O coração do produto é um catálogo de "),
  T("squads", { bold: true }),
  T(" — grupos temáticos de "),
  T("agentes", { bold: true }),
  T(" de IA especializados. Cada agente é uma persona com um prompt/sistema próprio. O protótipo traz "),
  T("15 squads × 5 agentes = 75 agentes", { bold: true }),
  T(" e cerca de "),
  T("150 perguntas-modelo", { bold: true }),
  T(" (starter questions) — ver Anexo C."),
]));
add(REQ("RF-40", "Catálogo de squads", "Disponibilizar um catálogo de squads com identificador estável, slug, título, ícone, descrição, ordem e estado (ativo). A listagem para navegação deve ser leve (sem prompts)."));
add(REQ("RF-41", "Detalhe do squad", "Para cada squad, fornecer o detalhe com seus agentes (posição, referência, quem é, contribuição, prompt/sistema e, opcionalmente, modelo de IA específico) e suas perguntas-modelo, em ordem. Squads inexistentes retornam erro tratado."));
add(REQ("RF-42", "Fixar squads", "Cada usuário pode fixar/desfixar squads para acesso rápido no menu. A ordem dos fixados é por usuário."));
add(REQ("RF-43", "Administração do catálogo", "O catálogo deve ser administrável (ativar/desativar, ordenar, editar prompts e perguntas). Em produção, prever uma área administrativa para curadoria do catálogo global e, futuramente, squads por empresa."));

// ---- 4.5 Chat IA ----
add(H2("4.5 Chat com IA (streaming)"));
add(REQ("RF-50", "Conversa com squad/agente", "Permitir conversar com um squad (resposta em nível de squad) ou com um agente específico do squad. A entrada inclui o squad, o agente (opcional), o histórico de mensagens e a nova pergunta."));
add(REQ("RF-51", "Resposta em streaming", "A resposta da IA deve ser transmitida em streaming (token a token) e renderizada em tempo real (efeito de digitação), com suporte a cancelamento pelo usuário. Eventos mínimos do fluxo: início/metadados (identificador da conversa), incrementos de texto, conclusão e erro."));
add(REQ("RF-52", "Construção do contexto (system prompt)", "O contexto enviado à IA deve combinar: a persona do agente (ou a síntese do squad), um enquadramento do produto e as memórias de longo prazo ativas e relevantes ao tema (ver 4.6). A resposta deve suportar formatação (Markdown) e código."));
add(REQ("RF-53", "Persistência de conversas e mensagens", "Cada conversa e seus turnos (usuário/assistente) devem ser persistidos, escopados por empresa e usuário, com título, squad/agente associados e datas. A mensagem do usuário é gravada antes da chamada; a resposta do assistente, ao concluir."));
add(REQ("RF-54", "Histórico e agrupamentos", "O usuário pode ver o histórico de conversas, abrir uma conversa anterior, renomeá-la, excluí-la e organizá-la em agrupamentos (“projetos”) criados por ele. O menu deve apresentar Squads (fixados), Agrupamentos e Histórico."));
add(REQ("RF-55", "Documentos gerados", "Quando a IA produz um artefato (resumo, relatório, etc.), o sistema registra um documento associado ao squad (título, tipo, conteúdo/URL, data), acessível em uma aba de documentos e em preview."));
add(REQ("RF-56", "Perguntas-modelo", "A tela de chat deve oferecer perguntas-modelo do squad como atalhos para iniciar a conversa."));

// ---- 4.6 Memória ----
add(H2("4.6 Memória de longo prazo da IA"));
add(LEAD([
  T("A "),
  T("Memória", { bold: true }),
  T(" é a base de conhecimento de longo prazo da IA sobre a empresa: fatos que personalizam as respostas dos squads. É um diferencial central do produto."),
]));
add(REQ("RF-60", "Itens de memória", "Cada memória tem: categoria (tema), título, conteúdo, origem/fonte, nível de confiança (alta/média/baixa), data de aprendizado, e flags de ativa e corporativa. Memórias inativas não entram no contexto da IA."));
add(REQ("RF-61", "Temas/categorias", "Os temas são dinâmicos: um por squad do catálogo (identificado pelo slug do squad) mais três temas transversais fixos — Estratégico, Hierárquico e Histórico. A lista de temas é montada em runtime a partir do catálogo de squads."));
add(REQ("RF-62", "Memória corporativa vs. de usuário", "Memórias corporativas são definições da organização e somente leitura para membros: apenas admin/owner podem criá-las, editá-las ou removê-las (o backend deve recusar com 403 caso contrário). Memórias de usuário são editáveis por quem as criou."));
add(REQ("RF-63", "CRUD e ativação", "Listar (priorizando fixadas e mais recentes), criar, editar parcialmente (incluindo alternar ativa) e excluir memórias, sempre escopadas à empresa. A UI deve oferecer busca, filtro por status (todas/ativas/inativas) e pílulas por categoria."));
add(REQ("RF-64", "Injeção hierárquica no contexto", "Ao montar o contexto da IA, as memórias ativas devem ser organizadas por níveis de precedência — Estratégica > Hierárquica > Categoria (tema do squad) > Histórica — filtradas pelo tema relevante e ordenadas por confiança."));
add(REQ("RF-65", "Estimativa de consumo (tokens)", "A UI deve estimar o consumo de contexto (tokens) por memória e o total das ativas, para o usuário gerir o orçamento de contexto."));
add(REQ("RF-66", "Semeadura inicial", "Na criação da empresa, a memória pode ser pré-populada com definições corporativas iniciais (ex.: uma memória-base por squad), marcadas como corporativas."));

// ---- 4.7 Conectores ----
add(H2("4.7 Conectores (integrações)"));
add(REQ("RF-70", "Catálogo de conectores", "Disponibilizar um catálogo de conectores corporativos organizados por categoria (comunicação, identidade & acessos, RH & folha, recrutamento, produtividade & projetos, BI & analytics, automação, CRM & marketing, atendimento, assinatura & documentos, financeiro & pagamentos, conteúdo). Cada conector tem nome, categoria, objetivo, permissões, marca/cor e iniciais. Ver Anexo B."));
add(REQ("RF-71", "Estado por empresa", "O estado conectado/desconectado de cada conector é por empresa e persistido no servidor. A UI reflete o estado com conexão otimista e rollback em falha. O catálogo deve registrar a origem da conexão (app, MCP ou OAuth)."));
add(REQ("RF-72", "OAuth real (piloto Slack)", "Conectores que exigem OAuth devem implementar o fluxo completo. O piloto é o Slack: gerar URL de autorização com state assinado e expirável; no callback, trocar o código por token, armazená-lo criptografado por empresa (com teamId/teamName/escopos) e retornar ao app com status. O token do tenant é usado para operações reais (listar canais, enviar mensagem)."));
add(REQ("RF-73", "Compartilhamento via conectores", "Conteúdos (ex.: feed, relatórios) podem ser compartilhados pelos conectores com permissão adequada (ex.: enviar mensagem/publicar), escolhendo conector e destino."));

// ---- 4.8 MCP ----
add(H2("4.8 Servidor MCP (produto vendável)"));
add(LEAD([
  T("O servidor "),
  T("MCP", { bold: true }),
  T(" permite que clientes externos de IA (ex.: assistentes/IDE com IA) operem os conectores da empresa de forma programática e segura. É um diferencial vendável."),
]));
add(REQ("RF-80", "Endpoint MCP autenticado", "Expor um endpoint MCP (HTTP) autenticado por chave de API da empresa. A chave é apresentada no cabeçalho de autorização; o servidor resolve a empresa a partir dela e escopa todas as operações a esse tenant."));
add(REQ("RF-81", "Chaves de API por empresa", "Permitir que admin/owner gerem, listem e revoguem chaves de API MCP. A chave em texto puro é exibida apenas uma vez na criação; o sistema guarda somente um hash. Cada chave registra nome, últimos dígitos, criação, último uso e revogação."));
add(REQ("RF-82", "Ferramentas (tools) escopadas", "O servidor MCP expõe ferramentas para operar conectores, todas escopadas à empresa da chave: listar categorias, listar conectores (com filtros), obter conector, conectar e desconectar conectores (idempotentes); e, para conectores OAuth ativos, ações específicas (ex.: listar canais e enviar mensagem no Slack)."));
add(REQ("RF-83", "Evolução: OAuth no MCP", "Prever suporte a OAuth 2.1 no endpoint MCP para habilitar clientes web (ex.: assistentes em nuvem) além do acesso por chave de API."));

// ---- 4.9 Feed ----
add(H2("4.9 Feed de conteúdo"));
add(REQ("RF-90", "Feed", "Apresentar um feed de publicações com destaque, grid de cards, busca textual e filtro por categoria (ex.: Cultura, Liderança & Gestão, Produtos, Eventos, Mercado, Tecnologia & IA, Conquistas). Cada item tem título, resumo, autor, data, tempo de leitura, imagem e contadores."));
add(REQ("RF-91", "Detalhe e interações", "Permitir abrir o detalhe de uma publicação e interações sociais: curtir e comentar."));

// ---- 4.10 Insights ----
add(H2("4.10 Insights"));
add(REQ("RF-100", "Insights pessoais e de equipe", "Apresentar insights em duas visões: “Para você” (do líder) e “Para equipe” (por liderado ou time). Cada insight tem título, descrição, data e severidade (ação necessária, atenção, parabéns, para refletir), com cores associadas."));
add(REQ("RF-101", "Filtros e ação", "Oferecer filtros por severidade, por pessoa (visão de equipe) e ordenação (recente/antigo/relevância), além de um detalhe acionável por insight."));

// ---- 4.11 Relatorios ----
add(H2("4.11 Relatórios"));
add(REQ("RF-110", "Listagem de relatórios", "Listar relatórios com visão alternável (lista/cards), busca, filtros (categoria, status) e ordenação. Cada relatório tem nome, categoria, objetivo, público, última atualização, período, fonte de dados e status (atualizado/finalizado/em andamento)."));
add(REQ("RF-111", "Detalhe do relatório", "Abrir o detalhe com visualizações (gráficos e tabelas), metadados e ações (baixar, compartilhar, atualizar)."));

// ---- 4.12 IA por tenant (BYOK) ----
add(H2("4.12 IA por tenant (BYOK) e modo gerenciado"));
add(REQ("RF-120", "Conexão de IA por empresa", "Cada empresa conecta o próprio provedor e chave de IA (BYOK), de modo que o consumo recaia na conta dela. Provedores mínimos: Anthropic (Claude) e OpenAI, com catálogo de modelos por provedor."));
add(REQ("RF-121", "Chave write-only e validação", "Ao salvar, a chave deve ser validada junto ao provedor antes de persistir. A chave é armazenada criptografada e é write-only: a API nunca a devolve, expondo apenas provedor, modelo, últimos 4 dígitos e status (ativa/inválida) e data de validação."));
add(REQ("RF-122", "Resolução de credenciais", [
  T("Ao processar um chat, o sistema resolve as credenciais nesta ordem: "),
  T("(1)", { bold: true }), T(" conexão BYOK da empresa; "),
  T("(2)", { bold: true }), T(" fallback gerenciado pela plataforma "),
  T("apenas durante o trial vigente", { bold: true }),
  T("; (3)", { bold: true }), T(" caso contrário, erro orientando a empresa a conectar uma IA."),
]));

// ---- 4.13 Billing ----
add(H2("4.13 Billing, assinatura e paywall"));
add(REQ("RF-130", "Assinatura por empresa", "Cada empresa possui uma assinatura com plano, ciclo, módulos, quantidades (usuários/posições), preços unitários snapshot, total, indicador de “sob consulta”, datas de trial e status."));
add(REQ("RF-131", "Estados da assinatura", "Estados: trial, ativa, inadimplente, expirada, cancelada. As transições devem ser controladas pelo backend (ex.: trial → ativa na confirmação de pagamento; trial/ativa → expirada/inadimplente conforme prazo/pagamento; → cancelada por solicitação)."));
add(REQ("RF-132", "Gateway de pagamento", "Integrar um gateway de pagamento brasileiro (referência: Iugu) para cobrança recorrente por Pix, cartão e boleto: criar cliente/assinatura no gateway na ativação, processar webhooks de status, e cancelar no gateway. A assinatura guarda método de pagamento e referência do gateway."));
add(REQ("RF-133", "Paywall e banner de trial", "Exibir, dentro do app, o tempo restante de trial e aplicar paywall ao expirar (bloqueio das funcionalidades pagas com chamada à ação para ativar a assinatura)."));
add(REQ("RF-134", "Cálculo de preço", "O cálculo de preço deve seguir exatamente as regras da Seção 5, incluindo faixas por quantidade, desconto anual e desconto de pacote para múltiplos módulos."));
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 5. REGRAS DE NEGÓCIO — PRECIFICAÇÃO
// ============================================================
add(H1("5. Regras de negócio: planos e precificação"));
add(P("Esta seção é normativa. Os valores e regras devem ser implementados exatamente como descritos. Os preços devem ser parametrizáveis (administráveis) em produção, mas os valores iniciais e a lógica de cálculo são os abaixo."));

add(H2("5.1 Módulos vendáveis"));
add(TABLE(
  ["Código", "Nome", "Descrição", "Unidade de cobrança"],
  [
    ["performance", "Performance", "Avaliações, OKRs e 1:1s", "por usuário"],
    ["learning", "Learning", "Trilhas de aprendizagem e LMS", "por usuário"],
    ["recrutamento", "Hiring", "Vagas, triagem e pipeline", "por posição"],
    ["projetos", "Project Management", "Gestão de projetos e tarefas", "por usuário"],
  ],
  [1700, 2100, 3360, 2200]
));

add(H2("5.2 Planos"));
add(P("Três planos. Observação: o código interno do plano “corporativo” é exibido comercialmente como “Expert”, e o “basico” como “Basic”. Os códigos (basico/profissional/corporativo) são usados em URLs e integrações."));
add(TABLE(
  ["Código", "Nome comercial", "Proposta", "Destaques"],
  [
    ["basico", "Basic", "Equipes que precisam apenas da funcionalidade do módulo selecionado.", "Recrutamento até 5 vagas/mês; Performance & OKRs básico; pesquisa de clima trimestral; dashboard unificado; suporte por chat comercial."],
    ["profissional", "Profissional (mais escolhido)", "Módulo selecionado aliado a uma comunicação excelente.", "Recrutamento ilimitado; Performance & OKRs completo; clima contínuo + IA preditiva de turnover; triagem automática e LMS; suporte prioritário + CSM."],
    ["corporativo", "Expert", "Excelência no uso de soluções e IA.", "Tudo do Profissional; SSO/SAML e API; multi-empresa e LGPD avançado; SLA 99,9% e suporte 24/7; onboarding dedicado."],
  ],
  [1500, 1900, 2760, 3200]
));

add(H2("5.3 Tabela de preços — módulos por usuário"));
add(P("Vale para Performance, Learning e Project Management. Preço por usuário/mês, em reais. O preço é o mesmo entre esses módulos para um dado plano/ciclo/faixa. O ciclo anual aplica −15% sobre o mensal (já refletido na coluna “anual”)."));
add(TABLE(
  ["Faixa de usuários", "Basic mensal", "Basic anual", "Profis. mensal", "Profis. anual", "Expert mensal", "Expert anual"],
  [
    ["1 a 10", "14,90", "12,67", "24,90", "21,17", "38,90", "33,07"],
    ["11 a 25", "13,70", "11,65", "23,70", "20,15", "37,70", "32,05"],
    ["26 a 50", "12,60", "10,71", "22,60", "19,21", "36,60", "31,11"],
    ["51 a 100", "11,50", "9,78", "21,50", "18,28", "35,50", "30,18"],
    ["101 ou mais", "10,50", "8,93", "20,50", "17,43", "34,50", "29,33"],
  ],
  [1860, 1250, 1250, 1250, 1250, 1250, 1250]
));
add(P("Valores anuais exibidos arredondados para 2 casas; o cálculo usa o valor exato (mensal × 0,85).", { italics: true, color: GREY, size: 19 }));

add(H2("5.4 Tabela de preços — Hiring (por posição)"));
add(P("Hiring é cobrado por posição/vaga, isoladamente (não combina no desconto de pacote). Preço por posição/mês, em reais."));
add(TABLE(
  ["Faixa de posições", "Basic mensal", "Basic anual", "Profis. mensal", "Profis. anual", "Expert mensal", "Expert anual"],
  [
    ["1 a 2", "249,90", "212,42", "299,90", "254,92", "349,90", "297,42"],
    ["3 a 4", "239,90", "203,92", "289,90", "246,42", "339,90", "288,92"],
    ["5 a 8", "229,90", "195,42", "279,90", "237,92", "329,90", "280,42"],
    ["9 ou mais", "219,90", "186,92", "269,90", "229,42", "319,90", "271,92"],
  ],
  [1860, 1250, 1250, 1250, 1250, 1250, 1250]
));
add(CALLOUT("Regra de limite", "No cadastro/calculadora, a quantidade de posições do Hiring deve ser limitada a 8 (a faixa “9 ou mais” existe na tabela, mas a interface restringe a entrada a no máximo 8 posições). Esse limite deve ser parametrizável."));

add(H2("5.5 Regras de cálculo"));
add(REQ("RNG-01", "Duas partes independentes", "O total é a soma de duas partes que se somam: (a) parte por usuário (Performance/Learning/Project Management) e (b) parte por posição (Hiring). Cada parte tem preço unitário, quantidade e total próprios."));
add(REQ("RNG-02", "Faixa por quantidade", "O preço unitário é determinado pela faixa em que a quantidade se enquadra (ver 5.3/5.4). A faixa superior não tem teto."));
add(REQ("RNG-03", "Desconto anual", "O ciclo anual aplica −15% sobre o preço mensal correspondente."));
add(REQ("RNG-04", "Desconto de pacote (múltiplos módulos por usuário)", "Quando há mais de um módulo por usuário, o módulo de maior subtotal é o “âncora” e é cobrado no plano escolhido; os demais módulos por usuário são cobrados no preço do plano Basic da mesma faixa/ciclo. O preço por usuário é a soma desses unitários, multiplicado pela quantidade de usuários. Hiring nunca participa do pacote."));
add(REQ("RNG-05", "Sob consulta", "Um preço igual a zero significa “sob consulta”. Nesse caso, a parte correspondente é marcada como “sob consulta”, a UI exibe esse estado e ainda permite iniciar o trial. (Mecanismo mantido; sem casos ativos na tabela atual.)"));
add(REQ("RNG-06", "Snapshot na assinatura", "Ao criar a assinatura/trial, os preços unitários e o total calculados devem ser gravados como snapshot na assinatura, junto com quantidades, módulos, plano e ciclo."));
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 6. INTEGRAÇÕES
// ============================================================
add(H1("6. Integrações externas"));

add(H2("6.1 Provedores de IA"));
add(
  BUL([T("Anthropic (Claude)", { bold: true }), T(" e "), T("OpenAI (GPT)", { bold: true }), T(" como provedores mínimos, atrás de uma abstração comum (streaming, validação de chave e catálogo de modelos), de modo a permitir adicionar novos provedores sem reescrever o domínio.")]),
  BUL("Streaming de texto incremental; uso de cache de prompt quando suportado, para reduzir custo/latência."),
  BUL("Modelo padrão e por-agente configuráveis; o modelo escolhido deve ser compatível com o provedor BYOK da empresa."),
);
add(H2("6.2 Gateway de pagamento (Iugu)"));
add(
  BUL("Cobrança recorrente por Pix, boleto e cartão; criação de cliente e assinatura; cancelamento; e recepção de webhooks de status."),
  BUL("Evolução: emissão de NF-e."),
  BUL("A assinatura registra método de pagamento e referência do objeto no gateway."),
);
add(H2("6.3 Slack (OAuth) — piloto de conector real"));
add(
  BUL("Fluxo OAuth 2 completo: URL de autorização com state assinado e expirável; callback troca código por token; token armazenado criptografado por empresa, com teamId/teamName/escopos."),
  BUL("Operações reais com o token do tenant: listar canais, enviar mensagem."),
  BUL("Serve de molde para os demais conectores reais do catálogo."),
);
add(H2("6.4 Servidor MCP"));
add(
  BUL("Endpoint HTTP de MCP autenticado por chave de API por empresa; ferramentas escopadas ao tenant (ver 4.8)."),
  BUL("Distribuível a clientes externos de IA como produto."),
);
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 7. MODELO DE DOMÍNIO (conceitual)
// ============================================================
add(H1("7. Modelo de domínio (conceitual)"));
add(P("Modelo conceitual das entidades e atributos que a solução deve suportar. A modelagem física (tabelas, índices, tipos) é decisão da CEIA; os nomes abaixo são ilustrativos. Salvo indicação, toda entidade operacional pertence a uma Empresa (tenant)."));

const ENT = (name, note, rows) => {
  add(new Paragraph({ spacing: { before: 140, after: 40 }, children: [new TextRun({ text: name, bold: true, color: NAVY, size: 24 })] }));
  if (note) add(P(note, { italics: true, color: GREY, size: 19 }));
  add(TABLE(["Atributo", "Tipo / valores", "Observações"], rows, [2400, 2760, 4200]));
};

ENT("Empresa (tenant)", "Cliente da plataforma.", [
  ["tipoPessoa", "pj | pf", "Define campos exigidos."],
  ["documento", "texto", "CNPJ ou CPF, validado."],
  ["razaoSocial / nomeFantasia", "texto", "nomeFantasia só PJ."],
  ["plano", "basico | profissional | corporativo", "Plano contratado."],
  ["ciclo", "mensal | anual", "Ciclo de cobrança."],
  ["modulos", "lista de módulos", "Módulos contratados."],
  ["setor", "texto (lista controlada)", "Setor de atuação."],
  ["onboardingConcluidoEm", "data/hora", "Marca fim do onboarding."],
  ["criadoEm", "data/hora", "Auditoria."],
]);

ENT("Usuário", "Pessoa vinculada a uma empresa.", [
  ["nome / email / telefone", "texto", "E-mail único na plataforma."],
  ["senha", "hash forte", "Nunca armazenar em texto puro."],
  ["avatarUrl", "texto", "Opcional."],
  ["role", "owner | admin | membro", "Papel/permite autorização."],
  ["trialStartsAt / trialEndsAt", "data/hora", "Janela de trial."],
]);

ENT("Convite", "Convite pendente para ingressar na empresa.", [
  ["email", "texto", "Destinatário."],
  ["role", "owner | admin | membro", "Papel proposto."],
  ["status", "pendente | aceito", "Ciclo do convite."],
  ["unicidade", "(empresa, email)", "Sem duplicidade por empresa."],
]);

ENT("Assinatura", "Estado comercial da empresa.", [
  ["plano / ciclo / modulos", "—", "Espelham a contratação."],
  ["status", "trial | ativa | inadimplente | expirada | cancelada", "Estado atual."],
  ["usuarios / posicoes", "inteiro", "Quantidades contratadas."],
  ["precoUsuario / precoPosicao / total", "decimal", "Snapshot de preços."],
  ["sobConsulta", "booleano", "Preço a definir."],
  ["trialStartsAt / trialEndsAt / ativadaEm", "data/hora", "Datas-chave."],
  ["metodoPagamento", "pix | cartao | boleto", "Quando ativa."],
  ["gatewayRef", "texto", "Referência no gateway."],
]);

ENT("Conexão de IA (BYOK)", "Uma por empresa.", [
  ["provider", "anthropic | openai", "Provedor."],
  ["model", "texto", "Modelo padrão."],
  ["apiKey", "criptografada (em repouso)", "Write-only; nunca devolvida."],
  ["keyLast4", "texto", "Exibição."],
  ["status", "ativa | invalida", "Resultado da validação."],
  ["validatedAt", "data/hora", "Última validação."],
]);

ENT("Squad / Agente / Pergunta-modelo", "Catálogo global (não por empresa).", [
  ["Squad: id, slug, title, icon, description", "—", "Identificador estável."],
  ["Squad: order, active", "—", "Curadoria/ordenação."],
  ["Agente: position, reference, who, contribution", "texto", "Persona."],
  ["Agente: prompt", "texto longo", "System prompt do agente."],
  ["Agente: model", "texto (opcional)", "Override de modelo."],
  ["Pergunta-modelo: text, order", "—", "Starter questions."],
  ["SquadPin", "(usuário, squad)", "Fixação por usuário."],
]);

ENT("Conversa / Mensagem", "Histórico de chat por usuário.", [
  ["Conversa: squadId, agentId?", "—", "Squad e (opcional) agente."],
  ["Conversa: titulo, datas", "—", "Organização."],
  ["Conversa: agrupamento", "referência (opcional)", "“Projeto” do usuário."],
  ["Mensagem: role", "user | assistant", "Turno."],
  ["Mensagem: conteudo, criadoEm", "—", "Texto e data."],
]);

ENT("Memória", "Conhecimento de longo prazo da IA.", [
  ["categoria", "slug de squad | estrategico | hierarquico | historico", "Tema."],
  ["titulo / conteudo / origem", "texto", "O fato e sua fonte."],
  ["confianca", "alta | media | baixa", "Peso/precedência."],
  ["ativa", "booleano", "Entra no contexto se ativa."],
  ["corporativa", "booleano", "Read-only para membros."],
  ["aprendidaEm", "data/hora", "Data do aprendizado."],
]);

ENT("Conector da empresa", "Estado de integração por empresa.", [
  ["connectorId", "texto", "Item do catálogo."],
  ["origem", "app | mcp | oauth", "Como foi conectado."],
  ["accessToken", "criptografado (opcional)", "Para conectores OAuth."],
  ["teamId / teamName / scopes", "texto (opcional)", "Workspace e escopos."],
  ["unicidade", "(empresa, connectorId)", "Um estado por conector."],
]);

ENT("Chave de API MCP", "Credencial de cliente externo.", [
  ["nome", "texto", "Rótulo da chave."],
  ["hash", "hash (único)", "Nunca armazenar a chave em texto."],
  ["last4", "texto", "Exibição."],
  ["criadoEm / lastUsedAt / revogadaEm", "data/hora", "Ciclo de vida."],
]);

ENT("Documento gerado", "Artefato produzido pela IA.", [
  ["squadId", "referência", "Squad de origem."],
  ["titulo / tipo", "texto", "Ex.: relatório, resumo."],
  ["conteudo / url", "texto", "Inline ou referência."],
  ["data", "data/hora", "Geração."],
]);
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 8. CONTRATOS DE API (funcional)
// ============================================================
add(H1("8. Capacidades de API (nível funcional)"));
add(P("A lista abaixo descreve as capacidades que a API deve oferecer, em nível funcional. Verbos/caminhos são sugestões (referência do protótipo); a CEIA define o desenho final (REST/GraphQL, versionamento, paginação). Salvo indicação, exigem autenticação e respeitam o escopo de tenant e papel."));

const API = (group, rows) => {
  add(H2(group));
  add(TABLE(["Operação (ref.)", "Autorização", "Função"], rows, [3100, 2060, 4200]));
};

API("8.1 Autenticação e empresa", [
  ["POST /login", "Pública (rate-limited)", "Autentica e retorna token + perfil."],
  ["GET /user/profile", "Autenticado", "Perfil do usuário atual."],
  ["POST /cadastro", "Pública (rate-limited)", "Cria empresa + owner + trial; autentica."],
  ["GET /cadastro/email-disponivel", "Pública (rate-limited)", "Verifica disponibilidade de e-mail."],
  ["GET /empresa", "Autenticado", "Dados do tenant."],
  ["GET/POST/DELETE /empresa/convites", "Autenticado (POST/DELETE: admin/owner)", "Lista, cria e remove convites."],
  ["POST /empresa/onboarding/concluir", "Autenticado", "Conclui onboarding."],
]);

API("8.2 IA: conexão e chat", [
  ["GET /ai/providers", "Autenticado", "Catálogo de provedores/modelos."],
  ["GET/PUT/DELETE /ai/connection", "Autenticado (admin/owner)", "Lê/define/remove conexão BYOK; PUT valida a chave."],
  ["POST /ai/chat/stream", "Autenticado", "Chat com IA em streaming; cria/continua conversa."],
]);

API("8.3 Squads e conversas", [
  ["GET /squads", "Autenticado", "Catálogo leve de squads."],
  ["GET /squads/:id", "Autenticado", "Detalhe com agentes e perguntas-modelo."],
  ["GET /conversas", "Autenticado", "Histórico do usuário."],
  ["GET /conversas/:id", "Autenticado", "Conversa com mensagens."],
  ["DELETE /conversas/:id", "Autenticado", "Exclui conversa."],
]);

API("8.4 Memória", [
  ["GET /memorias", "Autenticado", "Lista memórias da empresa."],
  ["POST /memorias", "Autenticado", "Cria memória (corporativa só admin/owner)."],
  ["PATCH /memorias/:id", "Autenticado", "Edita parcial (inclui ativar). 403 em corporativa para membro."],
  ["DELETE /memorias/:id", "Autenticado", "Exclui (403 em corporativa para membro)."],
]);

API("8.5 Conectores, Slack e MCP", [
  ["GET /conectores[/categorias|/:id]", "Autenticado", "Catálogo e estado por empresa."],
  ["POST /conectores/:id/conectar", "Autenticado", "Conecta (idempotente)."],
  ["DELETE /conectores/:id", "Autenticado", "Desconecta."],
  ["GET /conectores/slack/autorizar", "Autenticado", "URL de autorização OAuth."],
  ["GET /conectores/slack/callback", "Pública (state assinado)", "Callback OAuth; salva token cifrado."],
  ["POST /mcp", "Chave de API da empresa", "Endpoint MCP (ferramentas escopadas)."],
  ["GET/POST/DELETE /mcp/keys", "Autenticado (admin/owner)", "Gerencia chaves de API MCP."],
]);

API("8.6 Conteúdo e saúde", [
  ["Feed / Insights / Relatórios", "Autenticado", "Listagem, detalhe e interações (curtir/comentar/compartilhar)."],
  ["GET /health", "Pública", "Verificação de saúde do serviço."],
]);
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 9. REQUISITOS NÃO-FUNCIONAIS
// ============================================================
add(H1("9. Requisitos não-funcionais"));

add(H2("9.1 Segurança"));
add(REQ("RNF-01", "Autenticação e autorização", "Tokens de sessão assinados com segredo forte e expiração configurável. Autorização por papel e por tenant verificada no servidor a cada requisição, com o papel obtido da fonte de verdade (não apenas do token)."));
add(REQ("RNF-02", "Hash de senhas", "Senhas armazenadas com algoritmo de hash adaptativo (ex.: bcrypt/argon2). Comparações resistentes a temporização."));
add(REQ("RNF-03", "Segredos criptografados em repouso", "Chaves de IA (BYOK) e tokens OAuth devem ser criptografados em repouso com cifra autenticada (ex.: AES-256-GCM). Em produção, a chave-mestra deve residir em um cofre/KMS gerenciado, com rotação."));
add(REQ("RNF-04", "Chaves write-only e hash de chaves de API", "Chaves de IA nunca são retornadas após salvas. Chaves de API MCP são guardadas apenas como hash; a chave crua aparece uma única vez."));
add(REQ("RNF-05", "Proteções de borda", "Cabeçalhos de segurança HTTP, CORS restrito às origens autorizadas, rate limiting (mais estrito em login/cadastro), validação e sanitização de toda entrada, e tratamento de erro padronizado sem vazar detalhes internos."));
add(REQ("RNF-06", "State assinado em OAuth", "Fluxos OAuth devem usar state assinado e expirável para evitar CSRF; tokens trocados server-side."));

add(H2("9.2 Privacidade e conformidade (LGPD)"));
add(REQ("RNF-10", "LGPD", "Tratar dados pessoais conforme a LGPD: base legal, minimização, consentimento quando aplicável, e direitos do titular (acesso, correção, exclusão). Suportar exclusão/anonimização de dados de uma empresa e de um usuário."));
add(REQ("RNF-11", "Retenção e auditoria", "Definir políticas de retenção e manter trilha de auditoria de ações sensíveis (login, mudança de papel, billing, geração/revogação de chaves, conexões)."));
add(REQ("RNF-12", "Confidencialidade do conteúdo de IA", "Conversas, memórias e documentos são confidenciais do tenant. O uso de provedores de IA deve respeitar políticas de não-treinamento/retenção quando aplicável."));

add(H2("9.3 Desempenho e escalabilidade"));
add(REQ("RNF-20", "Streaming responsivo", "O primeiro token da resposta de IA deve começar a ser exibido rapidamente após o envio (meta: poucos segundos), com fluxo contínuo e cancelável."));
add(REQ("RNF-21", "Escala horizontal", "Backend stateless, escalável horizontalmente; o banco e a camada de IA não devem ser gargalos sob carga concorrente de múltiplos tenants."));
add(REQ("RNF-22", "Tempos de resposta", "Operações de leitura típicas (listagens) devem responder em tempo interativo (meta: < 500 ms no p95, excluída a latência do provedor de IA)."));

add(H2("9.4 Disponibilidade e operação"));
add(REQ("RNF-30", "Disponibilidade", "Alvo de disponibilidade compatível com SaaS; o plano Expert promete SLA de 99,9%. Prever redundância e ausência de ponto único de falha nos componentes críticos."));
add(REQ("RNF-31", "Observabilidade", "Logs estruturados, métricas e rastreamento distribuído; alertas para erros e degradação; verificação de saúde."));
add(REQ("RNF-32", "Backups e recuperação", "Backups regulares com testes de restauração e objetivos definidos de RPO/RTO."));
add(REQ("RNF-33", "Migrações e ambientes", "Migrações de banco versionadas e reversíveis; ambientes isolados de desenvolvimento, homologação e produção; pipeline de CI/CD."));

add(H2("9.5 Experiência, acessibilidade e i18n"));
add(REQ("RNF-40", "Responsividade", "Interface web responsiva (desktop e mobile-web), com suporte a tema claro/escuro."));
add(REQ("RNF-41", "Acessibilidade", "Aderência às diretrizes WCAG 2.1 AA nos fluxos principais (navegação por teclado, contraste, leitores de tela)."));
add(REQ("RNF-42", "Internacionalização", "Idioma principal Português (Brasil), com arquitetura preparada para múltiplos idiomas e formatação localizada (moeda BRL, datas)."));
add(REQ("RNF-43", "Navegadores", "Suporte às versões recentes dos principais navegadores (Chrome, Edge, Firefox, Safari)."));

add(H2("9.6 Manutenibilidade"));
add(REQ("RNF-50", "Qualidade de código", "Tipagem estática, padrões de lint/formatação, testes automatizados (unitários e de integração) cobrindo regras de negócio críticas (precificação, autorização, isolamento de tenant)."));
add(REQ("RNF-51", "Documentação", "Documentação de API e de operação (setup, variáveis de ambiente, deploy)."));
add(REQ("RNF-52", "Parametrização", "Catálogos (squads, conectores), preços e limites (ex.: dias de trial, máximo de posições) devem ser administráveis sem novo deploy sempre que possível."));
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 10. PREMISSAS / FASEAMENTO
// ============================================================
add(H1("10. Premissas, restrições e faseamento"));
add(H2("10.1 Premissas e restrições"));
add(
  BUL("O site comercial (planos e marketing) é externo ao app e encaminha ao cadastro com o plano pré-selecionado."),
  BUL("O cadastro permite escolher módulo(s); o termo correto para a base de cobrança é “usuários” (Hiring usa “posições”)."),
  BUL("O provedor de IA é, por padrão, da própria empresa (BYOK); a plataforma só custeia IA durante o trial."),
  BUL("Idioma e moeda padrão: Português (Brasil) e Real (BRL)."),
);
add(H2("10.2 Faseamento sugerido (não-vinculante)"));
add(TABLE(
  ["Fase", "Escopo"],
  [
    ["1 — Fundações", "Multi-tenancy, autenticação/papéis, cadastro/trial, onboarding, billing com gateway (Pix/cartão/boleto), paywall."],
    ["2 — Núcleo de IA", "Catálogo de squads/agentes, chat em streaming, histórico/agrupamentos, memória de longo prazo, IA por tenant (BYOK) + fallback de trial."],
    ["3 — Integrações", "Catálogo de conectores, OAuth (Slack como piloto), servidor MCP com chaves por empresa."],
    ["4 — Conteúdo e analytics", "Feed, insights, relatórios, documentos gerados; área administrativa de catálogos e preços."],
    ["5 — Evoluções", "SSO/SAML (Expert), NF-e, OAuth no MCP, novos conectores e módulos de negócio aprofundados."],
  ],
  [1700, 7660]
));
add(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// ANEXOS
// ============================================================
add(H1("Anexo A — Arquitetura de referência do protótipo (não-vinculante)"));
add(P("Resumo da implementação do MVP existente, fornecido como referência de comportamento. Não vincula a CEIA, exceto pela stack de frontend, que é obrigatória (ver Seção 3.1): React 19, Tailwind CSS e JavaScript/TypeScript."));
add(TABLE(
  ["Camada", "Tecnologia de referência", "Notas"],
  [
    ["Frontend", "React 19 + Vite + TypeScript + Tailwind CSS", "SPA responsiva; estado via Context API; gráficos com ApexCharts; formulários com React Hook Form + Yup."],
    ["Backend", "NestJS 11 + TypeScript", "API modular; guards de autenticação/papel; rate limiting; helmet."],
    ["Banco de dados", "PostgreSQL + Prisma (ORM)", "Multi-tenant; migrações versionadas; seeds de catálogo."],
    ["IA", "SDKs Anthropic e OpenAI", "Abstração de provedor; streaming SSE; cache de prompt."],
    ["Criptografia", "AES-256-GCM (Node crypto)", "Chaves BYOK e tokens OAuth; chave-mestra por variável de ambiente (migrar para KMS)."],
    ["MCP", "SDK oficial de MCP (HTTP stateless)", "Autenticação por chave de API por empresa."],
    ["Integrações", "Slack OAuth (piloto)", "State assinado; tokens cifrados por empresa."],
    ["Infra (dev)", "Docker Compose (Postgres)", "Ambientes separados previstos para produção."],
  ],
  [1700, 3460, 4200]
));
add(P("Variáveis de ambiente relevantes do protótipo (referência): conexão de banco; segredo e expiração de token; chave de criptografia (32 bytes); chave de IA gerenciada do trial e modelo padrão; credenciais e URLs de OAuth do Slack; URL do frontend; e token do gateway de pagamento (fase 2).", { size: 19, color: GREY }));
add(new Paragraph({ children: [new PageBreak()] }));

add(H1("Anexo B — Catálogo de conectores (categorias)"));
add(P("Catálogo de referência (50+ conectores). As marcas são citadas como destinos de integração."));
add(TABLE(
  ["Categoria", "Exemplos de conectores"],
  [
    ["Comunicação", "Microsoft Teams, Slack, Zoom, WhatsApp Business, LinkedIn, Facebook, Instagram"],
    ["Identidade & Acessos", "Azure AD, Okta, LDAP"],
    ["RH & Folha", "SAP SuccessFactors, Oracle HCM, TOTVS RM, Senior, LG, Sólides, Convenia, Apdata, PontoMais, ADP"],
    ["Recrutamento", "Gupy, Kenoby, LinkedIn Recruiter, Catho, Indeed, InfoJobs"],
    ["Produtividade & Projetos", "Google Workspace, ClickUp, Jira, Trello, Monday, Asana, Notion, Miro, Figma"],
    ["BI & Analytics", "Power BI, Tableau, Looker Studio"],
    ["Automação", "Zapier, Make, Pluga"],
    ["CRM & Marketing", "HubSpot, Salesforce, Pipedrive, RD Station"],
    ["Atendimento", "Zendesk, Freshdesk"],
    ["Assinatura & Documentos", "DocuSign, Clicksign"],
    ["Financeiro & Pagamentos", "Stripe, Omie, Conta Azul"],
    ["Conteúdo", "Vimeo, YouTube"],
  ],
  [2600, 6760]
));
add(P("Cada conector define: nome, categoria, objetivo (proposta de valor), permissões, marca (cor) e iniciais. As permissões orientam recursos como o compartilhamento (conectores que “enviam mensagem/publicam”).", { size: 19, color: GREY }));
add(new Paragraph({ children: [new PageBreak()] }));

add(H1("Anexo C — Squads e memória"));
add(P("O catálogo de referência contém 15 squads, cada um com 5 agentes (75 personas no total) e cerca de 10 perguntas-modelo por squad (~150). Os squads são temáticos (ex.: Cultura, Comunicação Interna, Gestão de Pessoas, Processos, RH, Financeiro, Dados, entre outros) e cada agente tem um prompt/sistema próprio que define sua persona e especialidade."));
add(P("Os temas de memória derivam diretamente do catálogo de squads (um tema por squad, pelo slug) somados aos três temas transversais fixos:"));
add(
  BUL([T("Estratégico", { bold: true }), T(" — visão, posicionamento e decisões de direção (maior precedência).")]),
  BUL([T("Hierárquico", { bold: true }), T(" — estrutura organizacional e papéis.")]),
  BUL([T("Histórico", { bold: true }), T(" — contexto acumulado ao longo do tempo.")]),
);
add(P("Na injeção de contexto da IA, a precedência é: Estratégica > Hierárquica > Categoria (tema do squad) > Histórica, filtrando pelo tema do squad em uso e ordenando por confiança.", { size: 19, color: GREY }));

// fechamento
add(SPACER(200));
add(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 200 },
  children: [new TextRun({ text: "— Fim do documento —", italics: true, color: GREY })],
}));

// ============================================================
// DOCUMENTO
// ============================================================
const doc = new Document({
  creator: "beculture",
  title: "Especificação Técnica — beculture (CEIA)",
  description: "Requisitos de produto para desenvolvimento da versão definitiva",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: "Calibri", size: 21, color: "222222" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: NAVY, font: "Calibri" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 6 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: BLUE, font: "Calibri" },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "333333", font: "Calibri" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1020, hanging: 280 } } } },
      ] },
      { reference: "nums", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } },
      ] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D5DEE8", space: 4 } },
        children: [new TextRun({ text: "Especificação Técnica · beculture", size: 16, color: "8A97A6" })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        spacing: { before: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D5DEE8", space: 4 } },
        tabStops: [{ type: "right", position: CONTENT_W }],
        children: [
          new TextRun({ text: "Confidencial — para a CEIA", size: 16, color: "8A97A6" }),
          new TextRun({ text: "\t", size: 16 }),
          new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: 16, color: "8A97A6" }),
        ],
      })] }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/Users/roansantos/Documents/Claude/tailux/Documentation/Especificacao-Tecnica-beculture-CEIA.docx";
  fs.writeFileSync(out, buf);
  console.log("OK ->", out, "(" + buf.length + " bytes)");
});
