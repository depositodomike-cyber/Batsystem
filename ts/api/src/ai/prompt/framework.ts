// Prompt "Pergunte à sua Memória" — portado do beculture/Confi (public/app.js +
// lib/claude.js). Três modos: Memória (vault), Web e Auto. A "Memória" aqui são
// as notas .md do tenant, cruzadas com as Notas/Insights/To-do's que o cliente
// envia como referência.
//
// As DIRETRIZES não entram por aqui: o AiService anexa o bloco de regras ao fim
// do system prompt de TODA chamada de IA (ver memorias/diretrizes.ts).

import {
  blocoTitulosVault,
  REGRA_CONEXOES_VAULT,
  TITULO_CONEXOES_VAULT,
} from '../conexoes-vault';
import { cortarSeguro } from '../texto-seguro';

export type ModoBusca = 'vault' | 'web' | 'auto';

// ---------- Bloco MEMÓRIA (notas do vault) ----------
//
// A MEMÓRIA é o maior bloco do prompt (medido: ~65% da entrada). O consumo vinha
// de pegar os primeiros 1600 chars de CADA uma das 8 notas — caro e, nas notas
// longas (transcrições, documentos de dezenas de milhares de chars), inútil: o
// começo raramente é a parte que responde à pergunta. Aqui trocamos isso por um
// recorte do TRECHO relevante de cada nota, sob um orçamento total de contexto.

/** Nº máximo de notas incluídas no bloco MEMÓRIA. */
export const MEMORIA_MAX_NOTAS = 6;
/** Teto de caracteres por nota (recorte do trecho relevante). */
export const MEMORIA_NOTA_CHARS = 900;
/** Teto de caracteres do bloco MEMÓRIA inteiro — o freio de custo principal. */
export const MEMORIA_TOTAL_CHARS = 5000;

export interface NotaVault {
  titulo: string;
  conteudo: string;
}

/** Minúsculas sem acento, para casar termos da pergunta com o texto da nota. */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Palavras úteis da pergunta (>= 3 letras), sem repetição. */
function termosBusca(texto: string): string[] {
  return [...new Set(normalizar(texto).match(/[a-z0-9]{3,}/g) ?? [])];
}

/**
 * Recorta a nota em torno do primeiro trecho que casa com a pergunta, em vez de
 * pegar sempre o começo. Nota curta (<= budget) volta inteira; sem casamento de
 * termo, cai para o começo. As reticências marcam onde houve corte.
 */
export function trechoRelevante(
  conteudo: string,
  termos: string[],
  budget: number,
): string {
  const texto = conteudo.trim().replace(/\n{3,}/g, '\n\n');
  if (texto.length <= budget) return texto;

  const alvo = normalizar(texto);
  let pos = -1;
  for (const t of termos) {
    const i = alvo.indexOf(t);
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  if (pos < 0) return cortarSeguro(texto, budget).trimEnd() + '…';

  // Janela em torno do match: ~25% de contexto antes, o resto depois. Recua até
  // um espaço para não começar no meio de uma palavra.
  let ini = Math.max(0, pos - Math.floor(budget * 0.25));
  if (ini > 0) {
    const esp = texto.lastIndexOf(' ', ini);
    if (esp > 0) ini = esp + 1;
  }
  const janela = cortarSeguro(texto.slice(ini), budget).trim();
  const prefixo = ini > 0 ? '…' : '';
  const sufixo = ini + budget < texto.length ? '…' : '';
  return `${prefixo}${janela}${sufixo}`;
}

/**
 * Monta o bloco "## MEMÓRIA" sob orçamento total de contexto: itera as notas por
 * relevância, dá a cada uma até `MEMORIA_NOTA_CHARS` do seu trecho relevante e
 * para ao esgotar `MEMORIA_TOTAL_CHARS`. Retorna também os títulos realmente
 * incluídos (só eles podem ser citados como fonte). Bloco vazio quando não há
 * nota — o `buildVaultUser` troca pelo aviso de "nenhuma nota sincronizada".
 */
export function montarBlocoMemoria(
  notas: NotaVault[],
  texto: string,
): { bloco: string; titulos: string[] } {
  const termos = termosBusca(texto);
  const partes: string[] = [];
  const titulos: string[] = [];
  let usado = 0;
  for (const n of notas.slice(0, MEMORIA_MAX_NOTAS)) {
    if (usado >= MEMORIA_TOTAL_CHARS) break;
    const budget = Math.min(MEMORIA_NOTA_CHARS, MEMORIA_TOTAL_CHARS - usado);
    const trecho = trechoRelevante(n.conteudo, termos, budget);
    if (!trecho.trim()) continue;
    partes.push(`### ${n.titulo}\n${trecho}`);
    titulos.push(n.titulo);
    usado += trecho.length + n.titulo.length + 5;
  }
  return { bloco: partes.join('\n\n'), titulos };
}

export interface HistoricoTurno {
  pergunta: string;
  resposta: string;
}

// ---------- Classificação de rota (modo Auto) ----------

export const SYSTEM_ROTA = `Você é um roteador de perguntas. Decida a melhor fonte para responder à pergunta do usuário.
Responda APENAS com uma palavra:
- "vault" quando a pergunta puder ser respondida com o conhecimento interno da empresa (diretrizes, decisões, notas, contexto do negócio) ou for reflexão/estratégia sobre a própria operação.
- "web" quando a pergunta exigir informação atual, pública ou externa (notícias, cotações, dados de mercado, fatos gerais, algo que muda no tempo).
Não explique. Responda só "vault" ou "web".`;

// ---------- Modo Memória (vault) ----------

export const SYSTEM_VAULT = `Você é a inteligência da Memória de um líder/CEO dentro do beculture, uma plataforma de inteligência de pessoas.
Você recebe duas fontes de contexto:
- MEMÓRIA: as notas do próprio usuário (os arquivos da base de conhecimento dele). É a fonte principal de fatos.
- REFERÊNCIAS: recortes atuais que o usuário trouxe (Notas rápidas, To-do). Contexto complementar.

Como responder:
- Responda em português do Brasil, de forma prática, direta e estruturada.
- Baseie-se PRIMEIRO no conteúdo da MEMÓRIA e das REFERÊNCIAS. Não invente fatos, métricas ou decisões que não estejam ali.
- Se a MEMÓRIA não cobrir a pergunta, diga com franqueza o que falta e responda com o melhor raciocínio possível, deixando claro o que é suposição.
- Quando fizer sentido, termine com recomendações acionáveis e próximos passos.

${REGRA_CONEXOES_VAULT.trim()}

Depois do bloco de Conexões — e só depois dele —, acrescente a ÚLTIMA linha da resposta, isolada, no formato exato:
FONTES: <títulos das notas da MEMÓRIA que você realmente usou, separados por " | ">
Use apenas títulos que apareceram no bloco MEMÓRIA. Se não usou nenhum, escreva "FONTES:" sem nada depois. Essa linha é lida pelo sistema e será removida antes de mostrar ao usuário.`;

function blocoHistorico(historico: HistoricoTurno[]): string {
  if (!historico.length) return '';
  const linhas = historico
    .map((t) => `Usuário: ${t.pergunta}\nAssistente: ${t.resposta}`)
    .join('\n\n');
  return `\n\n## CONVERSA ANTERIOR\n${linhas}`;
}

export function buildVaultUser(p: {
  texto: string;
  /** Notas do usuário (vault .md) recuperadas para a pergunta. */
  notasBloco?: string;
  referencia?: string;
  anexo?: string;
  anexoNome?: string;
  historico?: HistoricoTurno[];
  /** Títulos das notas do vault — alvos possíveis dos [[wikilinks]]. */
  titulosVault?: string[];
}): string {
  const partes: string[] = [];

  partes.push(
    p.notasBloco && p.notasBloco.trim()
      ? `## MEMÓRIA (suas notas)\n${p.notasBloco.trim()}`
      : `## MEMÓRIA\n(Nenhuma nota sincronizada ainda — abra a tela Memória e selecione sua pasta.)`,
  );

  if (p.referencia && p.referencia.trim()) {
    partes.push(`## REFERÊNCIAS (Notas / Insights / To-do's)\n${p.referencia.trim()}`);
  }

  if (p.anexo && p.anexo.trim()) {
    partes.push(
      `## ANEXO${p.anexoNome ? ` (${p.anexoNome})` : ''}\n${p.anexo.trim()}`,
    );
  }

  partes.push(blocoTitulosVault(p.titulosVault ?? []).trim());
  partes.push(blocoHistorico(p.historico ?? []).trim());
  partes.push(`## PERGUNTA\n${p.texto.trim()}`);

  return partes.filter(Boolean).join('\n\n');
}

/**
 * Separa a linha "FONTES: a | b" que o modelo acrescenta ao fim da resposta do
 * modo Memória. Retorna a resposta limpa e a lista de títulos citados.
 */
export function extrairFontesVault(text: string): {
  resposta: string;
  fontes: string[];
} {
  const linhas = text.split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    const m = linhas[i].match(/^\s*FONTES:\s*(.*)$/i);
    if (m) {
      const fontes = m[1]
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const resposta = linhas.slice(0, i).join('\n').trim();
      return { resposta, fontes };
    }
    // Só olhamos as últimas linhas não vazias; se achar texto real, para.
    if (linhas[i].trim()) break;
  }
  return { resposta: text.trim(), fontes: [] };
}

// ---------- Modo Web ----------

export const SYSTEM_WEB = `Você é um assistente de pesquisa dentro do beculture, uma plataforma para líderes e CEOs.
Use a busca na web para responder com informação atual e confiável.
Responda em português do Brasil, de forma direta e objetiva, citando os dados encontrados.
Não invente fontes: baseie-se apenas no que a busca retornou. Se a busca não trouxer algo confiável, diga isso.
${REGRA_CONEXOES_VAULT.trim()}

Aqui o bloco "${TITULO_CONEXOES_VAULT}" liga o que a busca trouxe aos assuntos que o usuário já tem na Memória — é a última coisa da resposta.`;

export function buildWebUser(p: {
  texto: string;
  historico?: HistoricoTurno[];
  /** Títulos das notas do vault — alvos possíveis dos [[wikilinks]]. */
  titulosVault?: string[];
}): string {
  return [
    blocoHistorico(p.historico ?? []).trim(),
    blocoTitulosVault(p.titulosVault ?? []).trim(),
    `## PERGUNTA\n${p.texto.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
