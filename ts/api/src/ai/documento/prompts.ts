// Prompt do "Upload Documento" — portado do beculture/Confi (criarNotaIA, tarefa
// 'documento'). Organiza um conteúdo bruto num DOCUMENTO de referência bem
// estruturado, formatado para a Memória. Devolve JSON { titulo, conteudo, resumo }.
// A nota fecha com o bloco "## 🔗 Conexões no Vault" (conexoes-vault.ts).

import { blocoTitulosVault, regraConexoesVaultJson } from '../conexoes-vault';

export const SYSTEM_DOCUMENTO = `Você organiza conteúdos na Memória do usuário, escrevendo em português do Brasil.
Você recebe um CONTEÚDO DE ORIGEM (um documento colado ou extraído de um arquivo) e a lista de TÍTULOS DA MEMÓRIA existentes.

Sua tarefa: organizar o conteúdo como um DOCUMENTO DE REFERÊNCIA bem estruturado, preservando a informação do original SEM inventar fatos.

Regras de formatação:
- Comece por um frontmatter YAML mínimo e coerente: titulo, tipo: documento, data (se houver), tags.
- Título claro (H1) e seções com cabeçalhos "##" que organizem o conteúdo logicamente.
- Crie [[wikilinks]] para pessoas, projetos e temas citados QUE EXISTAM na lista de TÍTULOS DA MEMÓRIA. NUNCA invente links para itens fora da lista.
- Não invente fatos, números, nomes ou datas que não estejam no conteúdo de origem. Se algo estiver ambíguo, preserve como está.
- Melhore a legibilidade (listas, tabelas quando fizer sentido), sem alterar o significado.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "titulo": "Título do documento", "conteudo": "A nota Markdown completa (frontmatter + corpo)", "resumo": "Uma frase curta descrevendo o que foi organizado" }${regraConexoesVaultJson('conteudo')}`;

export interface Documento {
  titulo: string;
  conteudo: string;
  resumo: string;
}

export function buildDocumentoUser(
  conteudo: string,
  titulosMemoria: string[] = [],
  titulosVault: string[] = [],
): string {
  return (
    (titulosMemoria.length
      ? `## TÍTULOS DA MEMÓRIA (use para [[wikilinks]] quando citados; não invente)\n${titulosMemoria
          .map((t) => `- ${t}`)
          .join('\n')}\n\n`
      : '') +
    `## CONTEÚDO DE ORIGEM\n${String(conteudo).slice(0, 120000)}\n` +
    blocoTitulosVault(titulosVault) +
    `\nOrganize o conteúdo como um documento de referência, no formato JSON pedido, fechando o campo "conteudo" com o bloco de Conexões no Vault.`
  );
}

/** Extrai o documento da IA, com fallback robusto (markdown cru). */
export function parseDocumento(raw: string): Documento {
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
        return {
          titulo: String(obj.titulo || 'Documento').slice(0, 200),
          conteudo,
          resumo: String(obj.resumo || '').slice(0, 400),
        };
      }
    } catch {
      /* fallback abaixo */
    }
  }
  const corpo = (fence ? fence[1] : txt).trim();
  const h = corpo.match(/^#{1,3}\s+(.+)$/m);
  return { titulo: (h ? h[1] : 'Documento').slice(0, 200), conteudo: corpo, resumo: '' };
}
