// Gera Fluxo-Regras.docx — documentação funcional das Regras (diretrizes da IA).
//
// Substitui a versão anterior, que usava os estilos padrão da lib e não tinha
// gerador versionado. Conteúdo no padrão dos Fluxo-*.docx; apresentação vem de
// ./fluxo-docx-base.js (capa, cabeçalho/rodapé, âmbar + slate, tabelas).
//
//   npm install -g docx
//   NODE_PATH="$(npm root -g)" node Documentation/gen-fluxo-regras.js
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

const NOME = "Fluxo de Regras";

const corpo = [
  ...capa({
    eyebrow: "GUIA FUNCIONAL DO PRODUTO",
    titulo: NOME,
    escopo:
      "Este documento descreve a funcionalidade de Regras na beculture. O foco é o comportamento do produto e as regras de negócio, organizados por tópicos. São descritos apenas os fluxos habilitados e acessíveis hoje.",
    metadados: [
      ["Produto", "beculture"],
      ["Funcionalidade", "Regras (diretrizes da IA)"],
      ["Onde vive", "Configurações → Regras"],
      ["Público deste documento", "Produto, Suporte e Onboarding"],
      ["Alcance", "Toda resposta da IA, em qualquer formato"],
      ["Versão", "v1.0 — Agosto 2026"],
    ],
  }),

  // ------------------------------------------------------------ 1. VISÃO
  h1("1. Visão geral"),
  p(
    "As Regras definem restrições de conduta e de conteúdo que a inteligência artificial deve seguir em toda resposta. Não são fatos para citar: são diretrizes de comportamento.",
  ),
  bullet("Só as regras ativas entram no contexto da IA."),
  bullet(
    "Uma regra vale para toda interação com a IA, sem filtro por assunto — não é possível limitar uma regra a um tema ou a uma tela.",
  ),
  bullet(
    "Regras são distintas do Repositório: o Repositório guarda notas e conteúdo; as Regras orientam como a IA deve se comportar.",
  ),
  bullet("Cada regra pode ser ativada ou desativada conforme a necessidade."),

  // ----------------------------------------------------------- 2. ACESSO
  h1("2. Como acessar"),
  bullet("Pelas Configurações, na seção Regras."),
  bullet(
    "A seção tem endereço próprio, então é possível guardar o link e voltar direto para ela.",
  ),
  bullet("Links antigos da antiga tela de Memória levam para cá."),
  bullet("É necessário estar autenticado para gerenciar regras."),

  // ------------------------------------------------------------ 3. LISTA
  h1("3. Lista e consulta"),
  p(
    "Na seção Regras, a pessoa consulta e organiza o conjunto de diretrizes da organização. A lista traz as regras mais recentes primeiro.",
  ),
  h2("O que cada linha mostra"),
  bulletTermo("Título", "o resumo da regra, em uma linha."),
  bulletTermo(
    "Nível de confiança",
    "um selo com Alta confiança, Confiança média ou A confirmar.",
  ),
  bulletTermo(
    "Selo Corporativa",
    "presente apenas nas regras fixadas pela organização (ver o tópico 7).",
  ),
  bulletTermo("Trecho da regra e origem", "o começo do texto e de onde ela veio."),
  bulletTermo(
    "Estimativa de tokens",
    "quanto aquela regra ocupa no contexto da IA. Aparece em telas maiores.",
  ),
  bulletTermo("Data", "quando a regra foi criada. Aparece em telas maiores."),
  bulletTermo("Chave de ativação", "liga e desliga a regra direto na lista."),
  bullet("Regras inativas aparecem esmaecidas."),
  h2("Buscar e filtrar"),
  bullet("A busca considera o título, o texto da regra e a origem."),
  bullet(
    "Os filtros de status são Todas, Ativas e Inativas, cada um com a sua contagem.",
  ),
  bullet("Busca e filtro se combinam."),
  h2("Totais e estimativa de tokens"),
  bullet(
    "Abaixo do título da seção aparece o total de regras, quantas estão ativas e a estimativa de tokens que elas adicionam ao contexto da IA.",
  ),
  bullet("Só as regras ativas entram nessa estimativa."),
  bullet(
    "A estimativa é indicativa: parte de uma proporção fixa de aproximadamente quatro caracteres por token.",
  ),
  h2("Painel de detalhes"),
  bullet(
    "Clicar em uma linha abre o painel “Detalhes da regra”, na lateral direita.",
  ),
  bullet(
    "O painel mostra o nível de confiança, o status (Ativa ou Inativa), o selo Corporativa quando houver, o título e o texto completos, a Origem e a data em Criada em.",
  ),
  bullet(
    "No fim do painel há o cartão “Usar nas respostas da IA”, com a mesma chave de ativação da lista.",
  ),

  // ------------------------------------------------------------ 4. CRIAR
  h1("4. Criar regra"),
  p("A criação começa pela ação “Nova regra”."),
  h2("Campos"),
  bulletTermo("Título", "obrigatório, até 160 caracteres."),
  bulletTermo("Regra", "obrigatório, até 2.000 caracteres no formulário."),
  bullet(
    "A ação de salvar só fica disponível quando os dois campos estão preenchidos.",
  ),
  bullet(
    "Ao atingir o limite de caracteres, o campo simplesmente para de aceitar texto, sem mensagem.",
  ),
  h2("Ao salvar"),
  bullet("A regra nasce ativa."),
  bullet("Nas próximas respostas, a IA passa a considerar essa regra."),
  bullet(
    "No texto da regra, é possível digitar [[ para inserir uma ligação a uma nota do Repositório ou a outra regra. A ligação é gravada como texto: ela não traz o conteúdo do item referenciado para dentro da regra.",
  ),
  bullet(
    "Se a gravação falhar, o formulário permanece aberto com o que foi digitado, para tentar de novo.",
  ),

  // ----------------------------------------------------- 5. ATIVAR/DESATIVAR
  h1("5. Ativar e desativar"),
  bullet("O status pode ser alterado na lista ou no painel de detalhes."),
  bulletTermo(
    "Regra ativa",
    "entra no contexto da IA e influencia as respostas.",
  ),
  bulletTermo(
    "Regra inativa",
    "permanece salva, mas não influencia as respostas.",
  ),
  bullet(
    "Uma regra inativa também sai da estimativa de tokens e deixa de aparecer nas sugestões de [[.",
  ),

  // --------------------------------------------------- 6. ALTERAR/EXCLUIR
  h1("6. Alterar e excluir"),
  h2("Alterar"),
  bullet(
    "Hoje não há edição do texto de uma regra: o painel de detalhes é somente leitura.",
  ),
  bullet(
    "Para mudar o título ou o texto, é preciso excluir a regra e criar outra.",
  ),
  bullet("O que se pode alterar em uma regra existente é apenas o status."),
  h2("Excluir"),
  bullet("A exclusão fica disponível no painel de detalhes."),
  bullet(
    "A exclusão é imediata: não há pedido de confirmação e não há como desfazer.",
  ),
  bullet("Ao excluir, a regra sai da lista e deixa de entrar no contexto da IA."),

  // ------------------------------------------------------ 7. CORPORATIVAS
  h1("7. Regras corporativas"),
  p(
    "Algumas regras podem estar marcadas como definição corporativa. Elas existem para garantir que certas restrições não sejam desligadas por engano.",
  ),
  bullet("Aparecem com o selo Corporativa na lista e no painel de detalhes."),
  bullet(
    "Para quem não é administrador, elas ficam sempre ativas: no lugar da chave de ativação aparece apenas a indicação de que são corporativas, e a ação de excluir não é oferecida.",
  ),
  bullet(
    "Administradores e proprietários podem gerenciá-las; para os demais, a tentativa é recusada pelo servidor.",
  ),
  bullet(
    "Na aplicação, uma regra corporativa tem precedência sobre uma regra comum. Entre regras de mesmo nível, vale a mais restritiva.",
  ),
  bullet(
    "A criação de novas regras corporativas está temporariamente desabilitada; as que já existem seguem valendo normalmente.",
  ),

  // -------------------------------------------------- 8. INFLUÊNCIA NA IA
  h1("8. Como as regras influenciam a IA"),
  p(
    "As regras ativas são entregues à IA como restrições obrigatórias, junto de cada pedido. Valem para tudo o que a IA produz.",
  ),
  table(
    ["Comportamento", "O que acontece"],
    [
      [
        "Alcance",
        "As regras se aplicam a toda resposta, em qualquer formato: chat, barra de pergunta, documento, artigo, apresentação, carrossel, ata, roteiro, legenda, resumo e e-mail.",
      ],
      [
        "Conflito",
        "Se uma regra conflitar com a instrução da tarefa ou com o pedido da pessoa, a regra prevalece.",
      ],
      [
        "Precedência",
        "Regras corporativas vêm antes das comuns; entre regras equivalentes, vale a mais restritiva.",
      ],
      [
        "Discrição",
        "A IA não reproduz, não lista e não menciona as regras na resposta, nem diz que existe algo limitando o que ela pode fazer.",
      ],
      [
        "Recusa parcial",
        "Se uma regra impedir parte do que foi pedido, a IA entrega todo o resto e diz em uma única linha curta que aquele ponto não pode ser atendido.",
      ],
      [
        "Geração de imagem",
        "A geração de imagem recebe uma versão compacta e mais curta das regras, porque o pedido de imagem não aceita um bloco longo de instruções.",
      ],
    ],
    [2100, 6926],
  ),
  spacer(160),
  bullet(
    "Regras e Repositório se complementam: as regras orientam a conduta; o Repositório fornece conteúdo e fatos.",
  ),

  // ----------------------------------------------------------- 9. LIMITES
  h1("9. Limites"),
  bullet("Título: 160 caracteres."),
  bullet("Texto da regra: 2.000 caracteres no formulário de criação."),
  bullet("Não há limite para a quantidade de regras cadastradas."),
  bullet(
    "A cada resposta, são consideradas até 300 regras ativas, na ordem de precedência.",
  ),
  bullet(
    "O conjunto de regras entregue à IA também tem um teto de tamanho. O que não couber é deixado de fora daquela resposta, com um aviso à IA de que a lista está incompleta.",
  ),
  bullet(
    "Esse descarte não é sinalizado na tela: a estimativa de tokens no cabeçalho é a única pista de que o conjunto está crescendo demais.",
  ),

  // -------------------------------------------------------- 10. SITUAÇÕES
  h1("10. Situações especiais"),
  bullet(
    "Título ou texto vazio: a regra não é salva até os campos obrigatórios serem preenchidos.",
  ),
  bullet(
    "Sem conexão com o servidor: a operação continua em modo local, com aviso à pessoa.",
  ),
  bullet(
    "Regras criadas ou alteradas em modo local ficam apenas naquele navegador e não são enviadas ao servidor depois. Na próxima carga bem-sucedida, a lista do servidor substitui a local e essas alterações desaparecem.",
  ),
  bullet(
    "Sem permissão para gerenciar determinada regra: as ações ficam indisponíveis.",
  ),
  bullet(
    "Falha ao ativar ou desativar: o status volta ao valor anterior e a pessoa é avisada.",
  ),
  bullet(
    "Falha ao carregar as regras no momento de uma resposta: a IA responde sem elas, em vez de a resposta falhar.",
  ),
  bullet(
    "A lista pode conter registros criados por outros fluxos do produto, e não só pela ação “Nova regra”. A coluna de origem é o que distingue esses casos.",
  ),

  // ---------------------------------------------------------- 11. RESUMO
  h1("11. Resumo do percurso"),
  p(
    "Configurações → Regras → criar, ativar ou consultar → a IA passa a seguir as regras ativas nas próximas respostas, em qualquer formato.",
  ),

  spacer(280),
  fecho(),
];

void gerar({
  nomeDoDocumento: NOME,
  children: corpo,
  outPath: path.join(__dirname, "Fluxo-Regras.docx"),
});
