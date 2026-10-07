// Arquivos da conversa: o entregável que um AGENTE devolve dentro da resposta.
//
// O agente escreve o documento num bloco marcado; o servidor tira o bloco do
// texto visível e o grava no `meta` da mensagem (ver persistPromptTurn). Assim
// o arquivo pertence à CONVERSA — reabrir a conversa pelo Histórico o traz de
// volta — e só vai para o Repositório se o usuário pedir ("Salvar no
// Repositório", no cliente).
import { randomUUID } from 'node:crypto';

/** Um arquivo gerado numa conversa. Vive no `meta.arquivos` da mensagem. */
export interface ArquivoConversa {
  id: string;
  nome: string;
  tipo: 'md';
  conteudo: string;
  /** Bytes do conteúdo em UTF-8. */
  tamanho: number;
  /** Id do documento no Repositório da organização, depois de salvo. */
  repositorioDocumentoId?: string | null;
  /** Agente que gerou o arquivo (o arquivo pertence à conversa). */
  geradoPor?: { id: string; titulo: string } | null;
}

/**
 * Regra anexada ao system prompt quando um agente participa. Vai ANTES das
 * regras de Conexões/FONTES no texto final para que o bloco do arquivo nunca
 * fique depois da linha FONTES (que precisa ser a última).
 */
export const REGRA_ARQUIVO = `

## Arquivos (entregáveis)
Quando o usuário pedir explicitamente um ENTREGÁVEL — um documento para usar fora da conversa, como diagnóstico, plano, relatório, roteiro, política, checklist ou apresentação em texto —, escreva uma frase curta de introdução e coloque o documento completo, em Markdown, dentro de um bloco neste formato exato:

:::arquivo nome="Título do documento.md"
(conteúdo do documento em Markdown)
:::

Regras do bloco:
- No máximo UM bloco por resposta, antes do bloco de Conexões e da linha FONTES.
- O nome é um título curto e descritivo terminado em .md.
- Para perguntas, conversas e explicações comuns, NÃO use o bloco: responda normalmente.`;

const BLOCO = /:::arquivo\s+nome="([^"\n]{1,120})"\s*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/g;

/** Tira os blocos `:::arquivo` do texto e devolve os arquivos encontrados. */
export function extrairArquivos(texto: string): {
  resposta: string;
  arquivos: ArquivoConversa[];
} {
  const arquivos: ArquivoConversa[] = [];
  const resposta = texto
    .replace(BLOCO, (_m, nomeBruto: string, corpo: string) => {
      const conteudo = corpo.trim();
      if (!conteudo) return '';
      const nome = nomeDoArquivo(nomeBruto);
      arquivos.push({
        id: randomUUID(),
        nome,
        tipo: 'md',
        conteudo,
        tamanho: Buffer.byteLength(conteudo, 'utf8'),
      });
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { resposta, arquivos: arquivos.slice(0, 1) };
}

function nomeDoArquivo(bruto: string): string {
  const limpo = bruto.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const base = limpo.replace(/\.md$/i, '') || 'Documento';
  return `${base.slice(0, 100)}.md`;
}
