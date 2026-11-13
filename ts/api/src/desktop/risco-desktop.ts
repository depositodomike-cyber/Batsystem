// Runtime Security Layer — classificação de risco das operações desktop.
//
// Funções PURAS: nada de LLM, banco ou rede. O risco sai de (operação,
// parâmetros validados, política, contexto da execução) e só pode SUBIR em
// relação ao risco base (SR-03). Requisitos em docs/security/requisitos.md.

export type RiscoDesktop = 'baixo' | 'moderado' | 'alto' | 'bloqueado';

const ORDEM: Record<RiscoDesktop, number> = { baixo: 0, moderado: 1, alto: 2, bloqueado: 3 };

export function maiorRisco(a: RiscoDesktop, b: RiscoDesktop): RiscoDesktop {
  return ORDEM[a] >= ORDEM[b] ? a : b;
}

/** `a` cobre `b`: uma aprovação dada para `a` vale para uma operação de risco `b`. */
export function riscoCobre(a: string, b: RiscoDesktop): boolean {
  return a in ORDEM && ORDEM[a as RiscoDesktop] >= ORDEM[b];
}

/** Categorias de permissão configuráveis em Ambiente local (SR-02). */
export const CATEGORIAS = [
  'apps',
  'processos',
  'janelas',
  'arquivos_busca',
  'documentos',
  'arquivos_escrita',
  'navegador',
  'midia',
  'energia',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const OPERACOES = {
  listar_processos: { categoria: 'processos', base: 'baixo' },
  listar_janelas: { categoria: 'janelas', base: 'baixo' },
  buscar_arquivos: { categoria: 'arquivos_busca', base: 'baixo' },
  abrir_aplicativo: { categoria: 'apps', base: 'moderado' },
  fechar_aplicativo: { categoria: 'apps', base: 'alto' },
  abrir_url: { categoria: 'navegador', base: 'moderado' },
  abrir_documento: { categoria: 'documentos', base: 'moderado' },
  organizar_janelas: { categoria: 'janelas', base: 'moderado' },
  controlar_midia: { categoria: 'midia', base: 'moderado' },
  criar_pasta: { categoria: 'arquivos_escrita', base: 'moderado' },
  mover_arquivo: { categoria: 'arquivos_escrita', base: 'moderado' },
  energia: { categoria: 'energia', base: 'alto' },
} as const satisfies Record<string, { categoria: Categoria; base: RiscoDesktop }>;
export type Operacao = keyof typeof OPERACOES;

export function ehOperacao(op: string): op is Operacao {
  return Object.prototype.hasOwnProperty.call(OPERACOES, op);
}

/**
 * SR-06: ferramentas cujo resultado é só status (nenhum texto vindo de fora).
 * Qualquer outra etapa concluída na execução a torna "contaminada".
 */
export const FERRAMENTAS_LIMPAS: ReadonlySet<string> = new Set([
  'desktop_abrir_aplicativo',
  'desktop_controlar_midia',
  'desktop_organizar_janelas',
  'desktop_criar_pasta',
]);

/** SR-12a: extensões que abrem como documento. */
export const EXTENSOES_DOCUMENTO: ReadonlySet<string> = new Set([
  '.pdf', '.txt', '.md', '.rtf', '.csv', '.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.mp3', '.wav', '.m4a', '.mp4', '.mov',
  '.fig', '.psd', '.ai', '.zip',
]);
/** GA-17: formatos legados com macros sem MOTW e SVG (script via file://). */
export const EXTENSOES_ALTO: ReadonlySet<string> = new Set(['.doc', '.xls', '.ppt', '.svg']);

/** Política efetiva, já lida do banco. */
export interface PoliticaEfetiva {
  versao: number;
  permissoes: Partial<Record<Categoria, boolean>>;
  confirmar: string[];
  apps: string[];
  observaveis: string[];
  diretorios: string[];
  dominios: string[];
}

export interface ContextoRisco {
  /** SR-06/06c: a execução só leu dados "limpos" até aqui. */
  limpa: boolean;
  /** SR-06b: pedido chegou pela wake word. */
  vozAtivacao: boolean;
  /**
   * SR-06d: comando direto do usuário — parâmetros extraídos literalmente do
   * texto dele pelo parser determinístico (conferido no banco pelo gateway).
   */
  comandoDireto?: boolean;
}

/**
 * SR-06d: operações moderadas que um comando direto do usuário executa sem
 * aprovação, mesmo por voz e com histórico na conversa. Todas são
 * reversíveis e só alcançam o que já está autorizado (apps, mídia, janelas).
 */
export const DIRETO_SEM_CONFIRMACAO: ReadonlySet<Operacao> = new Set<Operacao>([
  'abrir_aplicativo',
  'controlar_midia',
  'organizar_janelas',
]);

export interface Avaliacao {
  risco: RiscoDesktop;
  /** Por que subiu ou foi bloqueada — vai para o modelo e para a auditoria. */
  motivos: string[];
}

// ---------------------------------------------------------------- caminhos

const RESERVADOS = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;

/**
 * Pré-checagem textual de caminho (SR-13). O agente refaz tudo com o sistema
 * de arquivos (reparse points); aqui recusamos o que nem precisa ir até lá.
 * Devolve o caminho normalizado (barras invertidas, sem barra final) ou null.
 */
export function normalizarCaminho(bruto: string): string | null {
  if (typeof bruto !== 'string' || bruto.length < 3 || bruto.length > 400) return null;
  if (/[\u0000-\u001f"<>|?*]/.test(bruto)) return null;
  const p = bruto.replace(/\//g, '\\');
  if (!/^[a-zA-Z]:\\/.test(p)) return null; // só absoluto com unidade (recusa UNC e \\?\)
  if (p.indexOf(':', 2) !== -1) return null; // ADS
  const partes = p.slice(3).split('\\').filter((x) => x.length > 0);
  for (const parte of partes) {
    if (parte === '.' || parte === '..') return null;
    if (RESERVADOS.test(parte)) return null;
    if (/[. ]$/.test(parte)) return null; // "pasta." e "pasta " viram outra coisa no Win32
  }
  return `${p.slice(0, 3).toUpperCase()}${partes.join('\\')}`.replace(/\\$/, '');
}

const RAIZES_PROIBIDAS = ['windows', 'program files', 'program files (x86)', 'programdata', '$recycle.bin', 'system volume information', 'recovery', 'boot'];
/** Componentes proibidos em QUALQUER nível (GB-01): dados de apps e inicialização. */
const COMPONENTES_PROIBIDOS = new Set(['appdata', 'startup', 'start menu', 'ntuser.dat', 'desktop.ini']);

/**
 * Caminho proibido (SR-13, GB-01) — vale para TODOS os componentes do alvo,
 * não só para o diretório autorizado: autorizar `C:\Users\voce` não abre
 * AppData, Startup, pastas ocultas (`.ssh`, `.aws`…) nem nomes curtos 8.3
 * (`PROGRA~1`), que poderiam apontar para qualquer lugar.
 */
export function caminhoProibido(caminho: string): boolean {
  const n = normalizarCaminho(caminho);
  if (!n) return true;
  const l = n.toLowerCase();
  if (/^[a-z]:$/.test(l)) return true; // raiz de unidade
  const partes = l.slice(3).split('\\');
  if (RAIZES_PROIBIDAS.includes(partes[0])) return true;
  return partes.some((x) => x.includes('~') || x.startsWith('.') || x.startsWith('$') || COMPONENTES_PROIBIDOS.has(x));
}

/** Diretórios que nunca podem ser autorizados (SR-13). */
export const diretorioProibido = caminhoProibido;

/** O caminho está dentro de algum diretório autorizado? (prefixo com separador) */
export function dentroDeAutorizado(caminho: string, diretorios: string[]): boolean {
  const c = normalizarCaminho(caminho);
  if (!c || caminhoProibido(c)) return false; // GB-01: o ALVO também é checado
  const cl = c.toLowerCase();
  return diretorios.some((d) => {
    const n = normalizarCaminho(d);
    if (!n || diretorioProibido(n)) return false;
    const dl = n.toLowerCase();
    return cl === dl || cl.startsWith(`${dl}\\`);
  });
}

export function extensao(caminho: string): string {
  const nome = caminho.split(/[\\/]/).pop() ?? '';
  const i = nome.lastIndexOf('.');
  return i > 0 ? nome.slice(i).toLowerCase() : '';
}

// ---------------------------------------------------------------- URLs

/**
 * SR-37: http(s) absoluta, sem credenciais, sem espaço/aspas/controle.
 * Devolve a URL normalizada e o host (IDN em punycode, minúsculo, sem ponto
 * final) ou null.
 */
export function normalizarUrl(bruta: string): { url: string; host: string } | null {
  if (typeof bruta !== 'string' || bruta.length > 2048) return null;
  if (/[\s"'<>`\u0000-\u001f\u007f]/.test(bruta)) return null;
  let u: URL;
  try {
    u = new URL(bruta);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  return { url: u.href, host };
}

/** SR-06a/GA-16: casamento por rótulos — igual ou subdomínio. */
export function hostAutorizado(host: string, dominios: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return dominios.some((d) => {
    let dom: string;
    try {
      dom = new URL(`http://${d.trim()}`).hostname.toLowerCase().replace(/\.$/, '');
    } catch {
      return false;
    }
    if (!dom || dom.includes('/')) return false;
    return h === dom || h.endsWith(`.${dom}`);
  });
}

// ---------------------------------------------------------------- risco

/**
 * Classifica uma operação. `entrada` já passou pelo zod da ferramenta.
 * Nunca devolve risco abaixo do base da operação (SR-03).
 */
export function avaliarRisco(
  op: Operacao,
  entrada: Record<string, unknown>,
  politica: PoliticaEfetiva,
  ctx: ContextoRisco,
): Avaliacao {
  const def = OPERACOES[op];
  let risco: RiscoDesktop = def.base;
  const motivos: string[] = [];
  const subir = (r: RiscoDesktop, motivo: string) => {
    if (ORDEM[r] > ORDEM[risco]) risco = r;
    motivos.push(motivo);
  };

  if (!politica.permissoes[def.categoria]) {
    subir('bloqueado', `A categoria "${def.categoria}" não está liberada em Configurações > Ambiente local.`);
  }

  switch (op) {
    case 'abrir_aplicativo':
    case 'fechar_aplicativo': {
      const id = String(entrada.aplicativoId ?? '');
      if (!politica.apps.includes(id)) subir('bloqueado', 'O aplicativo não está na lista de aplicativos autorizados.');
      break;
    }
    case 'organizar_janelas': {
      const ids = Array.isArray(entrada.aplicativoIds) ? entrada.aplicativoIds.map(String) : [];
      if (!ids.length || ids.some((id) => !politica.apps.includes(id))) {
        subir('bloqueado', 'Só janelas de aplicativos autorizados podem ser organizadas.');
      }
      break;
    }
    case 'abrir_url': {
      const n = normalizarUrl(String(entrada.url ?? ''));
      if (!n) subir('bloqueado', 'URL inválida: só http(s), sem credenciais nem caracteres especiais.');
      else if (!hostAutorizado(n.host, politica.dominios)) subir('alto', `O domínio ${n.host} não está na lista de domínios autorizados.`);
      break;
    }
    case 'abrir_documento': {
      const caminho = String(entrada.caminho ?? '');
      const ext = extensao(caminho);
      if (!dentroDeAutorizado(caminho, politica.diretorios)) subir('bloqueado', 'O arquivo está fora dos diretórios autorizados.');
      if (EXTENSOES_ALTO.has(ext)) subir('alto', `Arquivos ${ext} podem conter macros ou scripts.`);
      else if (!EXTENSOES_DOCUMENTO.has(ext)) subir('bloqueado', `Arquivos ${ext || 'sem extensão'} não podem ser abertos pelo Oracle.`);
      break;
    }
    case 'buscar_arquivos': {
      const dir = String(entrada.diretorio ?? '');
      if (!dentroDeAutorizado(dir, politica.diretorios)) subir('bloqueado', 'O diretório está fora dos diretórios autorizados.');
      break;
    }
    case 'criar_pasta': {
      const c = String(entrada.caminho ?? '');
      if (!dentroDeAutorizado(c, politica.diretorios)) subir('bloqueado', 'O caminho está fora dos diretórios autorizados.');
      break;
    }
    case 'mover_arquivo': {
      const o = String(entrada.origem ?? '');
      const d = String(entrada.destino ?? '');
      if (!dentroDeAutorizado(o, politica.diretorios) || !dentroDeAutorizado(d, politica.diretorios)) {
        subir('bloqueado', 'Origem e destino precisam estar nos diretórios autorizados.');
      }
      if (extensao(o) !== extensao(d)) subir('bloqueado', 'Mover não pode trocar a extensão do arquivo.');
      // GB-01: só documentos — nunca executáveis, atalhos, scripts ou sem extensão.
      if (!EXTENSOES_DOCUMENTO.has(extensao(o)) && !EXTENSOES_ALTO.has(extensao(o))) {
        subir('bloqueado', `Arquivos ${extensao(o) || 'sem extensão'} não podem ser movidos pelo Oracle.`);
      }
      if (entrada.sobrescrever === true) subir('alto', 'A operação sobrescreve um arquivo existente.');
      break;
    }
    default:
      break;
  }

  // Moderado só roda direto em condições "limpas"; senão pede aprovação.
  if (risco === 'moderado') {
    if (politica.confirmar.includes(op)) subir('alto', 'Você configurou esta operação para sempre pedir confirmação.');
    // SR-06d: o próprio usuário mandou, com estas palavras: contexto e voz
    // não elevam o risco (a configuração dele acima continua valendo).
    if (ctx.comandoDireto && DIRETO_SEM_CONFIRMACAO.has(op)) return { risco, motivos };
    if (!ctx.limpa) subir('alto', 'Esta execução leu conteúdo (memória, web, arquivos ou conversa) que poderia influenciar a ação.');
    if (ctx.vozAtivacao) subir('alto', 'Pedidos feitos pela palavra de ativação pedem confirmação.');
  }
  return { risco, motivos };
}

/** Versão de um parâmetro de caminho que pode ir para log/auditoria (SR-40). */
export function redigirCaminho(c: unknown, hash: (s: string) => string): string {
  if (typeof c !== 'string') return '';
  const nome = c.split(/[\\/]/).pop() ?? '';
  return `${nome} [#${hash(c.toLowerCase()).slice(0, 12)}]`;
}
