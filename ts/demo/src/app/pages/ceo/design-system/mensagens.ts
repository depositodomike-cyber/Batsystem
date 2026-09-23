import type { ConfirmMessages } from "@/components/shared/ConfirmModal";

/**
 * Textos da confirmação de exclusão de uma marca.
 *
 * Fora do componente para o texto poder ser lido e revisado sem o JSX em volta.
 *
 * O `ConfirmModal` traz mensagens padrão em inglês, então passar `messages` é
 * obrigatório em todo uso dentro de `ceo/`.
 */
export const MENSAGENS_EXCLUIR_MARCA = (nome: string): ConfirmMessages => ({
  pending: {
    title: "Excluir identidade visual?",
    // Diz o que NÃO acontece de propósito: o design fica embutido no arquivo
    // gerado, então nenhuma apresentação antiga muda por causa desta exclusão.
    description: `"${nome || "Sem nome"}" sai da organização para todo mundo. O conteúdo já gerado não muda.`,
    actionText: "Excluir",
  },
  success: {
    title: "Marca excluída",
    description: "Ela não aparece mais no seletor de marca do AI Studio.",
    actionText: "Ok",
  },
  error: {
    title: "Não foi possível excluir",
    description: "Verifique a conexão e tente de novo.",
    actionText: "Tentar de novo",
  },
});
