import type { ConfirmMessages } from "@/components/shared/ConfirmModal";

/**
 * Confirmação de exclusão de um template. Diz o que NÃO acontece: as criações
 * guardam a própria cópia da estrutura usada, então nada já gerado muda.
 */
export const MENSAGENS_EXCLUIR_TEMPLATE = (nome: string): ConfirmMessages => ({
  pending: {
    title: "Excluir template?",
    description: `"${nome || "Sem nome"}" é excluído. Apresentações já criadas com ele não mudam.`,
    actionText: "Excluir",
  },
  success: {
    title: "Template excluído",
    description: "Ele não aparece mais na criação de apresentações do Lab.",
    actionText: "Ok",
  },
  error: {
    title: "Não foi possível excluir",
    description: "Verifique a conexão e tente de novo.",
    actionText: "Tentar de novo",
  },
});
