// Vocabulário de aplicativos: corrige o que o ditado do navegador entende
// errado ("firma" → Figma, "Klaus" → Claude) usando o inventário REAL do
// computador. Funções puras; nunca inventa um app que não está na lista.

export interface AppConhecido {
  id: string;
  nome: string;
  alvo: string;
}

/** minúsculas, sem acento, só letras/números/espaço. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chave fonética simples para pt-BR (o que soa igual fica igual). */
export function fonetica(s: string): string {
  return normalizar(s)
    .replace(/ /g, '')
    .replace(/ph/g, 'f')
    .replace(/qu/g, 'k')
    .replace(/[cq](?=[aou]|$|[^eiy])/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/ck/g, 'k')
    .replace(/w/g, 'v')
    .replace(/y/g, 'i')
    .replace(/z/g, 's')
    .replace(/x/g, 'ks')
    .replace(/h/g, '')
    .replace(/au/g, 'o')
    .replace(/ou/g, 'o')
    .replace(/(.)\1+/g, '$1')
    .replace(/[aeiou]+$/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let ant = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    ant = cur;
  }
  return ant[b.length];
}

/** 0..1 — 1 = idêntico. */
function semelhanca(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * Apelidos de apps comuns, incluindo erros típicos do ditado pt-BR. A chave
 * casa com o NOME do app no inventário (normalizado, contém).
 */
export const APELIDOS_EMBUTIDOS: Record<string, string[]> = {
  figma: ['firma', 'figuema', 'fig ma', 'fima', 'figma app'],
  claude: ['cloud', 'clode', 'klaus', 'claudi', 'clóvis', 'cláudio', 'claudio', 'clold'],
  spotify: ['espotifai', 'spotifai', 'espotify', 'spot'],
  chrome: ['crome', 'cromo', 'google chrome', 'navegador', 'google'],
  edge: ['microsoft edge', 'edge', 'edi'],
  'visual studio code': ['vs code', 'vscode', 've esse code', 'code', 'vs'],
  whatsapp: ['zap', 'uatsap', 'whats', 'wats', 'zapzap'],
  'microsoft teams': ['teams', 'times', 'tims'],
  slack: ['eslaque', 'slaque', 'slak'],
  notion: ['nocion', 'noção', 'nochon'],
  word: ['uord', 'documento word'],
  excel: ['ecsel', 'planilha', 'excell'],
  powerpoint: ['power point', 'pauerpoint', 'apresentacao'],
  outlook: ['autlook', 'email', 'e mail'],
  'bloco de notas': ['notepad', 'bloco', 'notas'],
  calculadora: ['calculator', 'calc'],
  discord: ['discordi', 'dis cord'],
  zoom: ['zum'],
  obsidian: ['obsidiana'],
};

export interface Resolucao {
  app: AppConhecido | null;
  /** Melhor nota (0..1). */
  nota: number;
  /** Candidatos próximos quando não há vencedor claro. */
  sugestoes: AppConhecido[];
}

export const LIMIAR = 0.72;

/**
 * Melhor app para o texto falado/digitado. `apelidosUsuario` vem da política
 * (Configurações > Ambiente local) e tem precedência. Empate ou nota baixa →
 * sem vencedor, com sugestões (o Oracle pergunta "Você quis dizer…?").
 */
export function resolverAlvo(
  texto: string,
  apps: AppConhecido[],
  apelidosUsuario: Record<string, string[]> = {},
): Resolucao {
  const t = normalizar(texto);
  const tf = fonetica(texto);
  if (!t || !apps.length) return { app: null, nota: 0, sugestoes: [] };

  const pontos = apps.map((app) => {
    const nome = normalizar(app.nome);
    const exe = normalizar((app.alvo.split(/[\\/]/).pop() ?? '').replace(/\.exe$/i, ''));
    const termos = new Set<string>([nome, exe, ...nome.split(' ').filter((p) => p.length >= 4)]);
    for (const [chave, lista] of Object.entries(APELIDOS_EMBUTIDOS)) {
      if (nome.includes(chave) || exe.includes(chave.replace(/ /g, ''))) lista.forEach((a) => termos.add(normalizar(a)));
    }
    for (const a of apelidosUsuario[app.id] ?? []) termos.add(normalizar(a));

    let nota = 0;
    for (const termo of termos) {
      if (!termo) continue;
      if (termo === t) nota = Math.max(nota, (apelidosUsuario[app.id] ?? []).some((a) => normalizar(a) === t) ? 1 : 0.99);
      else {
        nota = Math.max(nota, semelhanca(t, termo) * 0.95, semelhanca(tf, fonetica(termo)) * 0.9);
        // "abrir o google chrome agora" — o nome inteiro aparece no texto
        if (termo.length >= 4 && (` ${t} `).includes(` ${termo} `)) nota = Math.max(nota, 0.9);
      }
    }
    return { app, nota };
  });
  pontos.sort((a, b) => b.nota - a.nota);
  const [primeiro, segundo] = pontos;
  const claro = primeiro.nota >= LIMIAR && (!segundo || primeiro.nota - segundo.nota >= 0.05);
  return {
    app: claro ? primeiro.app : null,
    nota: primeiro.nota,
    sugestoes: claro ? [] : pontos.filter((p) => p.nota >= 0.5).slice(0, 3).map((p) => p.app),
  };
}
