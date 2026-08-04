// Prompts do "Criar artigo" — portado do beculture/Confi (lib/claude.js, tipo
// "artigo"). Geração direta (single-shot) com refino iterativo (ajuste da versão
// anterior). A IA devolve JSON { titulo, subtitulo, conteudo(markdown), conexoes }.
//
// `conexoes` é o bloco "## 🔗 Conexões no Vault" em campo separado: o artigo em
// si continua limpo para copiar/publicar, e o bloco é anexado à nota quando o
// usuário salva na Memória (ver conexoes-vault.ts).

import {
  blocoTitulosVault,
  normalizarConexoes,
  regraConexoesVaultCampo,
  separarConexoes,
} from '../conexoes-vault';

const REGRAS_COPY = `
Padrão de qualidade (vale para todo o texto):
- Escreva como gente fala: frases curtas, voz ativa, "você". Nada de corporativês.
- Seja específico e concreto: exemplos, números, situações reais. Evite abstrações vagas.
- PROIBIDO clichê de IA: "no mundo de hoje", "em um mundo cada vez mais", "não é apenas… é", "descubra como", "revolucionar", "elevar ao próximo nível", "desbloquear todo o potencial", emojis em excesso.
- Cada frase precisa ganhar a próxima. Corte o que não agrega. Sem enrolação nem preâmbulo.
- Fidelidade: não invente dados, números ou fatos que não foram fornecidos no tema/contexto.`;

export const SYSTEM_ARTIGO = `Você é um redator de artigos que as pessoas leem até o fim, escrevendo em português do Brasil.
Escreva um ARTIGO completo sobre o tema pedido. Estrutura:
- TÍTULO forte e específico (evite título genérico de SEO batido).
- SUBTÍTULO: uma linha que entrega a promessa concreta do artigo.
- CORPO em Markdown: uma abertura que fisga em 2-3 frases (sem "no mundo de hoje"), seções com subtítulos ## que avançam o raciocínio, exemplos concretos, e uma conclusão com um ponto de vista — não um resumo morno.
- Extensão: 500 a 900 palavras, salvo se o contexto pedir outra. Densidade > tamanho.${REGRAS_COPY}

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "titulo": "Título do artigo", "subtitulo": "Linha fina", "conteudo": "O artigo completo em Markdown (sem repetir o título)", "conexoes": "O bloco de Conexões no Vault em Markdown" }${regraConexoesVaultCampo('conexoes')}`;

export interface Artigo {
  titulo: string;
  subtitulo: string;
  conteudo: string;
  /** Bloco "## 🔗 Conexões no Vault" — anexado à nota ao salvar na Memória. */
  conexoes: string;
}

export interface ArtigoInput {
  tema: string;
  contexto?: string;
  referencia?: string;
  ajuste?: string;
  anterior?: Artigo | null;
  /** Títulos das notas do vault — alvos possíveis dos [[wikilinks]]. */
  titulosVault?: string[];
}

export function buildArtigoUser(input: ArtigoInput): string {
  const { tema, contexto = '', referencia = '', ajuste = '', anterior, titulosVault = [] } = input;
  let extra = '';
  if (ajuste.trim()) {
    if (anterior) extra += `\n## VERSÃO ANTERIOR (JSON)\n${JSON.stringify(anterior)}\n`;
    extra += `\n## AJUSTE PEDIDO\n${ajuste.trim()}\nRefaça o artigo aplicando ESTE ajuste e preservando o que já está bom. Mantenha o mesmo formato JSON.\n`;
  }
  return (
    `## TEMA\n${tema}\n` +
    (contexto.trim() ? `\n## CONTEXTO / INSTRUÇÕES\n${contexto.trim()}\n` : '') +
    (referencia.trim()
      ? `\n## MATERIAL DE REFERÊNCIA (use como base factual e para exemplos concretos; não copie literalmente)\n${referencia.slice(0, 20000)}\n`
      : '') +
    extra +
    blocoTitulosVault(titulosVault) +
    `\nGere o artigo no formato JSON pedido, com o campo "conexoes" preenchido.`
  );
}

/** Extrai o artigo do texto da IA, com fallback robusto (markdown cru). */
export function parseArtigo(raw: string, tema: string): Artigo {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(semFence.slice(first, last + 1)) as Record<string, unknown>;
      const conteudo = String(obj.conteudo || '').trim();
      if (conteudo) {
        // O bloco às vezes vem colado no fim do artigo: tiramos de lá para não
        // duplicar com o campo `conexoes`.
        const partido = separarConexoes(conteudo);
        return {
          titulo: String(obj.titulo || tema || 'Artigo').slice(0, 200),
          subtitulo: String(obj.subtitulo || '').slice(0, 300),
          conteudo: partido.corpo,
          conexoes:
            normalizarConexoes(String(obj.conexoes || '')) ||
            normalizarConexoes(partido.conexoes),
        };
      }
    } catch {
      /* cai no fallback abaixo */
    }
  }
  // Fallback: trata o texto como Markdown cru. Título = 1º heading, se houver.
  const bruto = (fence ? fence[1] : txt).trim();
  const partido = separarConexoes(bruto);
  const corpo = partido.corpo;
  const h = corpo.match(/^#{1,2}\s+(.+)$/m);
  const titulo = (h ? h[1] : tema || 'Artigo').slice(0, 200);
  const conteudo = h ? corpo.replace(h[0], '').trim() : corpo;
  return { titulo, subtitulo: '', conteudo, conexoes: normalizarConexoes(partido.conexoes) };
}
