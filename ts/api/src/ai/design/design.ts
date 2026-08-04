// ----------------------------------------------------------------------
// Design system da marca — enviado pelas ferramentas do AI Studio (ts/demo,
// app/pages/ceo/design-system). Portado do beculture/Confi, onde cada ação de
// IA lia `window.DesignSystem.get()` antes de gerar.
//
// Aqui ele vira: (a) um bloco de contexto para os prompts, e (b) um tema
// (cores/fontes/raio/logo) para os geradores determinísticos — .pptx e HTML.
// Tudo é opcional: sem design, tudo cai no padrão beculture de antes.
// ----------------------------------------------------------------------

export interface DesignSystemDto {
  marca?: {
    nome?: string;
    proposito?: string;
    personalidade?: string;
    publico?: string;
    contexto?: string[];
    tom?: string;
  };
  cores?: {
    primaria?: string;
    secundaria?: string;
    acento?: string;
    fundo?: string;
    superficie?: string;
    texto?: string;
    textoSuave?: string;
    sucesso?: string;
    erro?: string;
    alerta?: string;
    info?: string;
  };
  tipografia?: {
    fonteTitulo?: string;
    fonteCorpo?: string;
    base?: number;
    escala?: number;
    pesoTitulo?: number;
    pesoCorpo?: number;
    lineHeight?: number;
    tracking?: number;
  };
  espacamento?: { base?: number; grid?: number; raio?: number; padding?: number };
  componentes?: Record<string, string>;
  visual?: Record<string, string>;
  tokens?: {
    modo?: string;
    nomeacao?: string;
    microinteracoes?: string;
    dos?: string;
    donts?: string;
  };
  logos?: { claro?: string; escuro?: string };
}

/** Aceita o objeto já parseado (JSON body) ou a string do multipart. */
export function parseDesign(raw: unknown): DesignSystemDto | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const obj: unknown = JSON.parse(raw);
      return obj && typeof obj === 'object' ? (obj as DesignSystemDto) : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as DesignSystemDto) : null;
}

const lim = (s: unknown, n: number): string => String(s ?? '').trim().slice(0, n);

/**
 * Bloco de contexto para os prompts: quem é a marca, com que tom fala e quais
 * são as diretrizes visuais. Vazio quando não há design — nada muda no prompt.
 */
export function designBrief(design?: DesignSystemDto | null): string {
  if (!design) return '';
  const m = design.marca ?? {};
  const c = design.cores ?? {};
  const t = design.tipografia ?? {};
  const tk = design.tokens ?? {};

  const linhas: string[] = [];
  if (m.nome) linhas.push(`- Marca: ${lim(m.nome, 120)}`);
  if (m.proposito) linhas.push(`- Propósito: ${lim(m.proposito, 400)}`);
  if (m.personalidade) linhas.push(`- Personalidade: ${lim(m.personalidade, 200)}`);
  if (m.publico) linhas.push(`- Público: ${lim(m.publico, 200)}`);
  if (m.tom) linhas.push(`- Tom de voz: ${lim(m.tom, 120)}`);
  if (Array.isArray(m.contexto) && m.contexto.length) {
    linhas.push(`- Contextos de uso: ${m.contexto.map((x) => lim(x, 40)).join(', ')}`);
  }
  if (c.primaria || c.fundo) {
    linhas.push(
      `- Paleta: primária ${c.primaria ?? '—'}, secundária ${c.secundaria ?? '—'}, acento ${c.acento ?? '—'}, fundo ${c.fundo ?? '—'}, superfície ${c.superficie ?? '—'}, texto ${c.texto ?? '—'}`,
    );
  }
  if (t.fonteTitulo || t.fonteCorpo) {
    linhas.push(`- Tipografia: títulos em ${t.fonteTitulo ?? '—'}, corpo em ${t.fonteCorpo ?? '—'}`);
  }
  if (tk.modo) linhas.push(`- Modo: ${lim(tk.modo, 40)}`);
  if (tk.dos) linhas.push(`- Faça: ${lim(tk.dos, 400)}`);
  if (tk.donts) linhas.push(`- Não faça: ${lim(tk.donts, 400)}`);

  if (!linhas.length) return '';
  return (
    `\n## MARCA / DESIGN SYSTEM\n` +
    `Produza tudo na identidade desta marca — linguagem, tom e, quando o resultado for visual, cores e tipografia.\n` +
    linhas.join('\n') +
    '\n'
  );
}

/**
 * Sufixo curto para prompts de IMAGEM. O bloco `designBrief` é longo demais
 * para um gerador de imagem — aqui vai só o que o modelo consegue usar:
 * paleta, tom e a linguagem visual da marca.
 */
export function designImagemHint(design?: DesignSystemDto | null): string {
  if (!design) return '';
  const c = design.cores ?? {};
  const m = design.marca ?? {};
  const partes: string[] = [];
  const paleta = [c.primaria, c.secundaria, c.acento].filter(Boolean).join(', ');
  if (paleta) partes.push(`paleta ${paleta}${c.fundo ? ` sobre fundo ${c.fundo}` : ''}`);
  if (m.tom) partes.push(`tom ${lim(m.tom, 60).toLowerCase()}`);
  if (design.visual?.ilustracoes) partes.push(lim(design.visual.ilustracoes, 180));
  if (!partes.length) return '';
  const nome = lim(m.nome, 60);
  return `\n\nEstilo visual${nome ? ` da marca ${nome}` : ''}: ${partes.join('; ')}.`;
}

// ------------------------------------------------------------------- visual

/** Normaliza uma cor hex para o formato do pptxgenjs (6 dígitos, sem "#"). */
function hex(cor: string | undefined, fallback: string): string {
  const m = /^#?([\da-f]{6})$/i.exec((cor ?? '').trim());
  return m ? m[1].toUpperCase() : fallback;
}

/** Cor CSS válida (com "#") ou o fallback. */
function css(cor: string | undefined, fallback: string): string {
  const m = /^#?([\da-f]{6})$/i.exec((cor ?? '').trim());
  return m ? `#${m[1]}` : fallback;
}

export interface Tema {
  /** Cores sem "#", para o pptxgenjs. */
  pptx: {
    fundo: string;
    fundoCapa: string;
    titulo: string;
    texto: string;
    destaque: string;
    suave: string;
  };
  /** Cores com "#", para o HTML. */
  html: {
    fundo: string;
    superficie: string;
    destaque: string;
    titulo: string;
    texto: string;
    suave: string;
  };
  fonteTitulo: string;
  fonteCorpo: string;
  raioPx: number;
  marca: string;
  /** Logo em data URL para fundos escuros (capa do deck). */
  logo: string;
}

/**
 * Deriva o tema visual (cores, fontes, raio, logo) do design system. Sem design,
 * devolve a paleta beculture — o mesmo visual de antes.
 */
export function designTheme(design?: DesignSystemDto | null): Tema {
  const c = design?.cores ?? {};
  const t = design?.tipografia ?? {};
  const e = design?.espacamento ?? {};
  const logos = design?.logos ?? {};

  return {
    pptx: {
      fundo: hex(c.fundo, '0B1220'),
      fundoCapa: hex(c.superficie, '111827'),
      titulo: hex(c.texto, 'F8FAFC'),
      texto: hex(c.texto, 'E2E8F0'),
      destaque: hex(c.primaria, 'FFCA28'),
      suave: hex(c.textoSuave, '94A3B8'),
    },
    html: {
      fundo: css(c.fundo, '#0b1220'),
      superficie: css(c.superficie, '#111827'),
      destaque: css(c.primaria, '#FFCA28'),
      titulo: css(c.texto, '#F8FAFC'),
      texto: css(c.texto, '#E2E8F0'),
      suave: css(c.textoSuave, '#94A3B8'),
    },
    fonteTitulo: lim(t.fonteTitulo, 60) || 'Arial',
    fonteCorpo: lim(t.fonteCorpo, 60) || 'Arial',
    raioPx: Number(e.raio) > 0 ? Number(e.raio) : 16,
    marca: lim(design?.marca?.nome, 80) || 'beculture · IA',
    // Só aceitamos data URL de imagem — nada de URL remota indo para o deck.
    logo: /^data:image\//.test(logos.escuro ?? '') ? (logos.escuro as string) : '',
  };
}
