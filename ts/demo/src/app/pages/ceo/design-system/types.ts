// ----------------------------------------------------------------------
// Design System das marcas — portado do beculture/Confi (public/design-system.js).
//
// Um design system descreve a marca (identidade, cores, tipografia, espaçamento,
// componentes, elementos visuais e tokens/regras) e é usado por TODAS as
// ferramentas do AI Studio: o que a IA gera sai na cara da marca escolhida.
//
// O usuário pode manter várias marcas; uma fica ativa por vez.
// ----------------------------------------------------------------------

export interface DsMarca {
  nome: string;
  proposito: string;
  personalidade: string;
  publico: string;
  contexto: string[];
  tom: string;
}

export interface DsCores {
  primaria: string;
  secundaria: string;
  acento: string;
  fundo: string;
  superficie: string;
  texto: string;
  textoSuave: string;
  sucesso: string;
  erro: string;
  alerta: string;
  info: string;
}

export interface DsTipografia {
  fonteTitulo: string;
  fonteCorpo: string;
  base: number;
  escala: number;
  pesoTitulo: number;
  pesoCorpo: number;
  lineHeight: number;
  tracking: number;
}

export interface DsEspacamento {
  base: number;
  grid: number;
  raio: number;
  padding: number;
  breakpoints: string;
}

export interface DsComponentes {
  botoes: string;
  formularios: string;
  superficies: string;
  navegacao: string;
  tabelas: string;
}

export interface DsVisual {
  icones: string;
  ilustracoes: string;
  sombras: string;
  loading: string;
}

export interface DsTokens {
  modo: string;
  nomeacao: string;
  microinteracoes: string;
  dos: string;
  donts: string;
}

/** Logos da marca em data URL. `claro` = para fundos claros; `escuro` = para fundos escuros. */
export interface DsLogos {
  claro: string;
  escuro: string;
}

export interface DesignSystem {
  marca: DsMarca;
  cores: DsCores;
  tipografia: DsTipografia;
  espacamento: DsEspacamento;
  componentes: DsComponentes;
  visual: DsVisual;
  tokens: DsTokens;
  logos: DsLogos;
}

/** Marca guardada no store: id estável + o design system. */
export interface Brand {
  id: string;
  ds: DesignSystem;
}

/** Item enxuto para o seletor da barra (sem carregar o design inteiro). */
export interface BrandOption {
  id: string;
  nome: string;
}

// Preset padrão — identidade "beculture" (âmbar sobre grafite). Serve de ponto
// de partida rico para uma marca nova; tudo é editável.
export const PADRAO: DesignSystem = {
  marca: {
    nome: "beculture",
    proposito:
      "Transformar cultura organizacional em performance de negócio, unindo dados e humanidade.",
    personalidade: "Confiante, inovadora, próxima, sofisticada",
    publico: "C-level, líderes de RH e gestores de times",
    contexto: ["Apresentação", "Web"],
    tom: "Moderno e premium",
  },
  cores: {
    primaria: "#FFCA28",
    secundaria: "#FFB300",
    acento: "#38E1FF",
    fundo: "#0F172B",
    superficie: "#1E293B",
    texto: "#F8FAFC",
    textoSuave: "#94A3B8",
    sucesso: "#10B981",
    erro: "#EF4444",
    alerta: "#F59E0B",
    info: "#3B82F6",
  },
  tipografia: {
    fonteTitulo: "Plus Jakarta Sans",
    fonteCorpo: "Inter",
    base: 16,
    escala: 1.25,
    pesoTitulo: 800,
    pesoCorpo: 400,
    lineHeight: 1.5,
    tracking: 0,
  },
  espacamento: {
    base: 8,
    grid: 12,
    raio: 10,
    padding: 16,
    breakpoints: "sm 640 · md 768 · lg 1024 · xl 1280",
  },
  componentes: {
    botoes:
      "Variantes: Primário (sólido), Secundário (contorno), Ghost. Estados: hover (eleva), active, disabled (55%), focus (anel).",
    formularios:
      "Inputs com fundo translúcido, borda 1px, foco com realce âmbar; selects e checkboxes no mesmo tom.",
    superficies:
      "Cards em superfície elevada; modais centrais com overlay; tooltips escuros; banners semânticos.",
    navegacao:
      "Menu lateral (widgets), tabs, breadcrumbs; item ativo com destaque âmbar.",
    tabelas: "Cabeçalho fixo, linhas com zebra sutil, densidade confortável.",
  },
  visual: {
    icones: "Estilo line, 24px, traço 1.5, grid 24×24.",
    ilustracoes: "Flat geométrico; fotos com overlay escuro para legibilidade.",
    sombras: "3 níveis (sm/md/lg), difusas e de baixa opacidade.",
    loading: "Spinner âmbar + skeleton; feedback via toasts semânticos.",
  },
  tokens: {
    modo: "Escuro",
    nomeacao:
      "color.primary · color.bg · space.4 (4px) · radius.md · font.title · font.body",
    microinteracoes: "Transições 140ms ease; hover eleva; foco sempre visível.",
    dos: "Use o âmbar como acento pontual; mantenha contraste AA+; respeite a escala de espaçamento.",
    donts:
      "Não use âmbar em grandes áreas de texto; não misture mais de 2 fontes; não crie tons fora da paleta.",
  },
  logos: { claro: "", escuro: "" },
};

/**
 * Visual neutro — o que vale quando nenhuma identidade foi informada.
 *
 * É um DesignSystem como outro qualquer, e não a ausência dele, por dois
 * motivos: no backend, `designTheme()` cai na paleta beculture quando o design
 * falta, e `designBrief()` pula todo campo vazio. Com a `marca` em branco, o
 * prompt recebe a PALETA sem receber identidade nenhuma — e o arquivo sai
 * neutro sem exigir uma linha de backend.
 *
 * Escuro, e não claro, porque `build-html.ts` tem bordas `rgba(255,255,255,.08)`
 * cravadas que assumem fundo escuro e sumiriam numa paleta clara.
 *
 * Os campos de texto ficam VAZIOS de propósito: preenchê-los com conselhos
 * genéricos ("use uma estética sóbria") seria inventar uma identidade justamente
 * onde o usuário disse não querer nenhuma.
 */
export const NEUTRO: DesignSystem = {
  marca: {
    nome: "",
    proposito: "",
    personalidade: "",
    publico: "",
    contexto: [],
    tom: "",
  },
  cores: {
    // Cinzas sobre grafite. O "destaque" é um cinza claro: ele vira a barra da
    // capa e o realce dos números, então precisa contrastar sem virar cor de
    // marca.
    primaria: "#E5E7EB",
    secundaria: "#9CA3AF",
    acento: "#D1D5DB",
    fundo: "#0F1115",
    superficie: "#1A1D23",
    texto: "#F5F6F7",
    textoSuave: "#9BA1A8",
    sucesso: "#10B981",
    erro: "#EF4444",
    alerta: "#F59E0B",
    info: "#3B82F6",
  },
  tipografia: {
    // Fontes de sistema: o renderizador cai em Arial quando não reconhece, e
    // escolher uma fonte de marca aqui contradiria o "neutro".
    fonteTitulo: "Inter",
    fonteCorpo: "Inter",
    base: 16,
    escala: 1.25,
    pesoTitulo: 700,
    pesoCorpo: 400,
    lineHeight: 1.5,
    tracking: 0,
  },
  espacamento: {
    base: 8,
    grid: 12,
    raio: 10,
    padding: 16,
    breakpoints: "",
  },
  componentes: {
    botoes: "",
    formularios: "",
    superficies: "",
    navegacao: "",
    tabelas: "",
  },
  visual: { icones: "", ilustracoes: "", sombras: "", loading: "" },
  tokens: {
    modo: "",
    nomeacao: "",
    microinteracoes: "",
    dos: "",
    donts: "",
  },
  logos: { claro: "", escuro: "" },
};

export const FONTES = [
  "Inter",
  "Plus Jakarta Sans",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Lato",
  "Open Sans",
  "Work Sans",
  "Nunito",
  "Georgia",
  "Playfair Display",
  "Merriweather",
  "Arial",
  "Helvetica",
];

export const ESCALAS: [number, string][] = [
  [1.125, "Minor Second (1.125)"],
  [1.2, "Minor Third (1.2)"],
  [1.25, "Major Third (1.25)"],
  [1.333, "Perfect Fourth (1.333)"],
  [1.414, "Aug. Fourth (1.414)"],
  [1.5, "Perfect Fifth (1.5)"],
  [1.618, "Golden (1.618)"],
];

export const TONS = [
  "Moderno e premium",
  "Corporativo e sério",
  "Minimalista",
  "Lúdico e vibrante",
  "Elegante e sofisticado",
  "Tech e futurista",
];

export const MODOS = ["Escuro", "Claro", "Ambos"];

export const CONTEXTOS = ["Apresentação", "Web", "Mobile", "Print"];

/** Degraus da escala tipográfica, calculados a partir da base × razão. */
export function escalaTipos(t: DsTipografia): { nome: string; px: number }[] {
  const base = Number(t.base) || 16;
  const r = Number(t.escala) || 1.25;
  const passo = (n: number) => Math.round(base * r ** n);
  return [
    { nome: "Display", px: passo(4) },
    { nome: "H1", px: passo(3) },
    { nome: "H2", px: passo(2) },
    { nome: "H3", px: passo(1) },
    { nome: "Body", px: base },
    { nome: "Caption", px: Math.round(base / r) },
  ];
}
