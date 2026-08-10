// ----------------------------------------------------------------------
// "Salvar no Repositório" de um conteúdo avulso — e-mail, conversa do Slack, nota.
//
// Memória é a PASTA de arquivos .md: é dela que sai o grafo
// (/<produto>/memoria-grafo) e é ela que a IA consulta. O store `/memorias` do
// backend é outra coisa — a tela "Regras" (conduta da IA). Por
// isso gravar no Repositório é escrever um .md na pasta (tema) escolhida.
//
// Era exatamente o que faltava nos conectores: E-mail, Slack e Notas mandavam o
// conteúdo para o store `/memorias`, então nada aparecia no Repositório nem chegava
// à IA como conhecimento — o "Salvar no Repositório" parecia não funcionar.
//
// Depois de gravar, a nota é indexada no backend (/ai/vault/sync/batch) para a
// IA encontrá-la na mesma hora, sem esperar a próxima abertura do grafo.
// ----------------------------------------------------------------------

import { toast } from "sonner";

import {
  escreverNotaMemoria,
  type AnexoMemoria,
  type WriteResult,
} from "@/utils/memoriaVault";
import { syncVaultBatch } from "@/services/api/vault";

type FalhaMemoria = Extract<WriteResult, { ok: false }>["reason"];

export interface ConteudoNaMemoria {
  /** Tema = pasta do Repositório escolhida no modal (ver usePastasMemoria). */
  pasta: string;
  titulo: string;
  conteudo: string;
  /** De onde veio ("E-mail · Camila", "Slack · #produto"). Vai no topo da nota. */
  origem?: string;
  /** Data legível da origem, quando fizer sentido ("12 de março de 2026"). */
  data?: string;
  tags?: string[];
  anexos?: AnexoMemoria[];
}

/**
 * Grava o conteúdo como .md na pasta escolhida do Repositório e o indexa para a IA.
 * Devolve o resultado sem lançar — quem chama decide o feedback (e mantém o
 * modal aberto quando falha).
 */
export async function salvarConteudoNaMemoria(
  opts: ConteudoNaMemoria,
): Promise<WriteResult> {
  const cabecalho = [
    opts.origem?.trim() ? `Origem: ${opts.origem.trim()}` : "",
    opts.data?.trim() ? `Data: ${opts.data.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const r = await escreverNotaMemoria({
    subpasta: opts.pasta,
    titulo: opts.titulo,
    tags: opts.tags,
    anexos: opts.anexos,
    conteudo: [cabecalho, opts.conteudo.trim()].filter(Boolean).join("\n\n"),
  });

  // Indexação em segundo plano: se falhar (API fora, sem sessão), o arquivo já
  // está na pasta e a próxima sincronização do grafo o envia de novo — não é
  // motivo para dizer ao usuário que a gravação não funcionou.
  if (r.ok) {
    void syncVaultBatch([
      { path: `${r.pasta}/${r.arquivo}`, titulo: opts.titulo, conteudo: r.texto },
    ]).catch(() => undefined);
  }

  return r;
}

/**
 * Feedback de falha do "Salvar no Repositório". Diferente de `avisarFalhaMemoria`
 * (memoria-grupos), aqui "navegador sem suporte" TAMBÉM é avisado: a gravação
 * era a ação pedida pelo usuário, então ficar em silêncio é o mesmo bug de
 * antes — o clique não faz nada e ninguém sabe por quê.
 */
export function avisarFalhaAoSalvarNaMemoria(reason: FalhaMemoria) {
  if (reason === "no-folder") {
    toast.error("Nenhuma pasta do Repositório definida", {
      description:
        "Abra o Repositório (ou Configurações), escolha a pasta e tente de novo.",
    });
    return;
  }
  if (reason === "denied") {
    toast.error("Permissão negada", {
      description: "É preciso autorizar a escrita na pasta do Repositório.",
    });
    return;
  }
  if (reason === "unsupported") {
    toast.error("Gravação indisponível neste navegador", {
      description:
        "O Repositório está como cópia somente leitura. Ative o acesso a pastas (no Brave: brave://flags/#file-system-access-api) ou use o Chrome.",
    });
    return;
  }
  toast.error("Não foi possível gravar no Repositório", {
    description: "Tente novamente.",
  });
}
