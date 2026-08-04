// Prompts do "Criar Dashboard" — mesma linha do "Criar artigo"/"Criar
// apresentação". Geração direta (single-shot) com refino iterativo. A IA devolve
// JSON { titulo, descricao, html, conexoes }, onde `html` é uma página autônoma
// (CSS/JS inline, sem recursos externos) com KPIs, gráficos e tabelas.
// `conexoes` é o bloco "## 🔗 Conexões no Vault" (conexoes-vault.ts), anexado à
// nota quando o dashboard é salvo na Memória — fora do HTML, que é o artefato.

import {
  blocoTitulosVault,
  normalizarConexoes,
  regraConexoesVaultCampo,
} from '../conexoes-vault';

const REGRAS_DASHBOARD = `
Regras do HTML gerado (obrigatórias):
- Página ÚNICA e AUTÔNOMA: todo o CSS em <style> e todo o JS em <script> inline. NÃO use CDN, fontes, imagens ou scripts externos — nada de <link>/<script src>. Sem fetch/XHR.
- Gráficos: desenhe com SVG inline ou <canvas> + JS puro. NÃO use bibliotecas (Chart.js, D3, etc.).
- Layout responsivo (grid/flex), com uma linha de KPIs no topo e cards de gráficos/tabelas abaixo. Deve ficar bom em tela clara.
- Visual limpo e profissional: espaçamento generoso, cantos arredondados, uma paleta sóbria (azul/verde/âmbar como destaques). Sem emojis em excesso.
- Se não houver dados reais no pedido, gere números de EXEMPLO plausíveis e deixe claro (um rótulo "dados de exemplo") — nunca invente fatos apresentados como reais.
- Comece em <!doctype html> e entregue um documento completo (<html><head>…</head><body>…</body></html>).`;

export const SYSTEM_DASHBOARD = `Você é um especialista em visualização de dados e front-end, escrevendo em português do Brasil.
Sua tarefa é criar um DASHBOARD executivo como uma única página HTML autônoma, a partir do tema/dados fornecidos.
O dashboard deve contar uma história com os números: KPIs no topo, gráficos que respondem "e daí?", e uma leitura fácil em segundos.${REGRAS_DASHBOARD}

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "titulo": "Título do dashboard", "descricao": "Uma linha do que ele mostra", "html": "<!doctype html>...documento HTML completo...", "conexoes": "O bloco de Conexões no Vault em Markdown" }

O bloco de conexões vai SÓ no campo "conexoes" — nunca dentro do HTML.${regraConexoesVaultCampo('conexoes')}`;

export interface Dashboard {
  titulo: string;
  descricao: string;
  html: string;
  /** Bloco "## 🔗 Conexões no Vault" — anexado à nota ao salvar na Memória. */
  conexoes: string;
}

export interface DashboardInput {
  tema: string;
  dados?: string;
  contexto?: string;
  referencia?: string;
  ajuste?: string;
  anterior?: Dashboard | null;
  /** Títulos das notas do vault — alvos possíveis dos [[wikilinks]]. */
  titulosVault?: string[];
}

export function buildDashboardUser(input: DashboardInput): string {
  const {
    tema,
    dados = '',
    contexto = '',
    referencia = '',
    ajuste = '',
    anterior,
    titulosVault = [],
  } = input;
  let extra = '';
  if (ajuste.trim()) {
    if (anterior) extra += `\n## VERSÃO ANTERIOR (JSON)\n${JSON.stringify(anterior)}\n`;
    extra += `\n## AJUSTE PEDIDO\n${ajuste.trim()}\nRefaça o dashboard aplicando ESTE ajuste e preservando o que já está bom. Mantenha o mesmo formato JSON.\n`;
  }
  return (
    `## TEMA / OBJETIVO DO DASHBOARD\n${tema}\n` +
    (dados.trim()
      ? `\n## DADOS (use estes números; cole aqui tabelas, CSV, métricas)\n${dados.slice(0, 20000)}\n`
      : '') +
    (contexto.trim() ? `\n## CONTEXTO / INSTRUÇÕES\n${contexto.trim()}\n` : '') +
    (referencia.trim()
      ? `\n## MATERIAL DE REFERÊNCIA (base factual; não copie literalmente)\n${referencia.slice(0, 20000)}\n`
      : '') +
    extra +
    blocoTitulosVault(titulosVault) +
    `\nGere o dashboard no formato JSON pedido, com o campo "conexoes" preenchido.`
  );
}

/** Extrai o dashboard do texto da IA, com fallback robusto (HTML cru). */
export function parseDashboard(raw: string, tema: string): Dashboard {
  const txt = (raw || '').trim();
  const fence = txt.match(/```(?:json|html)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;

  // Caminho feliz: JSON { titulo, descricao, html }.
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const obj = JSON.parse(semFence.slice(first, last + 1)) as Record<string, unknown>;
      const html = String(obj.html || '').trim();
      if (html) {
        return {
          titulo: String(obj.titulo || tema || 'Dashboard').slice(0, 200),
          descricao: String(obj.descricao || '').slice(0, 300),
          html,
          conexoes: normalizarConexoes(String(obj.conexoes || '')),
        };
      }
    } catch {
      /* cai no fallback abaixo */
    }
  }

  // Fallback: a IA devolveu o HTML cru (com ou sem cerca).
  const htmlMatch = txt.match(/<!doctype html[\s\S]*<\/html>/i) || txt.match(/<html[\s\S]*<\/html>/i);
  const html = (htmlMatch ? htmlMatch[0] : fence ? fence[1] : txt).trim();
  return { titulo: tema || 'Dashboard', descricao: '', html, conexoes: '' };
}
