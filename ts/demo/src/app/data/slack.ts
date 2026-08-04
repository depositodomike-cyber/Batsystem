// ----------------------------------------------------------------------
// Workspace do conector de Slack.
//
// Com o Slack autorizado em Conectores, a página /<produto>/slack lê o
// workspace real pelo backend (ts/api, SlackApiService) — os tipos abaixo são
// o contrato que o backend devolve. Sem conector, a tela cai no `slackMock`,
// que é a mesma estrutura, para a demonstração continuar navegável.
//
// Cobre as três formas de conversa do Slack: canal (público ou privado),
// conversa em grupo (DM com várias pessoas) e DM individual. Threads são
// respostas penduradas numa mensagem — ver `respostas`.
// ----------------------------------------------------------------------

export interface SlackReacao {
  emoji: string;
  total: number;
}

export interface SlackResposta {
  id: string;
  autor: string;
  /** ISO 8601. */
  data: string;
  texto: string;
}

export interface SlackMensagem {
  id: string;
  autor: string;
  /** ISO 8601. */
  data: string;
  texto: string;
  reacoes?: SlackReacao[];
  /** Thread: respostas penduradas nesta mensagem. */
  respostas?: SlackResposta[];
}

/** Canal (#), conversa em grupo (DM com várias pessoas) ou DM individual. */
export type SlackTipoConversa = "canal" | "grupo" | "dm";

export interface SlackConversa {
  id: string;
  tipo: SlackTipoConversa;
  /** Nome sem o "#" nos canais; nome das pessoas nas conversas em grupo e DMs. */
  nome: string;
  /** Tópico do canal, exibido no cabeçalho. */
  topico?: string;
  /** Canal privado (cadeado no lugar do #). */
  privado?: boolean;
  /** Nº de participantes (canais e conversas em grupo). */
  membros?: number;
  /** Presença — só faz sentido em DM individual. */
  online?: boolean;
  mensagens: SlackMensagem[];
}

/**
 * A conversa sem as mensagens — é o que a listagem devolve. As mensagens são
 * lidas à parte, só da conversa aberta (cada uma custa uma chamada ao Slack).
 */
export type SlackConversaResumo = Omit<SlackConversa, "mensagens">;

export const slackMock: SlackConversa[] = [
  {
    id: "c-produto",
    tipo: "canal",
    nome: "produto",
    topico: "Roadmap, releases e decisões de produto",
    membros: 24,
    mensagens: [
      {
        id: "m-prod-1",
        autor: "Fernanda Rocha",
        data: "2026-07-22T09:12:00-03:00",
        texto:
          "Fechamos o escopo do beta do Learning: 5 clientes, turma única, sem certificado por enquanto.\nData alvo: 12/08.",
        reacoes: [
          { emoji: "🚀", total: 6 },
          { emoji: "👀", total: 2 },
        ],
        respostas: [
          {
            id: "r-prod-1-1",
            autor: "Pedro Nakamura",
            data: "2026-07-22T09:31:00-03:00",
            texto:
              "Consigo o custo de infra até quinta. Estimativa grossa: R$ 3,2k/mês com os 5 clientes.",
          },
          {
            id: "r-prod-1-2",
            autor: "Juliana Prado",
            data: "2026-07-22T10:04:00-03:00",
            texto:
              "Suporte topa, mas preciso de 2 semanas de antecedência para treinar o time. Se a data for 12/08, quero o material até 29/07.",
          },
          {
            id: "r-prod-1-3",
            autor: "Fernanda Rocha",
            data: "2026-07-22T10:15:00-03:00",
            texto: "Combinado. Coloco o material como entrega da minha squad.",
          },
        ],
      },
      {
        id: "m-prod-2",
        autor: "Pedro Nakamura",
        data: "2026-07-22T11:40:00-03:00",
        texto:
          "Aviso: congelei novas funcionalidades no Kanban até resolvermos a lentidão do board com mais de 200 cards.",
        reacoes: [{ emoji: "👍", total: 4 }],
      },
      {
        id: "m-prod-3",
        autor: "Marcos Vinícius",
        data: "2026-07-22T15:08:00-03:00",
        texto:
          "A integração de Slack fica para o Q4. A de e-mail continua sendo a prioridade do trimestre — é o que mais apareceu nas entrevistas com cliente.",
        respostas: [
          {
            id: "r-prod-3-1",
            autor: "Fernanda Rocha",
            data: "2026-07-22T15:22:00-03:00",
            texto: "Concordo. Atualizo o roadmap público hoje.",
          },
        ],
      },
    ],
  },
  {
    id: "c-comercial",
    tipo: "canal",
    nome: "comercial",
    topico: "Pipeline, propostas e fechamentos",
    membros: 16,
    mensagens: [
      {
        id: "m-com-1",
        autor: "Camila Ferraz",
        data: "2026-07-21T16:45:00-03:00",
        texto:
          "Nortis pediu proposta de renovação com reajuste abaixo do IPCA. Mandei 6,2% com prazo de 24 meses.\nRetorno esperado até 05/08.",
        reacoes: [{ emoji: "🤞", total: 3 }],
        respostas: [
          {
            id: "r-com-1-1",
            autor: "Marcos Vinícius",
            data: "2026-07-21T17:02:00-03:00",
            texto:
              "Ok com os 6,2%. Só não abre mão da cláusula de 12 meses — foi o que nos protegeu no caso da XPTO.",
          },
        ],
      },
      {
        id: "m-com-2",
        autor: "Tiago Moreira",
        data: "2026-07-22T08:20:00-03:00",
        texto:
          "Pipeline qualificado fechou julho em R$ 3,8M. Ainda abaixo do gatilho de R$ 4,2M que definimos para a contratação do CRO.",
      },
    ],
  },
  {
    id: "c-lideranca",
    tipo: "canal",
    nome: "lideranca",
    topico: "Canal privado da liderança",
    privado: true,
    membros: 6,
    mensagens: [
      {
        id: "m-lid-1",
        autor: "Marcos Vinícius",
        data: "2026-07-20T11:25:00-03:00",
        texto:
          "Decisão fechada: adiamos a contratação do CRO para o Q4.\n\nCritérios: pipeline abaixo de R$ 4,2M, runway de 14 meses e o time batendo meta sem liderança dedicada nos dois últimos trimestres.\n\nRevisitamos na primeira semana de outubro.",
        reacoes: [{ emoji: "✅", total: 5 }],
        respostas: [
          {
            id: "r-lid-1-1",
            autor: "Juliana Prado",
            data: "2026-07-20T11:48:00-03:00",
            texto:
              "Vou comunicar ao time comercial na reunião de segunda, para não vazar pelo corredor.",
          },
          {
            id: "r-lid-1-2",
            autor: "Marcos Vinícius",
            data: "2026-07-20T12:02:00-03:00",
            texto: "Perfeito. Alinha o texto comigo antes.",
          },
        ],
      },
      {
        id: "m-lid-2",
        autor: "Juliana Prado",
        data: "2026-07-21T18:10:00-03:00",
        texto:
          "Carga de trabalho foi a pior nota da pesquisa de clima (5,4), concentrada em Engenharia e Suporte. Proponho tratar como tema do próximo ciclo, com corte por squad.",
        reacoes: [{ emoji: "⚠️", total: 3 }],
      },
    ],
  },
  {
    id: "g-comite",
    tipo: "grupo",
    nome: "Juliana, Marcos e Pedro",
    membros: 4,
    mensagens: [
      {
        id: "m-grp-1",
        autor: "Juliana Prado",
        data: "2026-07-22T13:05:00-03:00",
        texto:
          "Consigo fechar o corte de carga de trabalho por squad até sexta. Alguém tem o headcount atualizado de Suporte?",
        respostas: [
          {
            id: "r-grp-1-1",
            autor: "Pedro Nakamura",
            data: "2026-07-22T13:20:00-03:00",
            texto: "11 pessoas, sendo 2 em rampa. Te mando a planilha.",
          },
          {
            id: "r-grp-1-2",
            autor: "Juliana Prado",
            data: "2026-07-22T13:22:00-03:00",
            texto: "Valeu 🙏",
          },
        ],
      },
      {
        id: "m-grp-2",
        autor: "Marcos Vinícius",
        data: "2026-07-22T14:15:00-03:00",
        texto:
          "Lembrando: o que sair daqui sobre o CRO só vai para o time depois da segunda.",
      },
    ],
  },
  {
    id: "dm-juliana",
    tipo: "dm",
    nome: "Juliana Prado",
    online: true,
    mensagens: [
      {
        id: "m-dmj-1",
        autor: "Juliana Prado",
        data: "2026-07-22T08:02:00-03:00",
        texto:
          "Bom dia! A pesquisa de clima fechou com 87% de participação. Subiu bastante em relação aos 71% do trimestre passado.",
        reacoes: [{ emoji: "🎉", total: 1 }],
      },
      {
        id: "m-dmj-2",
        autor: "Juliana Prado",
        data: "2026-07-22T08:04:00-03:00",
        texto:
          "O ponto delicado é carga de trabalho. Prefiro te mostrar os comentários abertos antes de levar ao conselho — tem coisa dura ali.",
        respostas: [
          {
            id: "r-dmj-2-1",
            autor: "Você",
            data: "2026-07-22T08:30:00-03:00",
            texto: "Manda hoje à tarde que eu leio antes da reunião de quinta.",
          },
          {
            id: "r-dmj-2-2",
            autor: "Juliana Prado",
            data: "2026-07-22T08:33:00-03:00",
            texto: "Fechado.",
          },
        ],
      },
    ],
  },
  {
    id: "dm-marcos",
    tipo: "dm",
    nome: "Marcos Vinícius",
    online: false,
    mensagens: [
      {
        id: "m-dmm-1",
        autor: "Marcos Vinícius",
        data: "2026-07-21T19:40:00-03:00",
        texto:
          "A Beatriz assumiu a diretoria de tecnologia da XPTO e está revisando os contratos de plataforma. Renovação deles é em novembro.",
      },
      {
        id: "m-dmm-2",
        autor: "Marcos Vinícius",
        data: "2026-07-21T19:41:00-03:00",
        texto:
          "Acho que vale você entrar pessoalmente nessa conta. O Henrique era nosso padrinho lá dentro.",
        reacoes: [{ emoji: "👌", total: 1 }],
      },
    ],
  },
  {
    id: "dm-rafael",
    tipo: "dm",
    nome: "Rafael Andrade",
    online: true,
    mensagens: [
      {
        id: "m-dmr-1",
        autor: "Rafael Andrade",
        data: "2026-07-22T09:10:00-03:00",
        texto:
          "Levei o caso ao comitê e o interesse se manteve. Preciso do deck atualizado, da coorte de retenção de 12 meses e da estrutura societária.",
      },
      {
        id: "m-dmr-2",
        autor: "Rafael Andrade",
        data: "2026-07-22T09:11:00-03:00",
        texto:
          "Se chegar até sexta, coloco vocês na pauta do comitê de 04/08.",
      },
    ],
  },
];

/** Rótulo da conversa: "#canal" nos canais, o nome nas demais. */
export function rotuloConversa(c: SlackConversaResumo): string {
  return c.tipo === "canal" ? `#${c.nome}` : c.nome;
}

/** Total de respostas da thread de uma mensagem. */
export function totalRespostas(m: SlackMensagem): number {
  return m.respostas?.length ?? 0;
}

/**
 * Texto de uma mensagem para gravar na Memória / no Grupo. Com `comThread`,
 * inclui as respostas identadas logo abaixo — é assim que a conversa continua
 * fazendo sentido fora do Slack.
 */
export function textoParaSalvar(
  conversa: SlackConversaResumo,
  mensagem: SlackMensagem,
  comThread: boolean,
): string {
  const hora = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const linhas = [
    `${rotuloConversa(conversa)} · ${mensagem.autor} · ${hora(mensagem.data)}`,
    "",
    mensagem.texto,
  ];

  if (comThread && mensagem.respostas?.length) {
    linhas.push("", `Respostas (${mensagem.respostas.length}):`);
    for (const r of mensagem.respostas) {
      linhas.push("", `— ${r.autor} · ${hora(r.data)}`, r.texto);
    }
  }

  return linhas.join("\n");
}
