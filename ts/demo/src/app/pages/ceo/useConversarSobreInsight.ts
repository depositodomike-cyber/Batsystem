import { useState } from "react";
import { useAssistente } from "@/app/contexts/assistente/context";
import {
  FILTRO_OPCOES,
  type Insight,
  type InsightDetalhe,
} from "@/app/data/insights";
import { buscarInsightApi } from "@/services/api/insights";

// "Conversar com o assistente" a partir de um insight — usado no menu ••• do
// card e no modal "Ver insight". Abre o assistente com uma conversa nova
// sobre o insight; o conteúdo dele vai como contexto (referência em todos os
// turnos, sem aparecer nas bolhas), e o usuário segue perguntando.

const ROTULO_SEVERIDADE = Object.fromEntries(
  FILTRO_OPCOES.map((o) => [o.value, o.label]),
) as Record<string, string>;

/** Bloco de contexto do insight para a IA. Só o que existe. */
function contextoDoInsight(i: Insight | InsightDetalhe): string {
  const d = "evidencias" in i ? i : null;
  const linhas = [
    "### Insight em discussão",
    "O usuário abriu esta conversa a partir deste insight. Ajude-o a entendê-lo e a agir a partir dele, sem inventar dados que não estejam aqui ou no Repositório.",
    `Título: ${i.titulo}`,
    `Tema: ${i.tipo}${ROTULO_SEVERIDADE[i.cor] ? ` · ${ROTULO_SEVERIDADE[i.cor]}` : ""}`,
    `Resumo: ${i.descricao}`,
  ];
  if (i.liderado) linhas.push(`Pessoa/time: ${i.liderado}`);
  if (d?.analise) linhas.push(`Análise:\n${d.analise}`);
  if (d?.evidencias.length)
    linhas.push(
      `Evidências (trechos do material):\n${d.evidencias.map((e) => `- “${e}”`).join("\n")}`,
    );
  if (d?.fonte) linhas.push(`Fonte: ${d.fonte.titulo} (${d.fonte.categoria})`);
  if (i.direcionamento)
    linhas.push(`Orientação relacionada: ${i.direcionamento.nome}`);
  return linhas.join("\n");
}

export function useConversarSobreInsight(): {
  /**
   * Abre a conversa. Com o detalhe já carregado (modal), usa-o direto; senão
   * busca análise/evidências e, se falhar, segue só com o resumo.
   */
  conversar: (item: Insight, detalhe?: InsightDetalhe | null) => Promise<void>;
  /** Assistente respondendo ou detalhe sendo buscado — desabilite a ação. */
  ocupado: boolean;
} {
  const { perguntar, loading } = useAssistente();
  const [preparando, setPreparando] = useState(false);

  const conversar = async (item: Insight, detalhe?: InsightDetalhe | null) => {
    let base: Insight | InsightDetalhe = detalhe ?? item;
    if (!detalhe) {
      setPreparando(true);
      base = await buscarInsightApi(item.id).catch(() => item);
      setPreparando(false);
    }
    void perguntar({
      modo: "vault",
      contexto: contextoDoInsight(base),
      texto: `Quero entender melhor o insight “${item.titulo}”. O que ele significa e quais ações práticas você recomenda a partir dele?`,
    });
  };

  return { conversar, ocupado: loading || preparando };
}
