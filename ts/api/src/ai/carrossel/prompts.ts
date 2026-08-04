// Prompts do "Criar Carrossel" — portado do beculture/Confi (lib/claude.js, tipo
// "carrossel"). A IA devolve o ROTEIRO em JSON { titulo, cards[], legenda,
// hashtags[], conexoes }, editável no cliente. Suporta estilo, nº de páginas e
// refino. `conexoes` é o bloco "## 🔗 Conexões no Vault", anexado à nota quando
// o carrossel é salvo na Memória (conexoes-vault.ts).

import {
  blocoTitulosVault,
  normalizarConexoes,
  regraConexoesVaultCampo,
} from '../conexoes-vault';

const REGRAS_COPY = `
Padrão de qualidade (vale para todo o texto):
- Escreva como gente fala: frases curtas, voz ativa, "você". Nada de corporativês.
- Seja específico e concreto: exemplos, números, situações reais. Evite abstrações vagas.
- PROIBIDO clichê de IA: "no mundo de hoje", "em um mundo cada vez mais", "não é apenas… é", "descubra como", "revolucionar", "elevar ao próximo nível", "desbloquear todo o potencial", emojis em excesso.
- Cada frase precisa ganhar a próxima. Corte o que não agrega. Sem enrolação nem preâmbulo.
- Fidelidade: não invente dados, números ou fatos que não foram fornecidos no tema/contexto.`;

const ESTILO_CARROSSEL: Record<string, string> = {
  sobrio:
    'Sóbrio e executivo — linguagem direta e precisa, sem sensacionalismo. Layout limpo e respirado, hierarquia clara, foco em clareza e dados. Evite exclamações e drama.',
  ousado:
    'Ousado e editorial — ganchos provocativos, frases de impacto, contraste forte. Use números e palavras em destaque. Tom mais direto e emocional.',
};

export const SYSTEM_CARROSSEL = `Você é um ghostwriter de carrosséis que viralizam no Instagram/LinkedIn, escrevendo em português do Brasil.
Crie um CARROSSEL sobre o tema pedido. Estrutura:
- Slide 1 (CAPA): um gancho que interrompe o scroll — promessa, tensão ou pergunta afiada. Máximo 8 palavras no título.
- Slides do meio (5 a 7): UMA ideia por slide, do problema à solução, em progressão lógica. Título curto + 1 a 3 frases de corpo escaneável.
- Último slide: CTA único e claro (salvar, comentar, seguir ou agir).
- LEGENDA: 2 a 4 frases que ampliam o gancho e convidam ao engajamento.
- HASHTAGS: 6 a 10 relevantes e específicas do nicho (sem o #, só a palavra).${REGRAS_COPY}

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{
  "titulo": "Título interno do carrossel",
  "cards": [ { "titulo": "Gancho/título do slide", "texto": "Corpo curto do slide" } ],
  "legenda": "Legenda do post",
  "hashtags": ["palavra1", "palavra2"],
  "conexoes": "O bloco de Conexões no Vault em Markdown"
}${regraConexoesVaultCampo('conexoes')}`;

export interface CardItem {
  titulo: string;
  texto: string;
}
export interface Carrossel {
  titulo: string;
  cards: CardItem[];
  legenda: string;
  hashtags: string[];
  /** Bloco "## 🔗 Conexões no Vault" — anexado à nota ao salvar na Memória. */
  conexoes: string;
}

export interface CarrosselInput {
  tema: string;
  contexto?: string;
  estilo?: string;
  nPaginas?: number;
  referencia?: string;
  ajuste?: string;
  anterior?: Carrossel | null;
  /** Títulos das notas do vault — alvos possíveis dos [[wikilinks]]. */
  titulosVault?: string[];
}

export function buildCarrosselUser(input: CarrosselInput): string {
  const {
    tema,
    contexto = '',
    estilo = '',
    nPaginas = 0,
    referencia = '',
    ajuste = '',
    anterior,
    titulosVault = [],
  } = input;
  let extra = '';
  if (nPaginas && nPaginas > 0) {
    extra += `\n## PÁGINAS\nGere EXATAMENTE ${nPaginas} cards (incluindo a capa e o card final de CTA).\n`;
  }
  const est = ESTILO_CARROSSEL[estilo];
  if (est) extra += `\n## ESTILO\n${est}\n`;
  if (ajuste.trim()) {
    if (anterior) extra += `\n## VERSÃO ANTERIOR (JSON)\n${JSON.stringify(anterior)}\n`;
    extra += `\n## AJUSTE PEDIDO\n${ajuste.trim()}\nRefaça o carrossel aplicando ESTE ajuste e preservando o que já está bom. Mantenha o mesmo formato JSON.\n`;
  }
  return (
    `## TEMA\n${tema}\n` +
    (contexto.trim() ? `\n## CONTEXTO / INSTRUÇÕES\n${contexto.trim()}\n` : '') +
    (referencia.trim()
      ? `\n## MATERIAL DE REFERÊNCIA (use como base factual; não copie literalmente)\n${referencia.slice(0, 20000)}\n`
      : '') +
    extra +
    blocoTitulosVault(titulosVault) +
    `\nGere o carrossel no formato JSON pedido, com o campo "conexoes" preenchido.`
  );
}

export function parseCarrossel(raw: string, tema: string): Carrossel {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf('{');
  const last = txt.lastIndexOf('}');
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(txt) as Record<string, unknown>;
  } catch {
    throw new Error('A IA não devolveu um carrossel válido. Tente novamente.');
  }
  const cards: CardItem[] = (Array.isArray(obj.cards) ? obj.cards : [])
    .map((c) => {
      const co = (c ?? {}) as Record<string, unknown>;
      return { titulo: String(co.titulo || '').slice(0, 160), texto: String(co.texto || '').slice(0, 600) };
    })
    .filter((c) => c.titulo || c.texto);
  if (!cards.length) throw new Error('A IA não devolveu cards. Tente novamente.');
  const hashtags = (Array.isArray(obj.hashtags) ? obj.hashtags : [])
    .map((h) => String(h).replace(/^#/, '').trim())
    .filter(Boolean);
  return {
    titulo: String(obj.titulo || tema || 'Carrossel').slice(0, 200),
    cards,
    legenda: String(obj.legenda || '').slice(0, 2000),
    hashtags,
    conexoes: normalizarConexoes(String(obj.conexoes || '')),
  };
}
