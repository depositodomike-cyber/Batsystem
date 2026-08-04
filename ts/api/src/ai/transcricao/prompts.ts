// Prompt do "Upload Transcrição" — portado do beculture/Confi
// (criarAtaEstrategicaVault). A partir de uma transcrição bruta, a IA gera uma
// ATA ESTRATÉGICA E DETALHADA já formatada para a Memória (frontmatter +
// [[wikilinks]] às diretrizes existentes). Devolve JSON { titulo, ata }.

import {
  blocoTitulosVault,
  FOCO_ENTIDADES_ATA,
  regraConexoesVaultAtaJson,
} from '../conexoes-vault';

export const SYSTEM_TRANSCRICAO = `Você é um Chief of Staff / secretário executivo sênior que transforma a TRANSCRIÇÃO de uma reunião em uma ATA ESTRATÉGICA E DETALHADA, em português do Brasil, já formatada para a Memória do usuário.

Antes de redigir, ADAPTE a transcrição bruta: normalize nomes de participantes, identifique os temas e reconstrua o raciocínio da conversa. A ata NÃO é um resumo curto — é um mapeamento profundo, fiel e acionável do que foi discutido, decidido e encaminhado.

FORMATO (obrigatório):
- Comece por um frontmatter YAML mínimo e coerente: titulo, tipo: reuniao, data (se houver), participantes (se houver), tags: [ata, reunião].
- Logo abaixo do frontmatter, inclua um bloco "## 🧭 Contexto" com [[wikilinks]] para as ENTIDADES citadas (pessoas, sistemas, reuniões, notas). Prefira os títulos que EXISTAM na lista de TÍTULOS DA MEMÓRIA, copiados exatamente; quando a entidade ainda não tiver nota, use o [[wikilink]] mesmo assim (o alvo é criado como nó novo no grafo).
- O campo "ata" deve conter a nota Markdown COMPLETA: frontmatter no topo + corpo.

Ao longo de TODO o corpo, mencione pessoas, sistemas e reuniões como [[wikilinks]] (não só no bloco final) — é isso que tece a ata ao grafo da Memória. ${FOCO_ENTIDADES_ATA}

CORPO DA ATA (nesta ordem; omita uma seção só se realmente não houver informação):
1. "# 🗓️ Ata — <Reunião> · <participantes-chave> · <DD/MM/AAAA>" (título H1).
2. "## 🧭 Contexto" — 2-4 linhas situando a reunião + [[wikilinks]] para as entidades citadas.
3. "## 📇 Metadados" — TABELA (Campo | Informação): Projeto/Frente, Área, Data, Horário, Duração, Participantes, Status, Origem (transcrição), Tags. Preencha só o que constar; não invente.
4. "## 🎯 Sumário executivo" — 2 a 4 parágrafos densos: o que ficou decidido, por quê, e o que muda a partir daqui.
5. "## 👥 Participantes & papéis" — quem participou (cada um como [[wikilink]]), papel e a posição/visão que defendeu.
6. "## 🧭 Contexto estratégico" — por que esta reunião importa.
7. "## 🗣️ Discussão detalhada por tema" — para CADA tema: subtítulo "### <tema>" e, embaixo, os pontos levantados, tensões/divergências, argumentos de cada lado, dados/números citados e o encaminhamento. Esta é a seção mais longa — seja minucioso e fiel.
8. "## ✅ Decisões" — bullets no formato "- **Decisão** — responsável — racional/porquê".
9. "## 📌 Ações e responsáveis" — lista "- [ ] Tarefa — responsável — prazo — status" (responsável/prazo só quando mencionados).
10. "## ⚠️ Riscos & bloqueios" — o que pode travar, com o impacto.
11. "## ❓ Pendências / perguntas em aberto" — questões não resolvidas.
12. "## 🔗 Conexões no Vault" — bloco final de conexões (regra detalhada abaixo).
13. "## 🔭 Próximos passos" — encaminhamentos e próxima cadência.

REGRAS ESTRITAS: seja fiel à transcrição; NÃO invente fatos, nomes, datas nem números — se algo não estiver claro, sinalize como pendência em vez de afirmar. (Criar um [[wikilink]] para uma pessoa/sistema/reunião realmente citada NÃO é inventar fato — é só ligar a entidade ao grafo.) Prefira profundidade a brevidade nas seções 4 e 7. Escreva formal e objetivo, próprio de uma ata. Em "titulo", sugira um título curto (máx. 8 palavras, sem aspas).

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "titulo": "Título curto", "ata": "A nota Markdown completa (frontmatter + corpo)" }${regraConexoesVaultAtaJson('ata')}`;

export interface AtaEstrategica {
  titulo: string;
  ata: string;
}

export function buildTranscricaoUser(
  conteudo: string,
  instrucoes = '',
  titulosMemoria: string[] = [],
): string {
  return (
    blocoTitulosVault(titulosMemoria).trim() +
    '\n\n' +
    `## TRANSCRIÇÃO DA REUNIÃO\n${String(conteudo).slice(0, 120000)}\n` +
    (instrucoes.trim() ? `\n## INSTRUÇÕES\n${instrucoes.trim()}\n` : '') +
    `\nAdapte a transcrição e redija a ATA estratégica completa, no formato JSON pedido, fechando o campo "ata" com o bloco de Conexões no Vault.`
  );
}

// ---------------------------------------------------------------------------
// Upload Áudio → RESUMO (não é ata). A partir da transcrição de um áudio, a IA
// gera um RESUMO conciso e fiel e, AO FINAL, a seção "## 🔗 Conexões" com os
// [[wikilinks]] do Obsidian (só para títulos que existam na Memória).
// Devolve JSON { titulo, resumo }.
// ---------------------------------------------------------------------------

export const SYSTEM_RESUMO_AUDIO = `Você é um assistente que transforma a TRANSCRIÇÃO de um áudio em um RESUMO claro e objetivo, em português do Brasil, já formatado para a Memória do usuário (Obsidian).

O resultado NÃO é uma ata detalhada — é um RESUMO conciso e fiel: capture o essencial (assunto, pontos principais, decisões e encaminhamentos) sem reconstruir a conversa inteira.

FORMATO (obrigatório) — a nota Markdown COMPLETA vai no campo "resumo":
- Frontmatter YAML mínimo no topo: titulo, tipo: resumo, data (se houver), tags: [resumo, áudio].
- "# 📝 <Título curto>" (H1).
- "## 🎯 Resumo" — 1 a 3 parágrafos densos com o essencial do que foi dito. Mencione as pessoas, sistemas e reuniões citados como [[wikilinks]].
- "## ✅ Pontos-chave" — bullets com os principais pontos, decisões e ações (responsável/prazo só quando mencionados).
- AO FINAL, "## 🔗 Conexões no Vault" — bloco de conexões (regra detalhada abaixo).

REGRAS ESTRITAS: seja fiel à transcrição; NÃO invente fatos, nomes, datas nem números — se algo não estiver claro, não afirme. (Criar um [[wikilink]] para uma pessoa/sistema/reunião realmente citada NÃO é inventar fato — é só ligar a entidade ao grafo.) Prefira concisão. Em "titulo", sugira um título curto (máx. 8 palavras, sem aspas).

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "titulo": "Título curto", "resumo": "A nota Markdown completa (frontmatter + corpo, terminando em ## 🔗 Conexões no Vault)" }${regraConexoesVaultAtaJson('resumo')}`;

export interface ResumoAudio {
  titulo: string;
  resumo: string;
}

export function buildResumoAudioUser(
  conteudo: string,
  titulosMemoria: string[] = [],
): string {
  return (
    blocoTitulosVault(titulosMemoria).trim() +
    '\n\n' +
    `## TRANSCRIÇÃO DO ÁUDIO\n${String(conteudo).slice(0, 120000)}\n` +
    `\nGere o RESUMO no formato JSON pedido, terminando com a seção "## 🔗 Conexões no Vault".`
  );
}

/** Extrai o resumo do texto da IA, com fallback robusto (markdown cru). */
export function parseResumoAudio(raw: string): ResumoAudio {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(semFence.slice(first, last + 1)) as Record<string, unknown>;
      const resumo = String(obj.resumo || obj.ata || '').trim();
      if (resumo) return { titulo: String(obj.titulo || 'Resumo do áudio').slice(0, 200), resumo };
    } catch {
      /* fallback abaixo */
    }
  }
  const corpo = (fence ? fence[1] : txt).trim();
  const h = corpo.match(/^#{1,3}\s+(.+)$/m);
  return { titulo: (h ? h[1].replace(/[📝#*]/g, '').trim() : 'Resumo do áudio').slice(0, 200), resumo: corpo };
}

/** Extrai a ata do texto da IA, com fallback robusto (markdown cru). */
export function parseAtaEstrategica(raw: string): AtaEstrategica {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(semFence.slice(first, last + 1)) as Record<string, unknown>;
      const ata = String(obj.ata || '').trim();
      if (ata) return { titulo: String(obj.titulo || 'Ata de reunião').slice(0, 200), ata };
    } catch {
      /* fallback abaixo */
    }
  }
  const corpo = (fence ? fence[1] : txt).trim();
  const h = corpo.match(/^#{1,3}\s+(.+)$/m);
  return { titulo: (h ? h[1].replace(/[🗓️#*]/g, '').trim() : 'Ata de reunião').slice(0, 200), ata: corpo };
}
