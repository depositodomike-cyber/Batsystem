// Prompts do "Criar Ata" — portado do beculture/Confi (lib/claude.js, criarAta
// e criarAtaVault). A partir de uma transcrição/anotações, a IA redige uma ata
// executiva em Markdown. Opção "Memória": frontmatter + [[wikilinks]] às
// diretrizes existentes. Devolve JSON { titulo, ata }.
//
// A ata pode ser salva na Memória, então ela sempre fecha com o bloco
// "## 🔗 Conexões no Vault" (conexoes-vault.ts), dentro do campo "ata".

import {
  blocoTitulosVault,
  FOCO_ENTIDADES_ATA,
  regraConexoesVaultAtaJson,
} from '../conexoes-vault';

export const SYSTEM_ATA = `Você é um secretário executivo experiente que redige ATAS DE REUNIÃO em português do Brasil.
Recebe o CONTEÚDO de uma reunião (transcrição, anotações ou documento) e produz uma ata completa, executiva e profissional em Markdown.

A ata deve conter, nesta ordem (omita uma seção apenas se não houver QUALQUER informação para ela):
- **Cabeçalho** — reunião, data (se constar no conteúdo) e participantes (se identificáveis).
- **## Objetivo** — 1-2 frases sobre o propósito do encontro.
- **## Resumo executivo** — um parágrafo curto com o essencial.
- **## Pontos discutidos** — os temas tratados, organizados.
- **## Decisões** — decisões tomadas, em bullets claros.
- **## Ações e responsáveis** — lista "- [ ] Tarefa — responsável — prazo" (responsável e prazo só quando mencionados).
- **## Próximos passos** — encaminhamentos e follow-ups.
- **## Pendências / pontos em aberto** — questões não resolvidas.

Regras: seja fiel ao conteúdo, NÃO invente fatos, nomes, datas nem números. Se algo não estiver claro, não afirme. Escreva de forma objetiva e formal, própria de uma ata. Se houver INSTRUÇÕES do usuário, siga-as.
Em "titulo", sugira um título curto e descritivo para a ata (no máximo 8 palavras, sem aspas).

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "titulo": "Título curto", "ata": "A ata completa em Markdown" }${regraConexoesVaultAtaJson('ata')}`;

export const SYSTEM_ATA_MEMORIA = `${SYSTEM_ATA}

FORMATO MEMÓRIA (aplique ALÉM das regras acima):
- A ata será guardada na Memória. Comece a nota por um frontmatter YAML mínimo e coerente: titulo, data (se houver), participantes (se houver), tags: [ata, reunião].
- Ao longo do corpo, crie [[wikilinks]] integrando a ata ao que já está registrado. ${FOCO_ENTIDADES_ATA}
  Prefira os títulos que EXISTAM na lista de TÍTULOS DA MEMÓRIA (copiados exatamente); o bloco final "Conexões no Vault" cobre as demais entidades, inclusive as marcadas "(novo)".
- O campo "ata" deve conter a nota Markdown COMPLETA: frontmatter no topo + o corpo da ata com as seções.`;

export interface Ata {
  titulo: string;
  ata: string;
}

export interface AtaInput {
  conteudo: string;
  instrucoes?: string;
  memoria?: boolean;
  titulosMemoria?: string[];
  /** Títulos das notas do vault — alvos possíveis dos [[wikilinks]]. */
  titulosVault?: string[];
}

export function buildAtaUser(input: AtaInput): string {
  const {
    conteudo,
    instrucoes = '',
    memoria = false,
    titulosMemoria = [],
    titulosVault = [],
  } = input;
  return (
    `## CONTEÚDO DA REUNIÃO\n${String(conteudo).slice(0, 60000)}\n` +
    (instrucoes.trim() ? `\n## INSTRUÇÕES\n${instrucoes.trim()}\n` : '') +
    (memoria && titulosMemoria.length
      ? `\n## TÍTULOS DA MEMÓRIA (use para [[wikilinks]] quando citados; não invente)\n${titulosMemoria
          .map((t) => `- ${t}`)
          .join('\n')}\n`
      : '') +
    blocoTitulosVault(titulosVault) +
    `\nRedija a ata no formato JSON pedido, fechando o campo "ata" com o bloco de Conexões no Vault.`
  );
}

/** Extrai a ata do texto da IA, com fallback robusto (markdown cru). */
export function parseAta(raw: string): Ata {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(semFence.slice(first, last + 1)) as Record<string, unknown>;
      const ata = String(obj.ata || '').trim();
      if (ata) {
        return { titulo: String(obj.titulo || 'Ata de reunião').slice(0, 200), ata };
      }
    } catch {
      /* fallback abaixo */
    }
  }
  const corpo = (fence ? fence[1] : txt).trim();
  const h = corpo.match(/^#{1,3}\s+(.+)$/m);
  return { titulo: (h ? h[1] : 'Ata de reunião').slice(0, 200), ata: corpo };
}
