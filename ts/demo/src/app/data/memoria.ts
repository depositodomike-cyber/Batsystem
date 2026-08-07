// ----------------------------------------------------------------------
// Memória da IA — base de conhecimento de longo prazo do BeHuman.
// É o que a IA "lembra" sobre a empresa entre as conversas: fatos, contexto,
// decisões e preferências aprendidos nos chats e squads. Cada memória ativa é
// injetada no contexto das respostas para personalizá-las. Este arquivo define
// os tipos e os temas (categorias) da página /<produto>/memoria; os DADOS vêm
// da API (ver services/api/memorias.ts + contexts/memory).
//
// Os "temas" das memórias são as PASTAS DA MEMÓRIA — as pastas de primeiro
// nível do vault que alimenta o grafo (ver utils/memoriaVault.ts
// `listarPastasMemoria`). Vale para TODA opção de gravar no Contexto: o tema
// escolhido é sempre uma pasta existente, nunca uma lista paralela. A lista é
// montada em runtime pelo hook `usePastasMemoria` (pages/ceo), que passa as
// pastas para `buildMemoryCategories(pastas)`.
// ----------------------------------------------------------------------

export interface MemoryCategory {
  /** Id do tema = nome da pasta no Contexto (ex.: "Reuniões", "Plano LATAM"). */
  id: string;
  label: string;
  /** Descrição curta exibida no cabeçalho/filtro. */
  description: string;
  /** Classe de cor (texto) usada nos realces do tema. */
  tint: string;
}

// Paleta usada para colorir o tema de cada pasta (atribuída por posição).
const PASTA_TINTS = [
  "text-sky-500",
  "text-emerald-500",
  "text-violet-500",
  "text-rose-500",
  "text-cyan-500",
  "text-orange-500",
  "text-teal-500",
  "text-fuchsia-500",
  "text-lime-600",
  "text-pink-500",
  "text-blue-500",
  "text-purple-500",
  "text-green-600",
  "text-indigo-500",
  "text-amber-500",
];

/**
 * Monta a lista de temas do Contexto a partir das pastas do vault: um tema por
 * pasta (id = nome da pasta), em ordem alfabética. Duplicatas são descartadas
 * para a lista sobreviver a uma união de fontes (pastas do vault + padrão).
 */
export function buildMemoryCategories(pastas: string[]): MemoryCategory[] {
  return [...new Set(pastas.map((p) => p.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((pasta, i) => ({
      id: pasta,
      label: pasta,
      description: `Contextos guardados na pasta ${pasta}.`,
      tint: PASTA_TINTS[i % PASTA_TINTS.length]!,
    }));
}

/** Confiança da IA no fato memorizado. */
export type MemoryConfidence = "alta" | "media" | "baixa";

export interface MemoryItem {
  id: string;
  /** Tema da memória = pasta do Contexto em que ela se encaixa. */
  category: string;
  /** Resumo curto da memória (uma linha). */
  title: string;
  /** O fato em si, como a IA o registrou. */
  content: string;
  /** De onde a memória veio (ex.: "Chat · Onboarding", "Manual"). */
  source: string;
  /** Data em que a IA aprendeu/atualizou (dd/mm/aaaa). */
  date: string;
  /** Quando ativa, a IA usa esta memória nas respostas. */
  active: boolean;
  /** Definição corporativa (read-only): não pode ser desativada nem alterada. */
  corporate: boolean;
  confidence: MemoryConfidence;
}

// Limites validados pela API (ts/api/src/memorias/dto). Ficam aqui para os
// formulários avisarem ANTES de enviar — passar do teto devolve 400 e a
// gravação parece simplesmente "não ter funcionado".
export const MEMORIA_MAX_TITULO = 160;
export const MEMORIA_MAX_CONTEUDO = 8000;

export const CONFIDENCE_LABEL: Record<MemoryConfidence, string> = {
  alta: "Alta confiança",
  media: "Confiança média",
  baixa: "A confirmar",
};
