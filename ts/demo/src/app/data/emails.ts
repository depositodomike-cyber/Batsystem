// ----------------------------------------------------------------------
// Caixa de entrada do conector de E-mail.
//
// Com o Gmail (ou o Outlook) conectado, a página /<produto>/email lê a caixa
// real pelo backend — GET /conectores/email/:provedor/mensagens, que devolve
// exatamente os tipos abaixo (ver ts/api/src/conectores/email-api.service.ts).
// `emailsMock` continua como a caixa do modo demo: é o que aparece quando não
// há nenhum conector de e-mail autorizado.
//
// O que o usuário faz com um e-mail (ler, salvar no Contexto, salvar num Grupo)
// não depende desta origem — ver pages/ceo/Email.tsx.
// ----------------------------------------------------------------------

export interface EmailAnexo {
  nome: string;
  /** Tamanho em bytes. */
  tamanho: number;
}

export interface EmailItem {
  id: string;
  remetenteNome: string;
  remetenteEmail: string;
  /** Destinatário exibido no cabeçalho da leitura. */
  para: string;
  assunto: string;
  /** ISO 8601 — a UI formata para exibição. */
  data: string;
  /** Corpo em texto puro (quebras de linha preservadas na leitura). */
  corpo: string;
  anexos?: EmailAnexo[];
  /** Marcadores/labels do provedor (Gmail, Outlook…). */
  marcadores?: string[];
  /** Ainda não lido na caixa do provedor (só vem da caixa real). */
  naoLido?: boolean;
}

export const emailsMock: EmailItem[] = [
  {
    id: "em-001",
    remetenteNome: "Camila Ferraz",
    remetenteEmail: "camila.ferraz@nortis.com.br",
    para: "voce@empresa.com.br",
    assunto: "Renovação do contrato Nortis — condições para 2027",
    data: "2026-07-22T14:32:00-03:00",
    corpo: `Oi, tudo bem?

Fechamos internamente a proposta de renovação. Os pontos principais:

- Reajuste de 6,2% (IPCA acumulado), abaixo dos 8% que tínhamos sinalizado em abril.
- Prazo de 24 meses, com cláusula de saída sem multa a partir do 12º mês.
- Inclusão do módulo de Performance para até 400 colaboradores, sem custo adicional no primeiro ano.

Precisamos de um retorno até 05/08 para conseguir manter as condições. Se fizer sentido, marco uma call de 30 minutos com o jurídico de vocês.

Abraço,
Camila`,
    anexos: [{ nome: "proposta-renovacao-nortis-2027.pdf", tamanho: 428_500 }],
    marcadores: ["Clientes"],
  },
  {
    id: "em-002",
    remetenteNome: "Rafael Andrade",
    remetenteEmail: "rafael@acmeventures.com",
    para: "voce@empresa.com.br",
    assunto: "Follow-up Série A — próximos passos",
    data: "2026-07-22T09:05:00-03:00",
    corpo: `Bom dia,

Ótima conversa ontem. Levei o caso para o comitê e o interesse se manteve.

Para avançarmos, precisamos de:
1. Deck atualizado com os números fechados de junho.
2. Coorte de retenção dos últimos 12 meses (receita líquida).
3. Estrutura societária atual, incluindo o pool de opções.

Se conseguirmos isso até o fim da semana, consigo colocar vocês na pauta do comitê do dia 04/08.

Abs,
Rafael Andrade
Acme Ventures`,
    marcadores: ["Investidores"],
  },
  {
    id: "em-003",
    remetenteNome: "Juliana Prado",
    remetenteEmail: "juliana.prado@empresa.com.br",
    para: "voce@empresa.com.br",
    assunto: "Resultado da pesquisa de clima — 2º trimestre",
    data: "2026-07-21T17:48:00-03:00",
    corpo: `Fechamos a apuração com 87% de participação (era 71% no trimestre passado).

Destaques positivos:
- Confiança na liderança direta subiu de 6,9 para 7,8.
- Clareza de metas subiu de 6,1 para 7,2 — efeito direto do ritual de OKR quinzenal.

Pontos de atenção:
- Carga de trabalho caiu para 5,4 (pior nota da pesquisa). Concentrado em Engenharia e Suporte.
- Comentários abertos citam 12 vezes "reuniões demais" e 9 vezes "prioridade muda toda semana".

Sugiro tratarmos carga de trabalho como tema do próximo ciclo, com um corte por squad. Anexei a planilha completa.

Juliana`,
    anexos: [
      { nome: "clima-2026-q2-consolidado.xlsx", tamanho: 1_240_000 },
      { nome: "comentarios-abertos-anonimizados.csv", tamanho: 96_300 },
    ],
    marcadores: ["Pessoas"],
  },
  {
    id: "em-004",
    remetenteNome: "Marcos Vinícius",
    remetenteEmail: "marcos@empresa.com.br",
    para: "voce@empresa.com.br",
    assunto: "Decisão: adiar a contratação do CRO para Q4",
    data: "2026-07-20T11:20:00-03:00",
    corpo: `Conforme alinhamos na reunião de ontem, vamos adiar a contratação do CRO para o Q4.

Critérios que sustentaram a decisão:
- Pipeline qualificado ainda abaixo de R$ 4,2M — patamar que definimos como gatilho.
- Runway de 14 meses; a contratação consome cerca de 1,1 mês.
- O time de vendas atual bateu a meta nos últimos dois trimestres sem liderança dedicada.

Revisitamos o tema na primeira semana de outubro, com os números de setembro na mão.

Marcos`,
    marcadores: ["Decisões"],
  },
  {
    id: "em-005",
    remetenteNome: "Suporte Datacore",
    remetenteEmail: "no-reply@datacore.io",
    para: "voce@empresa.com.br",
    assunto: "Incidente resolvido — indisponibilidade parcial em 19/07",
    data: "2026-07-19T22:10:00-03:00",
    corpo: `Prezado cliente,

O incidente iniciado às 14h07 (BRT) de 19/07 foi encerrado às 15h52.

Causa raiz: falha em um nó do cluster de banco após aplicação de patch de segurança. O failover automático não ocorreu por uma configuração incorreta de health check.

Impacto: leitura degradada para aproximadamente 8% das requisições durante 1h45.

Ações: correção do health check, revisão do runbook de patch e teste de failover mensal a partir de agosto.

Relatório completo em anexo.`,
    anexos: [{ nome: "post-mortem-19-07.pdf", tamanho: 312_000 }],
    marcadores: ["Fornecedores"],
  },
  {
    id: "em-006",
    remetenteNome: "Beatriz Lemos",
    remetenteEmail: "beatriz.lemos@xptocorp.com",
    para: "voce@empresa.com.br",
    assunto: "XPTO Corp — nova liderança de tecnologia",
    data: "2026-07-18T08:44:00-03:00",
    corpo: `Olá,

Escrevo para avisar que assumi a diretoria de tecnologia da XPTO no início do mês, no lugar do Henrique.

Estou revisando todos os contratos de plataforma. O de vocês está entre os que quero entender melhor antes da renovação de novembro — principalmente uso real por área e o roadmap de integrações.

Consegue me indicar alguém para uma conversa técnica nas próximas duas semanas?

Obrigada,
Beatriz Lemos`,
    marcadores: ["Clientes"],
  },
  {
    id: "em-007",
    remetenteNome: "Fernanda Rocha",
    remetenteEmail: "fernanda.rocha@empresa.com.br",
    para: "voce@empresa.com.br",
    assunto: "Ata — Comitê de Produto 17/07",
    data: "2026-07-17T19:15:00-03:00",
    corpo: `Segue o resumo do comitê.

Decisões:
- O módulo de Learning entra em beta fechado com 5 clientes em 12/08.
- Integração com Slack passa para o Q4; a de e-mail continua como prioridade do trimestre.
- Congelamos novas funcionalidades no Kanban até estabilizar a performance.

Pendências:
- Pedro: levantar custo de infraestrutura do beta até 24/07.
- Juliana: validar com Suporte a capacidade de atendimento do beta.

Próxima reunião: 31/07, 15h.

Fernanda`,
    marcadores: ["Produto"],
  },
  {
    id: "em-008",
    remetenteNome: "Ricardo Salles",
    remetenteEmail: "ricardo@consultoriamerx.com.br",
    para: "voce@empresa.com.br",
    assunto: "Diagnóstico de cultura — proposta comercial",
    data: "2026-07-15T13:02:00-03:00",
    corpo: `Boa tarde,

Conforme conversamos, envio a proposta do diagnóstico de cultura.

Escopo: 12 entrevistas de profundidade, 3 grupos focais e leitura dos dados de clima que vocês já possuem. Entrega em 6 semanas, com apresentação para o conselho.

Investimento: R$ 78.000, divididos em 3 parcelas.

Fico à disposição para ajustar o escopo.

Ricardo Salles`,
    anexos: [{ nome: "proposta-diagnostico-cultura.pdf", tamanho: 205_400 }],
    marcadores: ["Fornecedores"],
  },
];

/** Marcadores presentes na caixa — usados como filtro na página. */
export function marcadoresDaCaixa(emails: EmailItem[]): string[] {
  const set = new Set<string>();
  for (const e of emails) for (const m of e.marcadores ?? []) set.add(m);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
