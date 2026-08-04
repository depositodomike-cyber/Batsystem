// Gerador da apresentação para o fornecedor (CEIA).
// Fonte de verdade do conteúdo: Especificacao-Tecnica-beculture-CEIA.docx (gen-spec.js).
// Rodar: NODE_PATH="$(npm root -g)" node gen-deck.js
const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
pres.author = "beculture";
pres.company = "beculture";
pres.title = "beculture — Especificação para Desenvolvimento (CEIA)";

// ---- Paleta oficial beculture (Brand Guidelines · amber + slate + branco) ----
// Amber 400 é a primária; texto pequeno sobre fundo claro fica em slate (contraste),
// o amber entra como preenchimento/bloco e como texto sobre fundo escuro (combo-herói).
const SLATE9 = "0F172B"; // Slate 900 — estrutura / fundo escuro
const SLATE8 = "1E293B"; // Slate 800 — cards sobre fundo escuro
const SLATE7 = "334155"; // Slate 700 — bordas/chips no escuro, accent neutro
const SLATE6 = "475569"; // Slate 600 — texto-accent legível no claro
const SLATE5 = "64748B"; // Slate 500 — texto secundário
const SLATE4 = "94A3B8"; // Slate 400 — texto sutil / limites
const SLATE3 = "CBD5E1"; // Slate 300 — texto secundário no escuro
const SLATE2 = "E2E8F0"; // Slate 200 — linhas/bordas
const SLATE1 = "F8FAFC"; // Slate 50 — fundo claro de conteúdo
const WHITE = "FFFFFF";
const AMBER = "FFCA28"; // Amber 400 — primária / accent
const AMBER6 = "FFB300"; // Amber 600 — dark / hover

// aliases compatíveis com o restante do script, mapeados à paleta da marca
const INK = SLATE9;
const NAVY = SLATE9;
const NAVY2 = SLATE7;
const STEEL = SLATE7;
const ICE = SLATE1;
const CLOUD = WHITE;
const LINE = SLATE2;
const MIST = SLATE5;
const SUB = SLATE4;
const ACC = AMBER;
const ACC_D = SLATE6; // "accent text" no claro → slate legível
const GOLD = AMBER;
const ICEBLUE = SLATE3;

const HF = "Plus Jakarta Sans"; // display (títulos, headlines) — fonte oficial
const BF = "Inter"; // corpo — fonte oficial

const W = 13.33,
  H = 7.5,
  M = 0.62;

const shadow = () => ({ type: "outer", color: SLATE9, blur: 9, offset: 3, angle: 135, opacity: 0.16 });

// ---------- helpers ----------
function footer(slide, n, dark) {
  const c = dark ? SUB : SUB;
  slide.addText("beculture · Especificação para Desenvolvimento — CEIA", {
    x: M, y: H - 0.42, w: 9, h: 0.3, fontFace: BF, fontSize: 9, color: c, align: "left",
  });
  slide.addText(String(n).padStart(2, "0"), {
    x: W - M - 0.8, y: H - 0.42, w: 0.8, h: 0.3, fontFace: BF, fontSize: 9, color: c, align: "right",
  });
}

// Cabeçalho padrão de slide claro: kicker (accent) + título
function head(slide, kicker, title) {
  slide.addShape(pres.shapes.RECTANGLE, { x: M, y: 0.6, w: 0.28, h: 0.16, fill: { color: ACC } });
  slide.addText(kicker.toUpperCase(), {
    x: M + 0.4, y: 0.52, w: 11, h: 0.32, fontFace: BF, fontSize: 12, bold: true, color: ACC_D, charSpacing: 2,
  });
  slide.addText(title, {
    x: M, y: 0.9, w: W - 2 * M, h: 0.7, fontFace: HF, fontSize: 27, bold: true, color: NAVY,
  });
}

function lightSlide(kicker, title) {
  const s = pres.addSlide();
  s.background = { color: ICE };
  head(s, kicker, title);
  return s;
}

// Card retangular com barra de accent à esquerda
function accentCard(slide, x, y, w, h, accent) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: CLOUD }, line: { color: LINE, width: 1 }, shadow: shadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.09, h, fill: { color: accent } });
}

// =====================================================================
// 1. CAPA
// =====================================================================
(function cover() {
  const s = pres.addSlide();
  s.background = { color: INK };
  // banda decorativa direita: núcleo + módulos (eco da tese)
  s.addShape(pres.shapes.RECTANGLE, { x: W - 3.5, y: 0, w: 3.5, h: H, fill: { color: SLATE8 } });
  s.addShape(pres.shapes.OVAL, { x: W - 2.55, y: 2.55, w: 1.5, h: 1.5, fill: { color: AMBER } });
  s.addText("IA", { x: W - 2.55, y: 2.55, w: 1.5, h: 1.5, align: "center", valign: "middle", fontFace: HF, fontSize: 24, bold: true, color: SLATE9 });
  const sat = [[W - 3.15, 1.2], [W - 1.05, 1.45], [W - 0.7, 3.55], [W - 1.2, 5.4], [W - 3.2, 5.0]];
  sat.forEach(([cx, cy]) => {
    s.addShape(pres.shapes.LINE, { x: W - 1.8, y: 3.3, w: cx - (W - 1.8) + 0.3, h: cy - 3.3 + 0.3, line: { color: SLATE6, width: 1.25 } });
  });
  sat.forEach(([cx, cy]) => {
    s.addShape(pres.shapes.OVAL, { x: cx, y: cy, w: 0.6, h: 0.6, fill: { color: ICEBLUE } });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 1.55, w: 0.5, h: 0.14, fill: { color: ACC } });
  s.addText("ESPECIFICAÇÃO TÉCNICA · DOCUMENTO DE REQUISITOS", {
    x: M, y: 1.78, w: 8.4, h: 0.35, fontFace: BF, fontSize: 13, bold: true, color: ICEBLUE, charSpacing: 2,
  });
  s.addText([
    { text: "be", options: { color: AMBER } },
    { text: "culture", options: { color: WHITE } },
    { text: ".", options: { color: AMBER } },
  ], { x: M - 0.03, y: 2.25, w: 9, h: 1.1, fontFace: HF, fontSize: 60, bold: true });
  s.addText("O que vamos construir com a CEIA", {
    x: M, y: 3.45, w: 8.6, h: 0.7, fontFace: HF, fontSize: 30, bold: true, color: WHITE,
  });
  s.addText("Business Partner de IA · SaaS B2B multi-tenant · Versão definitiva (produção)", {
    x: M, y: 4.25, w: 8.6, h: 0.5, fontFace: BF, fontSize: 16, color: ICEBLUE,
  });

  s.addShape(pres.shapes.LINE, { x: M, y: 5.55, w: 8.4, h: 0, line: { color: STEEL, width: 1 } });
  s.addText([
    { text: "Apresentação ao fornecedor de desenvolvimento", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "Junho / 2026", options: { color: SUB } },
  ], { x: M, y: 5.7, w: 8.4, h: 0.7, fontFace: BF, fontSize: 14 });
})();

// =====================================================================
// 2. A IDEIA CENTRAL (tese)
// =====================================================================
(function thesis() {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 0.85, w: 0.5, h: 0.14, fill: { color: ACC } });
  s.addText("A IDEIA CENTRAL", { x: M + 0.0, y: 1.05, w: 11, h: 0.4, fontFace: BF, fontSize: 14, bold: true, color: AMBER, charSpacing: 2 });

  s.addText([
    { text: "Não é um produto isolado. É a ", options: { color: WHITE } },
    { text: "plataforma-base de IA", options: { color: ACC } },
    { text: " da beculture.", options: { color: WHITE } },
  ], { x: M, y: 1.55, w: 12.0, h: 1.7, fontFace: HF, fontSize: 40, bold: true, lineSpacingMultiple: 1.0 });

  s.addText([
    { text: "A fundação — ", options: {} },
    { text: "squads de agentes, chat, memória de longo prazo e injeção de contexto", options: { bold: true, color: ICEBLUE } },
    { text: " — sobre a qual vamos evoluir IA em todos os módulos do negócio (Performance, Learning, Hiring e Project Management).", options: {} },
  ], { x: M, y: 3.5, w: 11.8, h: 1.1, fontFace: BF, fontSize: 18, color: ICEBLUE, lineSpacingMultiple: 1.1 });

  const chips = ["Reutilizável por módulo", "Multi-tenant por design", "Pronta para escalar"];
  chips.forEach((c, i) => {
    const x = M + i * 3.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.35, w: 3.45, h: 0.78, fill: { color: NAVY2 }, line: { color: STEEL, width: 1 }, rectRadius: 0.1 });
    s.addShape(pres.shapes.OVAL, { x: x + 0.28, y: 5.62, w: 0.24, h: 0.24, fill: { color: ACC } });
    s.addText(c, { x: x + 0.65, y: 5.35, w: 2.7, h: 0.78, valign: "middle", fontFace: BF, fontSize: 14, bold: true, color: WHITE });
  });
  footer(s, 2, true);
})();

// =====================================================================
// 3. O QUE É O BECULTURE
// =====================================================================
(function whatIs() {
  const s = lightSlide("Visão de produto", "O que é o beculture");
  s.addText("Um “business partner” de IA para empresas: um ambiente web onde líderes e equipes conversam com squads de especialistas de IA, recebem insights, consultam relatórios, conectam suas ferramentas e acumulam uma memória organizacional de longo prazo. Vendido como SaaS B2B multi-tenant, por assinatura de módulos, com trial self-service.", {
    x: M, y: 1.7, w: W - 2 * M, h: 0.95, fontFace: BF, fontSize: 15, color: MIST, lineSpacingMultiple: 1.05,
  });

  const cards = [
    ["Cockpit de IA", "Squads de agentes, chat com streaming, feed, insights, relatórios, memória da IA e conectores.", ACC],
    ["Módulos de negócio", "Performance, Learning, Hiring (recrutamento) e Project Management — vendáveis por assinatura.", NAVY2],
    ["Plataforma de integrações", "Catálogo de conectores corporativos + servidor MCP que clientes externos podem operar.", ACC],
    ["Camada comercial", "Cadastro, trial, onboarding, planos, precificação e cobrança via gateway.", NAVY2],
  ];
  const cw = (W - 2 * M - 3 * 0.4) / 4;
  cards.forEach(([t, d, a], i) => {
    const x = M + i * (cw + 0.4);
    const y = 2.95,
      h = 3.55;
    accentCard(s, x, y, cw, h, a);
    s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.28, y: y + 0.3, w: cw - 0.5, h: 0.5, fontFace: HF, fontSize: 22, bold: true, color: SLATE9 });
    s.addText(t, { x: x + 0.28, y: y + 0.95, w: cw - 0.5, h: 0.9, fontFace: HF, fontSize: 16, bold: true, color: NAVY });
    s.addText(d, { x: x + 0.28, y: y + 1.85, w: cw - 0.5, h: 1.5, fontFace: BF, fontSize: 12.5, color: MIST, lineSpacingMultiple: 1.05 });
  });
  footer(s, 3, false);
})();

// =====================================================================
// 4. O PEDIDO À CEIA
// =====================================================================
(function ask() {
  const s = lightSlide("O pedido", "O que pedimos à CEIA");
  // coluna esquerda: o pedido
  accentCard(s, M, 1.75, 6.0, 4.7, ACC);
  s.addText("Desenvolver a versão definitiva (produção)", { x: M + 0.35, y: 2.0, w: 5.4, h: 0.6, fontFace: HF, fontSize: 18, bold: true, color: NAVY });
  const pts = [
    "Existe um protótipo funcional (MVP) que valida todos os fluxos descritos — referência de comportamento e de experiência.",
    "Especificamos o QUÊ (regras de negócio, fluxos, domínio, integrações e qualidade), não o COMO interno.",
    "Stack de frontend é obrigatória; arquitetura de backend e infraestrutura ficam a critério técnico da CEIA.",
    "Entrega com qualidade e segurança de SaaS comercial.",
  ];
  s.addText(pts.map((t) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 10 } })), {
    x: M + 0.35, y: 2.7, w: 5.35, h: 3.6, fontFace: BF, fontSize: 14, color: MIST, lineSpacingMultiple: 1.05,
  });

  // coluna direita: como ler / faixas
  const x2 = M + 6.4;
  accentCard(s, x2, 1.75, W - M - x2, 4.7, NAVY2);
  s.addText("Como ler a especificação", { x: x2 + 0.35, y: 2.0, w: 5.4, h: 0.5, fontFace: HF, fontSize: 18, bold: true, color: NAVY });
  const rows = [
    ["RF-xx", "Requisitos funcionais — o que o sistema faz."],
    ["RNF-xx", "Requisitos não-funcionais — qualidade esperada."],
    ["Tabelas normativas", "Preços, planos e papéis: implementar exatamente."],
    ["Anexos", "Catálogos completos + arquitetura de referência."],
  ];
  rows.forEach(([k, v], i) => {
    const y = 2.65 + i * 0.92;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x2 + 0.35, y, w: 1.75, h: 0.62, fill: { color: ICE }, line: { color: LINE, width: 1 }, rectRadius: 0.06 });
    s.addText(k, { x: x2 + 0.35, y, w: 1.75, h: 0.62, align: "center", valign: "middle", fontFace: BF, fontSize: 13, bold: true, color: ACC_D });
    s.addText(v, { x: x2 + 2.3, y: y - 0.05, w: (W - M - x2) - 2.6, h: 0.72, valign: "middle", fontFace: BF, fontSize: 13, color: MIST, lineSpacingMultiple: 1.0 });
  });
  footer(s, 4, false);
})();

// =====================================================================
// 5. POR QUE ESTA BASE PRIMEIRO (diagrama núcleo -> módulos)
// =====================================================================
(function whyBase() {
  const s = lightSlide("A estratégia", "Por que esta base primeiro");
  s.addText("Squads, memória e injeção de contexto são construídos uma vez e reaproveitados por cada módulo. Cada novo módulo de negócio herda a inteligência da plataforma — não recomeça do zero.", {
    x: M, y: 1.65, w: W - 2 * M, h: 0.75, fontFace: BF, fontSize: 15, color: MIST, lineSpacingMultiple: 1.05,
  });

  // Núcleo (esquerda)
  const nx = M + 0.1,
    ny = 2.95,
    nw = 4.4,
    nh = 2.95;
  const ncy = ny + nh / 2;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: nx, y: ny, w: nw, h: nh, fill: { color: NAVY }, rectRadius: 0.12, shadow: shadow() });
  s.addText("NÚCLEO DE IA", { x: nx, y: ny + 0.35, w: nw, h: 0.4, align: "center", fontFace: BF, fontSize: 13, bold: true, color: ACC, charSpacing: 2 });
  s.addText("A plataforma-base desta entrega", { x: nx, y: ny + 0.75, w: nw, h: 0.4, align: "center", fontFace: HF, fontSize: 16, bold: true, color: WHITE });
  s.addText([
    { text: "Squads & agentes", options: { breakLine: true } },
    { text: "Chat em streaming", options: { breakLine: true } },
    { text: "Memória de longo prazo", options: { breakLine: true } },
    { text: "Injeção de contexto + BYOK", options: {} },
  ], { x: nx + 0.5, y: ny + 1.3, w: nw - 1.0, h: 1.4, align: "center", fontFace: BF, fontSize: 13, color: ICEBLUE, lineSpacingMultiple: 1.18 });

  // Módulos (direita, coluna vertical) + conectores em leque
  const mods = [
    ["Performance", "Avaliações, OKRs e 1:1s"],
    ["Learning", "Trilhas de aprendizagem e LMS"],
    ["Hiring", "Vagas, triagem e pipeline"],
    ["Project Management", "Projetos e tarefas"],
  ];
  const gx = 7.7,
    gw = W - M - gx,
    gy0 = 2.7,
    gh = 0.82,
    gstep = 1.0;
  const px = nx + nw,
    py = ncy;
  mods.forEach((_, i) => {
    const cyi = gy0 + gh / 2 + i * gstep;
    s.addShape(pres.shapes.LINE, { x: px, y: py, w: gx - px, h: cyi - py, line: { color: AMBER6, width: 2.5 } });
  });
  s.addShape(pres.shapes.OVAL, { x: px - 0.08, y: py - 0.08, w: 0.16, h: 0.16, fill: { color: ACC } });
  mods.forEach(([t, d], i) => {
    const cy = gy0 + i * gstep;
    s.addShape(pres.shapes.RECTANGLE, { x: gx, y: cy, w: gw, h: gh, fill: { color: CLOUD }, line: { color: LINE, width: 1 }, shadow: shadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: gx, y: cy, w: 0.07, h: gh, fill: { color: ACC } });
    s.addShape(pres.shapes.OVAL, { x: gx - 0.05, y: cy + gh / 2 - 0.05, w: 0.1, h: 0.1, fill: { color: ACC } });
    s.addText(t, { x: gx + 0.3, y: cy + 0.13, w: gw - 0.5, h: 0.34, fontFace: HF, fontSize: 14.5, bold: true, color: NAVY });
    s.addText(d, { x: gx + 0.3, y: cy + 0.45, w: gw - 0.5, h: 0.3, fontFace: BF, fontSize: 11.5, color: MIST });
  });
  s.addText("cada módulo herda a IA da plataforma — não recomeça do zero", { x: gx, y: gy0 + 4 * gstep - 0.1, w: gw, h: 0.4, fontFace: BF, fontSize: 11.5, italic: true, color: ACC_D, align: "center" });
  footer(s, 5, false);
})();

// =====================================================================
// 6. ESCOPO DA VERSÃO DEFINITIVA
// =====================================================================
(function scope() {
  const s = lightSlide("Escopo", "O que a versão definitiva entrega");
  const items = [
    "Cadastro self-service (PJ e PF), trial de 14 dias sem cartão e onboarding guiado.",
    "Autenticação, multi-tenancy com isolamento total por empresa e controle de papéis.",
    "Catálogo de squads/agentes e chat com IA em streaming, com histórico persistente.",
    "Memória de longo prazo da IA (corporativa e de usuário), injetada no contexto.",
    "Conectores corporativos com OAuth real e servidor MCP autenticado por chave de API.",
    "IA por tenant (BYOK), com fallback gerenciado durante o trial.",
    "Feed de conteúdo, insights e relatórios.",
    "Billing recorrente (Pix, cartão, boleto), faturas e controle de assinatura/paywall.",
  ];
  const cw = (W - 2 * M - 0.4) / 2;
  const ch = 1.05;
  items.forEach((t, i) => {
    const col = i % 2,
      row = Math.floor(i / 2);
    const x = M + col * (cw + 0.4);
    const y = 1.75 + row * (ch + 0.18);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: CLOUD }, line: { color: LINE, width: 1 }, shadow: shadow() });
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: y + 0.3, w: 0.45, h: 0.45, fill: { color: NAVY } });
    s.addText(String(i + 1), { x: x + 0.22, y: y + 0.3, w: 0.45, h: 0.45, align: "center", valign: "middle", fontFace: HF, fontSize: 15, bold: true, color: WHITE });
    s.addText(t, { x: x + 0.85, y: y, w: cw - 1.05, h: ch, valign: "middle", fontFace: BF, fontSize: 13, color: NAVY, lineSpacingMultiple: 1.0 });
  });
  footer(s, 6, false);
})();

// =====================================================================
// 7. FORA DE ESCOPO
// =====================================================================
(function outScope() {
  const s = lightSlide("Limites", "Fora de escopo nesta fase");
  const items = [
    ["Telas internas dos módulos de negócio", "Implementação aprofundada de Performance, Learning, Hiring e PM além do descrito. O foco é a plataforma de IA + camada comercial + base multi-tenant que sustenta os módulos."],
    ["Apps móveis nativos", "A aplicação é web responsiva (desktop e mobile-web)."],
    ["Emissão fiscal (NF-e)", "Prevista para evolução, integrada ao gateway de pagamento."],
  ];
  items.forEach(([t, d], i) => {
    const y = 1.85 + i * 1.55;
    accentCard(s, M, y, W - 2 * M, 1.35, SLATE4);
    s.addText(t, { x: M + 0.4, y: y + 0.2, w: 4.6, h: 0.95, valign: "middle", fontFace: HF, fontSize: 17, bold: true, color: NAVY });
    s.addShape(pres.shapes.LINE, { x: M + 5.2, y: y + 0.25, w: 0, h: 0.85, line: { color: LINE, width: 1 } });
    s.addText(d, { x: M + 5.5, y: y, w: W - 2 * M - 5.9, h: 1.35, valign: "middle", fontFace: BF, fontSize: 13.5, color: MIST, lineSpacingMultiple: 1.05 });
  });
  s.addText("Foco desta versão: a base de IA + comercial + multi-tenant que torna a evolução dos módulos rápida e barata.", {
    x: M, y: 6.55, w: W - 2 * M, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: ACC_D, align: "center",
  });
  footer(s, 7, false);
})();

// =====================================================================
// 8. PILARES FUNCIONAIS — NÚCLEO DE IA
// =====================================================================
(function pillars() {
  const s = lightSlide("Núcleo de IA", "Os pilares funcionais da plataforma");
  const cards = [
    ["Squads & agentes", "75", "agentes-persona", "15 squads × 5 agentes, cada um com prompt próprio e ~150 perguntas-modelo. Catálogo global, administrável; estado (fixados) por usuário."],
    ["Chat em streaming", "SSE", "token a token", "Conversa com squad ou agente; resposta em tempo real com cancelamento; histórico persistente, agrupamentos e documentos gerados."],
    ["Memória de longo prazo", "★", "diferencial", "Fatos que personalizam as respostas. Corporativa vs. de usuário, com níveis de confiança e injeção hierárquica no contexto."],
  ];
  const cw = (W - 2 * M - 2 * 0.4) / 3;
  cards.forEach(([t, big, lbl, d], i) => {
    const x = M + i * (cw + 0.4);
    const y = 1.8,
      h = 4.5;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h, fill: { color: CLOUD }, line: { color: LINE, width: 1 }, shadow: shadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.85, fill: { color: NAVY } });
    s.addText(t, { x: x + 0.3, y: y, w: cw - 0.6, h: 0.85, valign: "middle", fontFace: HF, fontSize: 16, bold: true, color: WHITE });
    s.addText(big, { x: x + 0.3, y: y + 1.05, w: cw - 0.6, h: 0.95, fontFace: HF, fontSize: 44, bold: true, color: ACC });
    s.addText(lbl.toUpperCase(), { x: x + 0.3, y: y + 1.95, w: cw - 0.6, h: 0.35, fontFace: BF, fontSize: 11, bold: true, color: MIST, charSpacing: 1 });
    s.addShape(pres.shapes.LINE, { x: x + 0.3, y: y + 2.45, w: cw - 0.6, h: 0, line: { color: LINE, width: 1 } });
    s.addText(d, { x: x + 0.3, y: y + 2.6, w: cw - 0.6, h: 1.7, fontFace: BF, fontSize: 12.5, color: MIST, lineSpacingMultiple: 1.08 });
  });
  footer(s, 8, false);
})();

// =====================================================================
// 9. MEMÓRIA DE LONGO PRAZO — diferencial
// =====================================================================
(function memory() {
  const s = lightSlide("O diferencial", "Memória de longo prazo da IA");
  s.addText("A base de conhecimento de longo prazo da IA sobre a empresa. É o ativo reutilizável que personaliza todos os squads — e, no futuro, todos os módulos.", {
    x: M, y: 1.65, w: W - 2 * M, h: 0.6, fontFace: BF, fontSize: 15, color: MIST, lineSpacingMultiple: 1.05,
  });

  // Esquerda: hierarquia de injeção
  const x1 = M;
  accentCard(s, x1, 2.5, 6.0, 3.85, ACC);
  s.addText("Injeção hierárquica no contexto", { x: x1 + 0.35, y: 2.7, w: 5.3, h: 0.45, fontFace: HF, fontSize: 16, bold: true, color: NAVY });
  s.addText("MAIOR PRECEDÊNCIA", { x: x1 + 1.05, y: 3.08, w: 4.5, h: 0.25, fontFace: BF, fontSize: 9, bold: true, color: ACC_D, charSpacing: 1 });
  const levels = [["Estratégica", "visão, posicionamento, direção"], ["Hierárquica", "estrutura e papéis"], ["Categoria", "tema do squad em uso"], ["Histórica", "contexto acumulado"]];
  // linha conectora vertical atrás das caixas numeradas
  s.addShape(pres.shapes.LINE, { x: x1 + 0.6, y: 3.6, w: 0, h: 3 * 0.72, line: { color: AMBER6, width: 2.5 } });
  levels.forEach(([t, d], i) => {
    const y = 3.35 + i * 0.72;
    s.addShape(pres.shapes.RECTANGLE, { x: x1 + 0.35, y, w: 0.5, h: 0.5, fill: { color: NAVY } });
    s.addText(String(i + 1), { x: x1 + 0.35, y, w: 0.5, h: 0.5, align: "center", valign: "middle", fontFace: HF, fontSize: 14, bold: true, color: WHITE });
    s.addText([{ text: t + "  ", options: { bold: true, color: NAVY } }, { text: "— " + d, options: { color: MIST } }], { x: x1 + 1.05, y, w: 4.7, h: 0.5, valign: "middle", fontFace: BF, fontSize: 13 });
  });

  // Direita: características
  const x2 = M + 6.4;
  const feats = [
    ["Corporativa vs. de usuário", "Corporativa é só-leitura para membros (admin/owner gerenciam). De usuário, editável por quem criou."],
    ["Confiança e ativação", "Cada item tem nível de confiança (alta/média/baixa); inativos não entram no contexto."],
    ["Temas dinâmicos", "Um tema por squad (via slug) + 3 transversais fixos: Estratégico, Hierárquico, Histórico."],
    ["Orçamento de contexto", "A UI estima o consumo de tokens por memória e o total das ativas."],
  ];
  const fw = W - M - x2;
  feats.forEach(([t, d], i) => {
    const y = 2.5 + i * 1.0;
    s.addShape(pres.shapes.RECTANGLE, { x: x2, y, w: fw, h: 0.85, fill: { color: CLOUD }, line: { color: LINE, width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x: x2, y, w: 0.07, h: 0.85, fill: { color: NAVY2 } });
    s.addText(t, { x: x2 + 0.25, y: y + 0.08, w: fw - 0.4, h: 0.35, fontFace: HF, fontSize: 13.5, bold: true, color: NAVY });
    s.addText(d, { x: x2 + 0.25, y: y + 0.42, w: fw - 0.4, h: 0.42, fontFace: BF, fontSize: 11.5, color: MIST, lineSpacingMultiple: 1.0 });
  });
  footer(s, 9, false);
})();

// =====================================================================
// 10. CONECTORES & MCP
// =====================================================================
(function connectors() {
  const s = lightSlide("Integrações", "Conectores e servidor MCP");
  const blocks = [
    ["Catálogo de conectores", "50+", "Conectores corporativos por categoria (comunicação, RH & folha, recrutamento, projetos, BI, CRM e mais). Estado conectado por empresa, com origem registrada (app, MCP ou OAuth)."],
    ["OAuth real — piloto Slack", "1→N", "Fluxo OAuth completo: state assinado, token cifrado por empresa, operações reais (listar canais, enviar mensagem). Molde para os demais conectores."],
    ["Servidor MCP — vendável", "API", "Endpoint MCP autenticado por chave de API por empresa; ferramentas escopadas ao tenant. Clientes externos de IA operam a conta da empresa com segurança."],
  ];
  const cw = (W - 2 * M - 2 * 0.4) / 3;
  blocks.forEach(([t, big, d], i) => {
    const x = M + i * (cw + 0.4);
    const y = 1.85,
      h = 4.4;
    accentCard(s, x, y, cw, h, i === 2 ? ACC : NAVY2);
    s.addText(big, { x: x + 0.3, y: y + 0.3, w: cw - 0.5, h: 0.9, fontFace: HF, fontSize: 40, bold: true, color: i === 2 ? AMBER6 : SLATE9 });
    s.addText(t, { x: x + 0.3, y: y + 1.25, w: cw - 0.5, h: 0.8, fontFace: HF, fontSize: 16, bold: true, color: NAVY });
    s.addShape(pres.shapes.LINE, { x: x + 0.3, y: y + 2.05, w: cw - 0.6, h: 0, line: { color: LINE, width: 1 } });
    s.addText(d, { x: x + 0.3, y: y + 2.2, w: cw - 0.55, h: 2.0, fontFace: BF, fontSize: 12.5, color: MIST, lineSpacingMultiple: 1.08 });
  });
  s.addText("O MCP é um produto vendável: a beculture se torna uma plataforma de integrações, não apenas um app.", {
    x: M, y: 6.5, w: W - 2 * M, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: ACC_D, align: "center",
  });
  footer(s, 10, false);
})();

// =====================================================================
// 11. ARQUITETURA & RESTRIÇÕES
// =====================================================================
(function arch() {
  const s = lightSlide("Arquitetura", "Stack obrigatória e restrições");
  // Esquerda: frontend obrigatório
  accentCard(s, M, 1.8, 5.4, 4.5, ACC);
  s.addText("Frontend — OBRIGATÓRIO", { x: M + 0.35, y: 2.05, w: 4.7, h: 0.4, fontFace: HF, fontSize: 16, bold: true, color: NAVY });
  s.addText("Não substituível sem aprovação formal.", { x: M + 0.35, y: 2.45, w: 4.7, h: 0.35, fontFace: BF, fontSize: 12, italic: true, color: MIST });
  const fe = [["React 19", "Biblioteca de UI (SPA)"], ["Tailwind CSS", "Design system utility-first"], ["JavaScript + TypeScript", "Tipagem nas regras de negócio"]];
  fe.forEach(([t, d], i) => {
    const y = 3.0 + i * 1.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.35, y, w: 4.7, h: 0.9, fill: { color: ICE }, line: { color: LINE, width: 1 }, rectRadius: 0.06 });
    s.addText(t, { x: M + 0.6, y: y + 0.12, w: 4.3, h: 0.4, fontFace: HF, fontSize: 15, bold: true, color: ACC_D });
    s.addText(d, { x: M + 0.6, y: y + 0.48, w: 4.3, h: 0.35, fontFace: BF, fontSize: 12, color: MIST });
  });

  // Direita: restrições gerais (backend a critério)
  const x2 = M + 5.8;
  const fw = W - M - x2;
  accentCard(s, x2, 1.8, fw, 4.5, NAVY2);
  s.addText("Restrições gerais — backend a critério da CEIA", { x: x2 + 0.35, y: 2.05, w: fw - 0.6, h: 0.4, fontFace: HF, fontSize: 16, bold: true, color: NAVY });
  const res = [
    "API stateless e horizontalmente escalável; auth por token, autorização por papel/tenant.",
    "Banco relacional como fonte de verdade transacional (NoSQL/cache complementam).",
    "Streaming de IA (ex.: SSE) com cancelamento.",
    "Endpoint MCP público, autenticado por chave de API por empresa.",
    "Segredos cifrados em repouso (chaves de IA, tokens OAuth), geríveis por KMS.",
    "Implantação conteinerizada, ambientes separados, migrações versionadas e observabilidade.",
  ];
  s.addText(res.map((t) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 8 } })), {
    x: x2 + 0.35, y: 2.6, w: fw - 0.7, h: 3.5, fontFace: BF, fontSize: 13, color: MIST, lineSpacingMultiple: 1.05,
  });
  footer(s, 11, false);
})();

// =====================================================================
// 12. MULTI-TENANCY, PAPÉIS & SEGURANÇA
// =====================================================================
(function security() {
  const s = lightSlide("Confiança", "Multi-tenancy, papéis e LGPD");
  // três blocos
  const blocks = [
    ["Isolamento total", ["Todo dado pertence a uma empresa e é isolado entre tenants.", "Escopo derivado da identidade do servidor — nunca de parâmetros do cliente.", "Catálogos globais; estado por empresa/usuário."]],
    ["Papéis e permissões", ["Owner — controle total (billing, convites, papéis, chaves).", "Admin — privilégios delegados.", "Membro — chat, memórias próprias, leitura."]],
    ["Segurança & LGPD", ["Segredos cifrados em repouso; chaves MCP só-hash.", "Conformidade LGPD (consentimento, retenção, exclusão).", "Hashing forte de senha; proteção de rotas."]],
  ];
  const cw = (W - 2 * M - 2 * 0.4) / 3;
  blocks.forEach(([t, list], i) => {
    const x = M + i * (cw + 0.4);
    const y = 1.85,
      h = 4.45;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h, fill: { color: CLOUD }, line: { color: LINE, width: 1 }, shadow: shadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.75, fill: { color: NAVY } });
    s.addText(t, { x: x + 0.3, y, w: cw - 0.6, h: 0.75, valign: "middle", fontFace: HF, fontSize: 16, bold: true, color: WHITE });
    s.addText(list.map((p) => ({ text: p, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 11 } })), {
      x: x + 0.32, y: y + 1.0, w: cw - 0.62, h: 3.2, fontFace: BF, fontSize: 12.5, color: MIST, lineSpacingMultiple: 1.05,
    });
  });
  footer(s, 12, false);
})();

// =====================================================================
// 13. PRECIFICAÇÃO (normativa)
// =====================================================================
(function pricing() {
  const s = lightSlide("Regras de negócio", "Precificação — seção normativa");
  s.addText("Valores e lógica devem ser implementados exatamente como na especificação (parametrizáveis em produção).", {
    x: M, y: 1.65, w: W - 2 * M, h: 0.5, fontFace: BF, fontSize: 14, color: MIST,
  });
  // dois cartões de modelo de cobrança (2 colunas alinhadas com a grade abaixo)
  const cw = (W - 2 * M - 0.4) / 2;
  const x2col = M + cw + 0.4;
  accentCard(s, M, 2.3, cw, 1.4, NAVY2);
  s.addText("Por usuário", { x: M + 0.3, y: 2.45, w: cw - 0.5, h: 0.4, fontFace: HF, fontSize: 15, bold: true, color: NAVY });
  s.addText("Performance · Learning · Project Management — preço por usuário/mês, por faixa de quantidade.", { x: M + 0.3, y: 2.85, w: cw - 0.55, h: 0.8, fontFace: BF, fontSize: 12.5, color: MIST, lineSpacingMultiple: 1.05 });
  accentCard(s, x2col, 2.3, cw, 1.4, ACC);
  s.addText("Por posição", { x: x2col + 0.3, y: 2.45, w: cw - 0.5, h: 0.4, fontFace: HF, fontSize: 15, bold: true, color: NAVY });
  s.addText("Hiring — preço por vaga/mês, cobrado isoladamente (não entra no desconto de pacote).", { x: x2col + 0.3, y: 2.85, w: cw - 0.55, h: 0.8, fontFace: BF, fontSize: 12.5, color: MIST, lineSpacingMultiple: 1.05 });

  // regras chave (2 colunas × 3 linhas)
  const rules = [
    ["3 planos", "Basic · Profissional · Expert"],
    ["Faixas por quantidade", "Preço unitário cai conforme a faixa"],
    ["Ciclo anual −15%", "Aplicado sobre o preço mensal"],
    ["Desconto de pacote", "Módulo âncora no plano; demais em Basic"],
    ["Hiring máx. 8 posições", "Limite parametrizável na interface"],
    ["Snapshot na assinatura", "Preços e quantidades gravados na contratação"],
  ];
  rules.forEach(([t, d], i) => {
    const col = i % 2,
      row = Math.floor(i / 2);
    const x = M + col * (cw + 0.4);
    const y = 3.95 + row * 0.98;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.82, fill: { color: CLOUD }, line: { color: LINE, width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.07, h: 0.82, fill: { color: GOLD } });
    s.addText(t, { x: x + 0.3, y: y + 0.12, w: cw - 0.5, h: 0.38, fontFace: HF, fontSize: 15, bold: true, color: NAVY });
    s.addText(d, { x: x + 0.3, y: y + 0.48, w: cw - 0.5, h: 0.3, fontFace: BF, fontSize: 12, color: MIST });
  });
  footer(s, 13, false);
})();

// =====================================================================
// 14. FASEAMENTO
// =====================================================================
(function phasing() {
  const s = lightSlide("Plano de entrega", "Faseamento sugerido (não-vinculante)");
  const phases = [
    ["1", "Fundações", "Multi-tenancy, auth/papéis, cadastro/trial, onboarding, billing (Pix/cartão/boleto), paywall."],
    ["2", "Núcleo de IA", "Squads e agentes, chat em streaming, histórico e projetos, memória de longo prazo, BYOK + fallback de trial."],
    ["3", "Integrações", "Catálogo de conectores, OAuth (Slack piloto), servidor MCP com chaves por empresa."],
    ["4", "Conteúdo & analytics", "Feed, insights, relatórios, documentos; área administrativa de catálogos e preços."],
    ["5", "Evoluções", "SSO/SAML (Expert), NF-e, OAuth no MCP, novos conectores e módulos aprofundados."],
  ];
  const n = phases.length;
  const gap = 0.35;
  const cw = (W - 2 * M - (n - 1) * gap) / n;
  const y = 2.1,
    h = 3.7;
  // linha de tempo
  s.addShape(pres.shapes.LINE, { x: M, y: y - 0.25, w: W - 2 * M, h: 0, line: { color: LINE, width: 2 } });
  phases.forEach(([num, t, d], i) => {
    const x = M + i * (cw + gap);
    const hot = i === 1; // destaque no núcleo de IA
    s.addShape(pres.shapes.OVAL, { x: x + cw / 2 - 0.16, y: y - 0.41, w: 0.32, h: 0.32, fill: { color: hot ? ACC : NAVY } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h, fill: { color: hot ? NAVY : CLOUD }, line: { color: hot ? NAVY : LINE, width: 1 }, shadow: shadow() });
    s.addText("FASE " + num, { x: x + 0.22, y: y + 0.25, w: cw - 0.4, h: 0.3, fontFace: BF, fontSize: 11, bold: true, color: hot ? ACC : ACC_D, charSpacing: 1 });
    s.addText(t, { x: x + 0.22, y: y + 0.58, w: cw - 0.4, h: 0.75, fontFace: HF, fontSize: 15, bold: true, color: hot ? WHITE : NAVY });
    s.addShape(pres.shapes.LINE, { x: x + 0.22, y: y + 1.45, w: cw - 0.44, h: 0, line: { color: hot ? STEEL : LINE, width: 1 } });
    s.addText(d, { x: x + 0.22, y: y + 1.6, w: cw - 0.42, h: 1.95, fontFace: BF, fontSize: 11.5, color: hot ? ICEBLUE : MIST, lineSpacingMultiple: 1.08 });
  });
  s.addText("A Fase 2 é a base de IA que reaproveitamos em todos os módulos.", {
    x: M, y: 6.1, w: W - 2 * M, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: ACC_D, align: "center",
  });
  footer(s, 14, false);
})();

// =====================================================================
// 15. ENCERRAMENTO — o que esperamos + próximos passos
// =====================================================================
(function closing() {
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 0.85, w: 0.5, h: 0.14, fill: { color: ACC } });
  s.addText("O QUE ESPERAMOS", { x: M, y: 1.05, w: 11, h: 0.4, fontFace: BF, fontSize: 14, bold: true, color: AMBER, charSpacing: 2 });
  s.addText("Uma base de IA sólida, segura e reutilizável.", {
    x: M, y: 1.5, w: 12, h: 0.9, fontFace: HF, fontSize: 32, bold: true, color: WHITE,
  });

  const cols = [
    ["Qualidade de SaaS comercial", "Segurança, isolamento por tenant, observabilidade e desempenho desde o primeiro dia."],
    ["Fidelidade ao escopo", "Frontend conforme a stack obrigatória; tabelas normativas implementadas exatamente."],
    ["Pensada para evoluir", "Memória, squads e contexto reaproveitáveis pelos módulos de negócio."],
  ];
  const cw = (W - 2 * M - 2 * 0.4) / 3;
  cols.forEach(([t, d], i) => {
    const x = M + i * (cw + 0.4);
    const y = 2.85,
      h = 2.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h, fill: { color: SLATE8 }, line: { color: SLATE7, width: 1 }, rectRadius: 0.08 });
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.22, h: 0.22, fill: { color: AMBER } });
    s.addText(t, { x: x + 0.3, y: y + 0.62, w: cw - 0.6, h: 0.65, fontFace: HF, fontSize: 15, bold: true, color: WHITE });
    s.addText(d, { x: x + 0.3, y: y + 1.2, w: cw - 0.6, h: 0.75, fontFace: BF, fontSize: 12, color: ICEBLUE, lineSpacingMultiple: 1.05 });
  });

  // próximos passos
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 5.3, w: 0.28, h: 0.16, fill: { color: GOLD } });
  s.addText("PRÓXIMOS PASSOS", { x: M + 0.4, y: 5.22, w: 11, h: 0.32, fontFace: BF, fontSize: 12, bold: true, color: GOLD, charSpacing: 2 });
  s.addText([
    { text: "1. Leitura da especificação técnica completa (.docx)    ", options: { color: WHITE } },
    { text: "2. Alinhamento de dúvidas e premissas    ", options: { color: WHITE } },
    { text: "3. Proposta de plano e cronograma por fase", options: { color: WHITE } },
  ], { x: M, y: 5.6, w: 12, h: 0.5, fontFace: BF, fontSize: 14 });
  s.addText("beculture · A plataforma-base de IA sobre a qual tudo o mais é construído.", {
    x: M, y: 6.55, w: 12, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: SUB,
  });
})();

pres.writeFile({ fileName: "Apresentacao-beculture-CEIA.pptx" }).then((f) => console.log("OK:", f));
