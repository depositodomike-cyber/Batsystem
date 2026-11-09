import type { Horizonte, TipoInteresse } from "@/services/api/perfil";

// Rótulos e opções do Perfil Pessoal, usados pela tela e pelo Markdown.

export const TIPOS_INTERESSE: { valor: TipoInteresse; rotulo: string; relacao: string }[] = [
  { valor: "interesse", rotulo: "Interesse pessoal", relacao: "possui interesse em" },
  { valor: "hobby", rotulo: "Hobby", relacao: "tem como hobby" },
  { valor: "atividade", rotulo: "Atividade praticada", relacao: "pratica" },
  { valor: "assunto", rotulo: "Assunto de interesse", relacao: "acompanha o assunto" },
  { valor: "quer-aprender", rotulo: "Quero aprender", relacao: "deseja aprender" },
  { valor: "quer-experimentar", rotulo: "Quero experimentar", relacao: "quer experimentar" },
];

export const rotuloTipoInteresse = (t: string) =>
  TIPOS_INTERESSE.find((x) => x.valor === t)?.rotulo ?? "Interesse pessoal";
export const relacaoTipoInteresse = (t: string) =>
  TIPOS_INTERESSE.find((x) => x.valor === t)?.relacao ?? "possui interesse em";

export const HORIZONTES: { valor: Horizonte; rotulo: string }[] = [
  { valor: "curto", rotulo: "Curto prazo" },
  { valor: "medio", rotulo: "Médio prazo" },
  { valor: "longo", rotulo: "Longo prazo" },
];
export const rotuloHorizonte = (h: string) =>
  HORIZONTES.find((x) => x.valor === h)?.rotulo ?? "";

export const STATUS_OBJETIVO = [
  "Não iniciado",
  "Em andamento",
  "Pausado",
  "Concluído",
];

export const CATEGORIAS_ESTILO = [
  "Consumo",
  "Entretenimento",
  "Viagem",
  "Alimentação",
  "Compras",
  "Estilo pessoal",
  "Outro",
];

export const OPCOES_COMUNICACAO = {
  tom: ["Formal", "Profissional", "Casual", "Amigável", "Direto"],
  detalhe: ["Breve", "Equilibrado", "Detalhado"],
  profundidade: ["Respostas objetivas", "Respostas aprofundadas"],
  apresentacao: [
    "Tópicos e listas",
    "Texto corrido",
    "Tabelas quando possível",
    "Resumo primeiro, detalhes depois",
  ],
};

export const NIVEIS_FORMACAO = [
  "Ensino médio",
  "Técnico",
  "Graduação",
  "Especialização / MBA",
  "Mestrado",
  "Doutorado",
  "Outro",
];
