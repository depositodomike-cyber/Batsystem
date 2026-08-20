// Gera Fluxo-Chat-IA.docx — documentação funcional do chat com IA (Assistente).
//
// Conteúdo no padrão dos demais Fluxo-*.docx: comportamento do produto e regras
// de negócio, em linguagem não-técnica. A apresentação vem de
// ./fluxo-docx-base.js (capa, cabeçalho/rodapé, âmbar + slate, tabelas).
//
//   npm install -g docx
//   NODE_PATH="$(npm root -g)" node Documentation/gen-fluxo-chat-ia.js
const path = require("path");
const {
  p,
  h1,
  h2,
  bullet,
  bulletTermo,
  table,
  spacer,
  capa,
  fecho,
  gerar,
} = require("./fluxo-docx-base");

const NOME = "Fluxo de Chat com IA";

const corpo = [
  ...capa({
    eyebrow: "GUIA FUNCIONAL DO PRODUTO",
    titulo: NOME,
    escopo:
      "Este documento descreve a funcionalidade de Chat com IA na beculture. O foco é o comportamento do produto e as regras de negócio, organizados por tópicos. São descritos apenas os fluxos habilitados e acessíveis hoje.",
    metadados: [
      ["Produto", "beculture"],
      ["Funcionalidade", "Chat com IA (Assistente)"],
      ["Onde vive", "Barra de pergunta no topo e painel do Assistente"],
      ["Público deste documento", "Produto, Tech, Suporte e Onboarding"],
      [
        "Pré-requisito",
        "Um provedor de IA conectado (ou período de teste ativo)",
      ],
    ],
  }),

  // ------------------------------------------------------------ 1. VISÃO
  h1("1. Visão geral"),
  p(
    "O Assistente é o chat com inteligência artificial da beculture. A pessoa pergunta em linguagem natural e recebe uma resposta construída a partir do conteúdo do próprio Repositório ou da web, conforme o modo escolhido.",
  ),
  bullet(
    "Há dois pontos de entrada para a mesma conversa: a barra de pergunta no topo da tela e o painel do Assistente, aberto pela bolinha no canto inferior direito.",
  ),
  bullet(
    "A conversa acompanha a pessoa: navegar entre telas não interrompe nem apaga o que já foi perguntado.",
  ),
  bullet(
    "Cada resposta indica de onde veio — Repositório ou web — e lista as fontes usadas.",
  ),
  bullet("As conversas ficam salvas e podem ser reabertas pela aba Histórico."),
  bullet(
    "O Assistente está disponível nas telas do produto que têm o menu lateral; fora delas, a bolinha não aparece.",
  ),

  // ----------------------------------------------------------- 2. ACESSO
  h1("2. Como acessar"),
  bulletTermo(
    "Bolinha do Assistente",
    "sempre presente no canto inferior direito. Um clique abre o painel, restaurando a conversa atual, se houver.",
  ),
  bulletTermo(
    "Barra de pergunta no topo",
    "aparece no cabeçalho em telas maiores. É o caminho mais rápido: perguntar por ali já abre o painel com a resposta.",
  ),
  bulletTermo(
    "Lupa no cabeçalho",
    "em telas menores, onde a barra não cabe, a lupa abre o painel direto na aba Chat.",
  ),
  bulletTermo(
    "Atalhos de teclado",
    "Ctrl+K (ou ⌘K) e “/” levam o cursor para a barra de pergunta. Os atalhos ficam desligados enquanto o painel está ampliado.",
  ),
  bullet("É necessário estar autenticado para usar o Assistente."),

  // ------------------------------------------------------------ 3. BARRA
  h1("3. A barra de pergunta no topo"),
  p(
    "A barra fica no cabeçalho e serve para iniciar uma conversa sem sair da tela em que a pessoa está. O texto de apoio é “Pergunte ao seu Repositório…”.",
  ),
  h2("Campos"),
  bulletTermo(
    "Seletor de fonte",
    "escolhe entre Repositório, Web e Auto (ver o tópico 5).",
  ),
  bulletTermo("Pergunta", "campo de texto que cresce conforme o conteúdo."),
  bulletTermo(
    "Anexar arquivo",
    "adiciona um arquivo de texto à pergunta. O arquivo escolhido aparece como um chip abaixo da barra, com opção de remover.",
  ),
  bulletTermo(
    "Ditar por voz",
    "transcreve a fala para o campo de texto. Depende de suporte do navegador; sem suporte, a pessoa recebe um aviso.",
  ),
  h2("Ao enviar"),
  bullet("Enter envia a pergunta; Shift+Enter quebra a linha."),
  bullet(
    "O painel do Assistente abre sozinho, já mostrando a pergunta e o indicador “pensando…”.",
  ),
  bullet(
    "Abaixo da barra aparece uma linha de status durante a busca (“buscando no Repositório…”, “buscando na web…” ou “roteando…”).",
  ),
  bullet(
    "Terminada a busca, o status confirma a origem — “respondido pelo Repositório” ou “respondido via web” — e some em poucos segundos.",
  ),
  bullet(
    "Se houver erro, o status fica em vermelho com a mensagem do problema e permanece na tela.",
  ),
  bullet(
    "A pergunta e o anexo são limpos da barra após um envio bem-sucedido.",
  ),

  // ----------------------------------------------------------- 4. PAINEL
  h1("4. O painel do Assistente"),
  p(
    "O painel é onde a conversa acontece. Tem cabeçalho com o nome “Assistente” e os controles da janela, duas abas (Chat e Histórico) e, na aba Chat, o campo de envio no rodapé.",
  ),
  h2("Estados"),
  bulletTermo(
    "Encaixado",
    "coluna na lateral direita, em telas grandes. O conteúdo do app é empurrado para o lado e continua utilizável — não há véu bloqueando a tela.",
  ),
  bulletTermo(
    "Ampliado",
    "ocupa a tela toda, preservando o menu lateral. Acionado pelo botão Ampliar e desfeito por Recolher.",
  ),
  bulletTermo(
    "Minimizado",
    "o painel sai da tela e a bolinha volta. O rascunho do campo de envio e a conversa são preservados, assim como o tamanho em que o painel estava.",
  ),
  bullet(
    "Em telas pequenas, encaixado e ampliado são a mesma folha de tela cheia, e o botão Ampliar não é exibido.",
  ),
  h2("Abas"),
  bulletTermo(
    "Chat",
    "a conversa atual. Sem conversa, mostra “Nova conversa” e a dica de perguntar ali ou pela barra do topo.",
  ),
  bulletTermo(
    "Histórico",
    "as conversas salvas, com um contador do total ao lado do nome da aba.",
  ),
  h2("Controles do cabeçalho"),
  bulletTermo(
    "Nova conversa",
    "descarta o contexto atual e começa do zero, sem apagar o que já foi salvo.",
  ),
  bulletTermo("Ampliar / Recolher", "alterna entre tela cheia e encaixe."),
  bulletTermo("Minimizar", "esconde o painel preservando o estado."),
  bulletTermo(
    "Fechar",
    "encerra a exibição; a próxima abertura começa encaixada.",
  ),
  h2("Como sair"),
  bullet(
    "Esc recolhe o painel ampliado; com o painel já encaixado, Esc fecha.",
  ),
  bullet(
    "Quando uma resposta chega e o painel não está visível, a bolinha ganha um marcador de não lido, que some ao abrir o painel.",
  ),

  // ------------------------------------------------------------ 5. MODOS
  h1("5. Modos de busca"),
  p(
    "O modo define de onde a IA tira a informação. É escolhido no seletor da barra de pergunta antes de enviar.",
  ),
  table(
    ["Modo", "O que faz", "Quando usar"],
    [
      [
        "Repositório",
        "Responde a partir das notas do Repositório da organização, cruzadas com as Notas e os To-do's da pessoa.",
        "Perguntas sobre o negócio: decisões, diretrizes, contexto interno, reflexão sobre a própria operação.",
      ],
      [
        "Web",
        "Pesquisa na internet e responde citando as páginas consultadas.",
        "Informação atual, pública ou externa: notícias, cotações, dados de mercado, fatos gerais.",
      ],
      [
        "Auto",
        "A IA decide sozinha, a cada pergunta, se busca no Repositório ou na web.",
        "Quando a pessoa não quer pensar na origem da resposta.",
      ],
    ],
    [1700, 3900, 3426],
  ),
  spacer(160),
  h2("Regras"),
  bullet(
    "O modo Auto decide a cada pergunta; a mesma conversa pode ter respostas de origens diferentes.",
  ),
  bullet(
    "Se a decisão automática falhar, a pergunta é respondida pelo Repositório.",
  ),
  bullet(
    "No modo Web o anexo é ignorado, assim como as Notas e os To-do's locais.",
  ),
  bullet(
    "Ao continuar uma conversa pelo campo do painel, a IA mantém o modo com que a conversa começou.",
  ),
  bullet(
    "O modo escolhido fica registrado na conversa e é restaurado ao reabri-la pelo Histórico.",
  ),

  // ---------------------------------------------------- 6. O QUE NÃO FAZ
  h1("6. O que a IA não faz"),
  bullet(
    "Não inventa fatos, métricas ou decisões que não estejam no conteúdo consultado.",
  ),
  bullet(
    "Quando o Repositório não cobre a pergunta, a IA diz com franqueza o que falta e deixa claro o que é suposição.",
  ),
  bullet(
    "Insights não entram no contexto: hoje são dados de exemplo, e enviá-los injetaria contexto falso na resposta.",
  ),

  // --------------------------------------------------------- 7. RESPOSTA
  h1("7. A resposta"),
  p(
    "A resposta aparece no painel, em texto formatado, logo abaixo da pergunta. Enquanto ela não chega, o lugar dela mostra “pensando…”.",
  ),
  h2("Fontes"),
  bullet(
    "No modo Repositório, as notas efetivamente usadas aparecem como chips abaixo da resposta.",
  ),
  bullet(
    "Títulos citados pela IA que não correspondem a notas reais são descartados — só entra como fonte o que existe no Repositório.",
  ),
  bullet(
    "No modo Web, as fontes são links para as páginas consultadas e abrem em nova aba.",
  ),
  bullet("Quando há anexo, ele aparece como a primeira fonte da resposta."),
  bullet("Sem fontes reconhecidas, nenhum chip é exibido."),
  h2("Conexões no Repositório"),
  bullet(
    "Toda resposta termina com um bloco de conexões, ligando o assunto tratado a notas do Repositório.",
  ),
  bullet(
    "As ligações usam os títulos existentes; quando o assunto ainda não tem nota, a ligação é marcada como nova.",
  ),
  bullet(
    "É esse bloco que faz o conteúdo gerado pela IA se conectar ao grafo do Repositório.",
  ),
  // ------------------------------------------------------- 8. CONVERSAS
  h1("8. Conversas e histórico"),
  p(
    "A conversa nasce na primeira pergunta e é salva automaticamente. A partir daí, cada nova pergunta feita pelo campo do painel continua a mesma conversa.",
  ),
  h2("Título da conversa"),
  bullet("O título começa como um resumo do início da pergunta."),
  bullet(
    "Logo depois, a IA gera um título curto, de quatro a seis palavras, que substitui o primeiro.",
  ),
  bullet("O novo título aparece na lista assim que fica pronto."),
  h2("Aba Histórico"),
  bullet(
    "As conversas são agrupadas em Hoje, Ontem, Últimos 7 dias e Mais antigas.",
  ),
  bullet(
    "Dentro de cada grupo, as mais recentes vêm primeiro, com uma prévia da última mensagem.",
  ),
  bullet(
    "Clicar em uma conversa carrega os turnos dentro do próprio painel, sem sair da tela.",
  ),
  bullet("A conversa aberta fica destacada na lista."),
  bullet(
    "A exclusão pede confirmação na própria linha; excluir a conversa aberta inicia uma nova.",
  ),
  bullet("Excluir remove a conversa e todas as suas mensagens."),
  h2("Escopo por repositório"),
  bullet("Cada repositório tem o seu próprio histórico de conversas."),
  bullet(
    "Trocar de repositório ou de organização limpa a conversa em aberto e fecha o painel.",
  ),

  // ------------------------------------------------------- 9. CONEXÃO IA
  h1("9. Pré-requisito: conexão de IA"),
  p(
    "O Assistente só responde quando a organização tem uma IA disponível. A configuração fica em Configurações, na seção Conexões, e é assunto de documento próprio.",
  ),
  bullet(
    "Sem nenhuma IA disponível, a pergunta retorna o aviso de que é preciso conectar um provedor em Conexões.",
  ),

  // ------------------------------------------------------- 10. SITUAÇÕES
  h1("10. Situações especiais"),
  bullet("Pergunta vazia: nada é enviado."),
  bullet(
    "Nova pergunta enquanto a anterior está sendo respondida: o envio é ignorado até a resposta chegar.",
  ),
  bullet(
    "Chave de IA recusada pelo provedor: a resposta é substituída por um aviso para reconectar o provedor em Conexões, e a conexão passa a ser sinalizada como inválida na tela de configuração.",
  ),
  bullet(
    "Limite de uso atingido no provedor: aviso para tentar novamente em instantes.",
  ),
  bullet(
    "Modelo indisponível: aviso para verificar o modelo configurado em Conexões.",
  ),
  bullet(
    "Falha de comunicação: a mensagem de erro aparece como a resposta daquele turno, precedida de um alerta.",
  ),
  bullet(
    "Falha ao salvar a conversa: a resposta é entregue normalmente; apenas o registro no Histórico pode não acontecer.",
  ),
  bullet(
    "Falha ao consultar o Repositório: a pergunta é respondida assim mesmo, sem o contexto das notas.",
  ),
  bullet(
    "Repositório ainda sem notas sincronizadas: a IA avisa que não há conteúdo e responde com o que tem.",
  ),
  bullet(
    "Ditado por voz sem suporte no navegador: a pessoa é avisada e segue digitando.",
  ),

  // ---------------------------------------------------------- 11. RESUMO
  h1("11. Resumo do percurso"),
  p(
    "Barra no topo ou bolinha do Assistente → escolher o modo (Repositório, Web ou Auto) → perguntar → resposta com fontes no painel lateral → continuar a conversa pelo campo do painel → conversa salva no Histórico do repositório.",
  ),

  spacer(280),
  fecho(),
];

void gerar({
  nomeDoDocumento: NOME,
  children: corpo,
  outPath: path.join(__dirname, "Fluxo-Chat-IA.docx"),
});
