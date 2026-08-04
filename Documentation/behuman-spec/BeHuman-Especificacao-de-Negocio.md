# beculture.ai, Especificação de Negócio

**Documento de requisitos de negócio para o squad interno**

| | |
|---|---|
| **Produto** | beculture.ai, Plataforma de Inteligência de Pessoas com IA |
| **Marca de interface** | beculture® |
| **Versão do documento** | 1.0 |
| **Data** | 21/07/2026 |
| **Destinatário** | Squad interno / squad de engenharia |
| **Natureza** | Especificação de **negócio**, descreve *o que* o produto entrega e *quais regras* deve honrar. Não prescreve arquitetura, banco de dados nem código. |
| **Edição de referência** | Web (SaaS multi-tenant). O app desktop é tratado como **origem/contexto** dos mesmos conceitos. |

---

## 0. Como ler este documento

Este documento define a **beculture.ai** pela ótica de negócio, organizado em torno de **seis pilares de valor**. Ele existe para que o squad interno entenda *o que* precisa ser construído e *sob quais regras*, sem depender de conhecimento tácito e sem que este texto amarre decisões técnicas (essas ficam a cargo da engenharia).

**O que está e o que não está aqui**
- **Está:** propósito de cada pilar, capacidades esperadas, regras de negócio, jornadas de uso e fronteiras de escopo.
- **Não está:** arquitetura, modelo de dados, endpoints, nomes de tabelas, algoritmos ou trechos de código. Quando um detalhe técnico é, na verdade, uma **regra de negócio** (ex.: "teste grátis de 14 dias sem cartão"), ele aparece, como regra, não como implementação.

**As duas edições do produto**
A beculture.ai existe hoje em duas formas que compartilham os mesmos conceitos de negócio, mas atendem contextos diferentes:

| | **Edição Web (referência)** | **Edição Desktop (origem)** |
|---|---|---|
| Público | Empresas, com vários usuários | Uso individual, numa máquina |
| Modelo | SaaS multi-tenant (uma empresa = um espaço isolado) | Aplicativo instalável, single-user |
| Dados | Centralizados por empresa | Locais, na máquina do usuário |
| Contratação | Trial self-service + assinatura | Instalação; o usuário traz a própria chave de IA |

> **Convenção deste documento:** a **Edição Web é a principal** e define o produto. Ao final de cada pilar há um bloco **"Na edição desktop"** que registra como o mesmo pilar se manifesta no app individual, porque parte da lógica de negócio da beculture.ai nasceu ali. Onde o texto não distingue, vale para as duas.

**Idioma e marca:** interface em pt-BR. O nome de produto é **beculture.ai**; a marca visível na interface é **beculture®**. Há nomes legados no código (*GregHub*, *Confi*) que não devem aparecer para o usuário final.

---

## 1. Visão de Produto (moldura)

### 1.1. O que é a beculture.ai

A beculture.ai é uma **plataforma de inteligência de pessoas com IA** para líderes, CEOs e áreas de Gente & Gestão. Ela transforma o conhecimento disperso de uma organização, reuniões, decisões, cultura, dados de ferramentas, em **respostas, conteúdo e ações**, com a IA agindo como um *business partner* sempre disponível e que **conhece o contexto da empresa**.

O produto se apoia em três ideias que se reforçam:

1. **Uma memória que a IA nunca esquece.** Tudo que importa sobre a empresa vira memória de longo prazo, injetada automaticamente em cada resposta.
2. **Conselheiros especialistas sob demanda.** *Squads* de agentes de IA que personificam referências humanas respondem no contexto do negócio.
3. **Produção de conteúdo e captura de conhecimento.** Um estúdio de IA cria atas, artigos, apresentações, imagens e vídeos; e transcreve reuniões que voltam para a memória.

### 1.2. Proposta de valor

| Para quem | Dor | Como a beculture.ai resolve |
|---|---|---|
| CEO / Fundador | Decisões estratégicas sem um sparring qualificado | Squads de conselho (governança, estratégia, risco) que respondem no contexto da empresa |
| RH / Gente & Gestão | Conhecimento e sinais de pessoas espalhados em várias ferramentas | Memória corporativa unificada + conectores (Slack, e-mail, agenda, CRM…) |
| Líder de área | Falta de tempo para produzir comunicação e documentação | AI Studio: ata, artigo, apresentação, carrossel, imagem e vídeo a partir de um input |
| Toda a organização | IA genérica que não conhece o negócio | Memória + squads treinados no perfil e na história da empresa |

### 1.3. O fio condutor: a Memória no centro

O diferencial da beculture.ai não é ter IA, é ter uma IA que **lembra**. A **Memória** é o eixo ao qual todos os outros pilares se conectam:

- Os **Squads** consultam a Memória antes de responder.
- A **Transcrição** de reuniões *alimenta* a Memória.
- Os **Conectores** trazem sinais externos que podem virar Memória.
- O **AI Studio** usa a Memória como fonte e devolve conteúdo que pode voltar para ela.
- A **Governança** define quem pode ler, escrever e proteger a Memória.

Por isso a Memória abre a lista de pilares.

### 1.4. Os seis pilares

| # | Pilar | Pergunta que responde |
|---|---|---|
| 2 | **Memória** | O que a IA sabe e lembra sobre a minha empresa? |
| 3 | **Squads & Agentes** | Com quem eu falo para decidir melhor? |
| 4 | **Transcrição** | Como minhas reuniões viram conhecimento e atas? |
| 5 | **Conectores** | Como conecto minhas ferramentas para a IA enxergar tudo? |
| 6 | **AI Studio** | Como produzo conteúdo profissional em minutos? |
| 7 | **Governança** | Quem pode o quê, quanto custa e como fico seguro e conforme? |

### 1.5. Contexto e ambição

A beculture.ai nasce da união entre **cultura e tecnologia** e integra o ecossistema do grupo (Confi/GregHub). Alguns pontos de contexto orientam as prioridades de negócio:

- **Entrega em ciclo curto.** A primeira versão é um MVP com meta de **12 semanas**, com marco de lançamento no evento **AI Brasil Experience**; o desenvolvimento roda em **sprints quinzenais**, com status recorrente à liderança.
- **De B2B a B2C.** O produto começa focado em empresas (B2B), mas a visão é evoluir para o indivíduo (B2C): cada pessoa constrói seu **"segundo cérebro"** e um **score de memória e impacto** que, no limite, complementa ou substitui o currículo tradicional.
- **Adoção por "checkout".** A contratação deve ser simples e self-service (compra rápida), sem depender de equipes de vendas, tanto no B2B quanto no B2C (ver Pilar 6.B).
- **API aberta por princípio.** A plataforma se conecta a líderes de mercado por APIs abertas, evitando integrações fechadas (ver Pilar 4).

---

## 2. Pilar 1, Memória

### 2.1. O que é e por que importa

A **Memória** é a base de conhecimento de longo prazo da empresa dentro da beculture.ai. É o que faz a IA deixar de ser genérica: cada memória **ativa** entra automaticamente no contexto das respostas dos squads e do chat, personalizando a IA para a cultura, a estratégia e a história daquela organização. É o ativo mais estratégico do produto, quanto mais rica a Memória, mais valiosa fica a IA. Internamente, esse conceito é o **"segundo cérebro"** da empresa e das pessoas: transcrições, apresentações e notas sobem para a Memória e ficam conectadas por temas, reuniões e pessoas, formando uma rede de onde a IA extrai contexto.

### 2.2. Capacidades

- **Registrar memórias**, fatos, diretrizes e contexto que a empresa quer que a IA sempre considere (ex.: "nossa prioridade do trimestre é retenção", "não trabalhamos com concorrente X").
- **Organizar por tema**, cada memória pertence a uma categoria: transversais (**estratégico**, **hierárquico**, **histórico**) ou vinculada a uma área/squad (ex.: financeiro, cultura).
- **Classificar por confiança**, cada memória indica seu nível de confiança (alta / média / baixa), sinalizando à IA o peso que deve dar.
- **Ativar / desativar**, memórias inativas deixam de influenciar a IA sem serem apagadas.
- **Captura automática**, a IA pode registrar memórias a partir de conversas, reuniões transcritas, documentos e conectores, sempre indicando a **origem**.
- **Memórias corporativas**, marcadas como política oficial da empresa: entram no contexto e são **protegidas** (ver regras).
- **Visão em grafo**, navegar a Memória como uma rede de conhecimento (notas, tags e ligações entre temas), no estilo de um "cérebro" visual, para enxergar conexões.
- **Painel de impacto**, mostrar total de memórias, quantas estão ativas e o **peso estimado no contexto** da IA (para o usuário perceber que memória demais dilui foco).
- **Gerar insights e tarefas**, a partir do conteúdo da Memória (reuniões, notas, documentos), a IA extrai insights e pode **gerar tarefas automaticamente**, ligando tópicos, reuniões e pessoas.
- **Mapa de habilidades (visão futura)**, evoluir a Memória para identificar **habilidades individuais e corporativas**, base do **score de memória e impacto** que sustenta a ambição B2C (ver §1.5).

### 2.3. Regras de negócio

1. **Toda memória pertence a uma empresa.** Nenhuma memória é compartilhada entre empresas diferentes.
2. **Memórias ativas são injetadas no contexto.** Ao responder, a IA considera as memórias ativas relevantes, respeitando uma ordem de precedência: **estratégico → hierárquico → categoria da área → histórico**.
3. **Memória corporativa é read-only para membros comuns.** Uma memória marcada como *corporativa* representa política da empresa; membros sem papel administrativo não podem editá-la, desativá-la nem removê-la. Apenas papéis administrativos gerenciam memória corporativa (ver Pilar 6, Governança).
4. **Origem sempre registrada.** Toda memória guarda de onde veio (manual, chat, reunião, conector), para auditoria e confiança.
5. **Volume tem custo cognitivo.** Como a memória entra no contexto da IA, o produto deve tornar visível seu "peso" e permitir curadoria, mais memória não é sempre melhor.

### 2.4. Jornadas de uso

- **Curadoria manual:** um administrador cria memórias-chave (estratégia, valores, restrições) logo no onboarding, marcando as oficiais como corporativas.
- **Aprendizado passivo:** durante o uso normal (chat, reuniões, documentos), a IA propõe/registra memórias novas; o usuário revisa e mantém as úteis.
- **Exploração:** o líder abre a visão em grafo para entender como os temas da empresa se conectam e onde há lacunas.

### 2.5. Fronteiras

- A Memória **não** é um repositório de arquivos (isso é função de Documentos/Conectores), ela guarda *fatos e diretrizes* que orientam a IA, não binários.
- A Memória **não** substitui um sistema de BI; ela é conhecimento qualitativo e contextual.

### 2.6. Na edição desktop

No app individual, a Memória tem duas faces: (a) um **vault de conhecimento** em arquivos de texto locais (notas com ligações, estilo Obsidian), que o usuário escolhe onde guardar na própria máquina; e (b) a **memória de longo prazo da IA** (mesmas categorias estratégico/hierárquico/histórico e o conceito de memória corporativa). A diferença de negócio: tudo é **local e de um único dono**, não há separação por empresa nem por usuário, porque o dono do app é sempre o "administrador".

---

## 3. Pilar 2, Squads & Agentes

### 3.1. O que é e por que importa

Os **Squads** são o coração da beculture.ai: grupos de **agentes de IA** organizados por área de negócio (Cultura, Financeiro, Jurídico, Gestão de Pessoas, Conselho Administrativo, Marketing, Dados & BI, Processos, Produto, Redes Sociais, Comunicação Interna, RH, entre outros). Cada agente **personifica uma referência humana** (ex.: um agente de Governança inspirado em Peter Drucker, um de Estratégia em Michael Porter, um de Risco em Nassim Taleb) e responde no contexto da empresa, apoiado pela Memória.

O valor: em vez de uma IA genérica, o líder consulta um **conselho de especialistas** que combina o repertório dessas referências com o conhecimento específico do seu negócio.

### 3.2. Capacidades

- **Catálogo de squads**, uma biblioteca de squads por domínio, cada um com uma descrição de "quando usar".
- **Chat com o squad**, conversar com o squad como uma **voz consolidada** que integra internamente o repertório de todos os seus conselheiros.
- **Chat com um agente específico**, quando o usuário quer a perspectiva de uma referência em particular.
- **Perguntas para começar**, cada squad oferece um conjunto de perguntas sugeridas que ajudam o usuário a iniciar (ex.: as "10 perguntas por squad").
- **Ações sugeridas**, cada squad oferece ações que a IA pode executar/produzir naquele domínio, funcionando como atalhos.
- **Fixar squads**, o usuário fixa seus squads favoritos para acesso rápido.
- **Histórico de conversas**, todo diálogo com squads fica registrado e recuperável, com título derivado da primeira mensagem.
- **Respostas em streaming**, a resposta aparece em tempo real, para uma experiência fluida.
- **Contexto da empresa embutido**, cada resposta combina o repertório do agente + o enquadramento da plataforma + a Memória de longo prazo da empresa.

### 3.3. Regras de negócio

1. **Os agentes personificam, não são as pessoas reais.** A interface deve deixar explícito: *"Não são as pessoas reais; são orientações geradas com base no perfil e no conteúdo público dessas referências."*
2. **Os prompts-base dos agentes são propriedade do produto.** O conteúdo que define cada persona **nunca** é exposto ao usuário nem trafega para o navegador, é ativo intelectual da plataforma.
3. **O squad fala como voz única.** Por padrão, o usuário conversa com o squad (a síntese dos conselheiros), não com cada agente isoladamente; falar com um agente específico é uma opção.
4. **Toda conversa é escopada à empresa e ao usuário.** O histórico pertence a quem conversou, dentro da empresa.
5. **A Memória entra em toda resposta.** Os squads não respondem "no vácuo": consultam a Memória ativa da empresa (ver Pilar 1).

### 3.4. Jornadas de uso

- **Decisão estratégica:** o CEO abre o squad "Conselho Administrativo", escolhe uma pergunta sugerida e recebe uma resposta que já considera a estratégia registrada na Memória.
- **Execução de área:** um líder de RH usa o squad "Gestão de Pessoas" para redigir uma política, e a ação sugerida vira um rascunho pronto no AI Studio.
- **Consulta pontual a uma referência:** o usuário pede especificamente a leitura de risco "no estilo Taleb" para um cenário.

### 3.5. Fronteiras

- O catálogo de squads é **curado pela plataforma** (derivado de um framework de referências). A criação de squads/agentes personalizados por empresa é uma evolução de produto, não um requisito básico desta spec.
- Squads **não** executam ações em sistemas externos por conta própria; produzem orientações e conteúdo (a execução em ferramentas passa por Conectores e pelo usuário).

### 3.6. Na edição desktop

O app individual traz o mesmo conceito de squads e agentes-referência, com os prompts igualmente protegidos (usados apenas internamente para montar a resposta). A diferença é de escala: um único usuário, sem histórico compartilhado nem papéis.

---

## 4. Pilar 3, Transcrição

### 4.1. O que é e por que importa

A **Transcrição** transforma reuniões, em áudio ou já em texto, em **atas executivas** e em **conhecimento que volta para a Memória**. É a ponte entre "o que foi dito numa reunião" e "o que a empresa passa a lembrar e agir". Resolve uma dor concreta: horas de reunião que se perdem por falta de registro estruturado.

### 4.2. Capacidades

- **Transcrever áudio de reunião**, enviar um arquivo de áudio e recebê-lo convertido em texto.
- **Gerar ata a partir de áudio**, a partir do áudio transcrito, produzir uma **ata executiva** estruturada (pauta, decisões, encaminhamentos/*action items*, responsáveis, próximos passos).
- **Gerar ata a partir de texto/transcrição existente**, colar uma transcrição ou enviar um arquivo e obter a ata, sem precisar do áudio.
- **Salvar na Memória**, opcionalmente, gravar a ata/conhecimento da reunião na Memória (categoria "Reuniões"), com título e ligações para temas relacionados.
- **Extrair insights de reunião**, além da ata, destacar resumo, decisões, pendências, riscos e perguntas em aberto.
- **Integração com a agenda**, conectar o calendário (ex.: Google Calendar) para identificar reuniões, processá-las e gerar resumos e pendências automaticamente.
- **Virar tarefas e reporte (roadmap)**, encaminhar as pendências da reunião para gestores de tarefas (ex.: Trello, ClickUp) e reportar produtividade à liderança.

### 4.3. Regras de negócio

1. **Áudio e texto são caminhos equivalentes.** O usuário pode chegar à ata partindo de um áudio ou de um texto já transcrito, o resultado de negócio é o mesmo.
2. **A ata é executiva por padrão.** O formato prioriza decisões e encaminhamentos acionáveis, não a transcrição literal.
3. **Salvar na Memória é opcional e explícito.** Nem toda reunião vira memória permanente; o usuário decide.
4. **O conteúdo é escopado à empresa.** Transcrições e atas pertencem à empresa que as gerou.
5. **Há limites de tamanho de upload** que devem ser comunicados ao usuário com clareza (mensagem amigável quando excedido), sem expor detalhes técnicos.

### 4.4. Jornadas de uso

- **Pós-reunião:** ao fim de um comitê, o líder envia o áudio, recebe a ata executiva, ajusta e salva na Memória, que passa a informar futuras respostas dos squads.
- **Reunião externa:** o usuário cola a transcrição gerada por outra ferramenta e obtém a ata no padrão da empresa.

### 4.5. Fronteiras

- A Transcrição **não** é uma ferramenta de gravação ao vivo com diarização avançada por palestrante nesta spec; o foco é converter o áudio/texto recebido em ata e conhecimento.
- A edição de vídeo (cortes) é tratada no AI Studio, não aqui.

### 4.6. Na edição desktop

No app individual, a transcrição **roda na máquina do usuário** (motor de voz local), o que a torna privada por natureza, mas dependente do ambiente do computador. O restante, gerar ata executiva e mandar para a Memória local, segue a mesma lógica de negócio da edição web.

---

## 5. Pilar 4, Conectores

### 5.1. O que é e por que importa

Os **Conectores** ligam a beculture.ai às ferramentas onde o trabalho já acontece, comunicação (Slack, Teams), e-mail e agenda, CRM, RH e folha, recrutamento, BI, produtividade, para que a IA enxergue sinais reais da operação e para que a empresa centralize contexto. É o que evita que a beculture.ai seja "mais uma ilha". A estratégia é de **API aberta**: priorizar conectores flexíveis para integrar com líderes de mercado e atender tanto B2B quanto B2C, evitando integrações fechadas.

Além de consumir ferramentas externas, a beculture.ai também **se expõe** como fonte para assistentes externos (ver 5.5).

### 5.2. Capacidades

- **Catálogo de integrações**, uma vitrine de conectores organizada por categoria (Comunicação, Identidade & Acessos, RH & Folha, Recrutamento, Produtividade & Projetos, BI & Analytics, CRM, Atendimento, Automação, Conteúdo, Documentos, Financeiro).
- **Conectar / desconectar**, a empresa ativa um conector e pode revogá-lo a qualquer momento.
- **Transparência de permissões**, cada conector informa, antes de conectar, o que será acessado (escopos), preferindo o mínimo necessário (ex.: leitura apenas).
- **Autorização segura**, integrações reais usam o fluxo de autorização do próprio provedor; as credenciais resultantes ficam **protegidas** e nunca são expostas ao usuário.
- **Sinais para insights**, dados trazidos por conectores podem alimentar insights e virar Memória.
- **Conectores em uso**, entre os já ativos estão e-mail, Slack, WhatsApp, CRM (Pipedrive) e agenda; a estratégia prevê ampliar para gestores de tarefas (ex.: Trello, ClickUp) e demais líderes de mercado.
- **beculture.ai como fonte externa**, expor os dados/ferramentas da empresa para assistentes externos (ver 5.5).

### 5.3. Regras de negócio

1. **Conectar é uma ação por empresa.** A conexão pertence ao tenant, não a um usuário isolado (na edição web).
2. **Credenciais nunca são expostas.** Tokens e chaves de integração ficam protegidos em repouso; a interface no máximo indica o estado (conectado / desconectado) e metadados não sensíveis.
3. **Mínimo privilégio.** Preferir escopos de leitura e o conjunto mínimo de permissões que entrega o valor.
4. **Revogação limpa.** Desconectar remove o acesso e as credenciais associadas.
5. **Permissões visíveis antes do consentimento.** O usuário vê o que está autorizando antes de concluir a conexão.

### 5.4. Jornadas de uso

- **Onboarding de contexto:** logo após entrar, a empresa conecta Slack e e-mail para que a IA comece a enxergar sinais de comunicação.
- **Governança de acesso:** um admin revisa os conectores ativos e revoga o que não é mais usado.

### 5.5. beculture.ai como fonte para assistentes externos

A beculture.ai pode ser **consumido por assistentes de IA externos** (ex.: Claude, Cursor) como uma fonte segura dos dados e capacidades da empresa. Regras de negócio:

- O acesso externo é autenticado por **chaves de acesso** geridas pela empresa.
- Uma chave é exibida **uma única vez** no momento da criação; depois, só se vê um identificador parcial.
- Chaves podem ser **rotuladas, monitoradas** (último uso) e **revogadas**, com trilha para auditoria.

### 5.6. Fronteiras

- A profundidade de cada integração varia: algumas trazem dados ricos, outras apenas sinais. Esta spec define o **padrão de negócio** (consentimento, mínimo privilégio, credenciais protegidas, revogação), não a lista fechada de campos por ferramenta.

### 5.7. Na edição desktop

No app individual, **cada usuário conecta as próprias contas** e as credenciais ficam guardadas com segurança **na sua máquina**. Um padrão característico dessa edição: o próprio aplicativo atua como "ponte" para ferramentas externas, executando integrações localmente. A regra de negócio (consentimento explícito, leitura mínima, credencial protegida, o token nunca vai para a tela) é a mesma.

> **Ponto de atenção para o squad interno (segurança):** na base desktop de referência, segredos de cliente OAuth (Google/Slack) estão embutidos em texto no código versionado para viabilizar a distribuição do instalador. Isso é aceitável apenas no modelo desktop com ressalvas e **não** deve ser replicado na edição web, onde segredos ficam em cofre server-side. Recomenda-se rotacionar essas credenciais.

---

## 6. Pilar 5, AI Studio

### 6.1. O que é e por que importa

O **AI Studio** é a central de **produção de conteúdo por IA** da beculture.ai, artigos, carrosséis, apresentações, imagens, vídeos, documentos organizados e análises, sempre podendo usar a Memória da empresa como fonte. Resolve a dor de "não ter tempo para produzir": o líder descreve o que quer e recebe um material profissional, editável e no tom da empresa, em minutos.

Além de gerar, o Studio também **melhora** textos existentes e **organiza** documentos para a Memória. (A Transcrição, Pilar 3, é uma capacidade irmã acessada pelo mesmo estúdio, mas documentada à parte por seu peso próprio.)

### 6.2. Capacidades (geradores)

| Função | O que entrega |
|---|---|
| **Perguntar à Memória** | Resposta a uma pergunta usando a Memória da empresa (e, opcionalmente, a web), com **fontes citadas** |
| **Criar artigo** | Artigo completo e editável, com título, subtítulo e corpo; suporta refino iterativo |
| **Criar carrossel** | Roteiro de carrossel (cards) + legenda + hashtags, para redes sociais |
| **Criar apresentação** | Roteiro editável e, a partir dele, a apresentação final (arquivo de slides ou versão navegável) |
| **Criar imagem** | Imagem gerada por IA, com controle de tamanho, qualidade e fundo |
| **Criar vídeo** | Vídeo com avatar/locução a partir de um roteiro |
| **Criar cortes** | Recorte/edição de vídeo no navegador, com exportação |
| **Organizar documento** | Recebe um arquivo/texto, organiza-o e pode salvá-lo na Memória (Documentos) |
| **Analisar conteúdo** | Análise estruturada de um arquivo ou link, orientada por um objetivo e por seções |
| **Melhorar texto** | Reescreve um texto com mais clareza, preservando o sentido (com desfazer) |

### 6.3. Regras de negócio

1. **A Memória é fonte opcional em todo gerador.** O usuário pode pedir que a criação use o conhecimento da empresa, é isso que diferencia o Studio de uma IA genérica.
2. **Tudo é editável e refinável.** Os artefatos nascem como rascunhos que o usuário ajusta; nada é "caixa-preta final".
3. **Rastreabilidade de fontes.** Quando a resposta se apoia em Memória ou web, as **fontes são citadas**.
4. **O resultado pode voltar para a Memória/Documentos.** O ciclo criação → conhecimento é intencional.
5. **A geração respeita a configuração de IA da empresa.** Qual provedor/modelo é usado segue as regras de Governança de IA (Pilar 6): a empresa pode usar a própria chave (BYOK) ou a IA gerida pela plataforma. Geração de imagem e vídeo podem ter provedores próprios por modalidade.
6. **Todo uso de IA é medido.** Cada geração consome IA e esse consumo é contabilizado (ver Pilar 6, Governança de IA), para limites, cotas e rateio.

### 6.4. Jornadas de uso

- **Comunicação de liderança:** o CEO pede um artigo sobre a estratégia do trimestre "usando a Memória"; recebe um rascunho alinhado à estratégia registrada e publica após ajustes.
- **Marketing rápido:** um líder gera um carrossel + legenda para anunciar uma conquista, tudo no tom da marca.
- **Preparo de comitê:** a partir de um relatório, o usuário gera uma apresentação executiva e uma análise orientada a um objetivo.

### 6.5. Fronteiras

- O AI Studio produz **rascunhos assistidos**, não substitui revisão humana, especialmente em conteúdo público e sensível.
- A lista de geradores é a de referência; novos formatos são evolução natural, mas as regras de negócio (Memória como fonte, editabilidade, fontes citadas, uso medido) valem para qualquer gerador futuro.

### 6.6. Na edição desktop

O app individual traz o mesmo estúdio (artigo, apresentação, carrossel, imagem, vídeo, book/whitepaper, atas, melhorar texto), com uma diferença comercial central: **cada usuário traz a própria chave de IA**, guardada com segurança na máquina, e arca com o próprio custo de uso. Na edição web, isso vira a escolha entre *IA própria (BYOK)* e *IA gerida pela plataforma* (Pilar 6).

---

## 7. Pilar 6, Governança

> A Governança é a camada que **controla, comercializa e protege** tudo o que os pilares anteriores entregam. Reúne quatro frentes: **(A) modelo organizacional, papéis & permissões**, **(B) empresa, planos & trial**, **(C) segurança & LGPD** e **(D) governança de IA**.

### 7.A. Modelo organizacional, papéis & permissões

**Por que importa:** define **como empresas, pessoas e vínculos se organizam** e quem pode fazer o quê, protegendo dados sensíveis e políticas oficiais.

#### Modelo organizacional e identidade

O modelo precisa ir além de "uma empresa com seus usuários". A visão é uma **identidade centrada no indivíduo** ("atômica"), que participa de múltiplos contextos de forma independente:

- **Indivíduo em múltiplas empresas (N:N).** Uma mesma pessoa pertence a várias empresas/contextos ao mesmo tempo, com **múltiplos e-mails institucionais sincronizados** para um único acesso. O que a pessoa vê depende do contexto ativo.
- **Grupos, franquias e gestão de CNPJs.** Uma entidade pode **gerenciar múltiplos clientes/CNPJs abaixo de si** (cenários de holding, franquia, consultoria e gestão descentralizada). O modelo deve suportar relações **N:N** entre pessoas, empresas e grupos.
- **Estrutura por squads, não hierarquia rígida.** A organização do trabalho é vista como **squads multidisciplinares** (grupos de projeto), não como um organograma rígido. Uma pessoa participa de vários grupos e a governança de acesso segue essa estrutura funcional. *(Aqui "squad" é um time de pessoas, não um Squad de IA do Pilar 2.)*
- **Organograma e visibilidade por conexão.** O produto permite cadastro livre de pessoas e define **permissões de visualização por conexão**: cada gestor acompanha sua equipe, sem que tarefas individuais fiquem expostas indevidamente entre colegas.
- **Internos vs externos.** A plataforma distingue usuários **internos** de **externos** pelo vínculo institucional (ex.: domínio do e-mail), facilitando a gestão em grande volume de pessoas.
- **Organograma automático.** Quando possível, importar o organograma conectando aos sistemas de gestão de pessoas da empresa, evitando estruturação manual.

#### Papéis e permissões

**Modelo de papéis** (três níveis):

| Papel | Quem é |
|---|---|
| **Owner** | Dono da conta da empresa; controla assinatura e configurações críticas |
| **Admin** | Gestor operacional; administra equipe, IA e memória corporativa |
| **Membro** | Usa o produto no dia a dia, com acesso de leitura ao que é corporativo |

**Matriz de permissões (alvo):**

| Ação | Owner | Admin | Membro |
|---|:--:|:--:|:--:|
| Usar squads, IA, memória, conectores | ✅ | ✅ | ✅ |
| Convidar / remover usuários | ✅ | ✅ | ✗ |
| Gerir assinatura e pagamento | ✅ | ✗ | ✗ |
| Configurar conexão de IA (BYOK) | ✅ | ✅ | ✗ |
| Editar memória corporativa (membro só lê) | ✅ | ✅ | ✗ |
| Conectar / revogar integrações | ✅ | ✅ | ✗ |

**Regras de negócio:**
1. **Convite por e-mail.** O owner/admin convida membros; um e-mail é único dentro de uma empresa; o convite tem estado (pendente → aceito).
2. **Papéis definem escopo de ação, não de tenant.** Todos veem os dados da *sua* empresa; o papel restringe *o que podem alterar*.
3. **Ações críticas exigem papel adequado.** Assinatura é exclusiva do owner; memória corporativa e IA, de papéis administrativos.

### 7.B. Empresa, Planos & Trial (contratação)

**Por que importa:** é como o produto é vendido e como a receita entra, no modelo self-service.

**Requisito central:** contratação **inteiramente self-service**, no modelo ClickUp, o cliente escolhe módulos/plano num site, começa um **teste grátis de 14 dias sem cartão de crédito** e converte em assinatura paga **sem falar com vendas**.

**Capacidades:**
- **Cadastro self-service** que calcula o preço **ao vivo** conforme o cliente ajusta módulos, plano, ciclo e quantidade de usuários.
- **Identidade do cliente** como Pessoa Jurídica (CNPJ) ou Pessoa Física (CPF).
- **Início de trial** que cria a empresa, o usuário owner e a assinatura em teste, com **auto-login**.
- **Checkout** para converter o trial em assinatura ativa (Pix, cartão, boleto).
- **Gestão da assinatura** nas configurações (plano atual, faturas, método de pagamento).

**Planos e módulos:**

| Plano | Público | Destaques |
|---|---|---|
| **Basic** | Equipes que só precisam do módulo escolhido | Essencial do módulo, suporte por chat |
| **Profissional** ⭐ | Quem quer o módulo + excelência | Recursos completos, IA de sinais, CSM dedicado |
| **Expert** | Escala e requisitos corporativos | Tudo do Profissional + SSO/SAML, API dedicada, multi-empresa, LGPD avançado, SLA e suporte 24/7 |

| Módulo | Base de cobrança |
|---|---|
| Performance (avaliações, OKRs, 1:1s) | por usuário |
| Learning (trilhas / LMS) | por usuário |
| Project Management (projetos e tarefas) | por usuário |
| Hiring (vagas e pipeline) | por posição (vaga) |

**Regras de negócio:**
1. **Trial de 14 dias sem cartão.** Selo permanente na tela de contratação; não se pede pagamento para começar.
2. **Preço = valor unitário × quantidade, por mês.** O unitário varia por módulo × ciclo × plano × faixa de quantidade.
3. **Contrato anual aplica desconto** sobre o mensal.
4. **Multi-módulo por usuário** compõe o preço do plano + o básico de cada módulo adicional (nunca o plano cheio N vezes).
5. **Hiring é cobrado por posição**, isolado dos módulos por usuário.
6. **Preço "sob consulta"** para faixas/edições enterprise sem tabela pública.
7. **A tabela de preços deve ser parametrizável** pelo time comercial, sem depender de nova versão do software.
8. **A assinatura guarda um retrato dos preços** no momento da contratação, para não sofrer com mudanças futuras de tabela.
9. **Ciclo de vida da assinatura:** trial → ativa → inadimplente → expirada → cancelada, com caminhos de regularização.
10. **O produto nunca fala direto com o meio de pagamento**, toda cobrança passa por uma camada de abstração, permitindo trocar de provedor sem reescrever o funil.

### 7.C. Segurança & LGPD

**Por que importa:** a beculture.ai guarda conhecimento estratégico e dados de pessoas; confiança é pré-requisito de venda, sobretudo no plano Expert.

> Os requisitos **normativos e detalhados** de segurança e privacidade (PII, criptografia, controle de acesso, auditoria, exclusão, APIs e logs) estão consolidados na **§8, Requisitos de Segurança e Privacidade (LGPD / GDPR)**. Os itens abaixo são o enquadramento de negócio.

**Requisitos de negócio:**
1. **Isolamento entre empresas.** Nenhum dado de uma empresa é acessível por outra; o pertencimento à empresa vem sempre da sessão autenticada, nunca de um valor informado pelo cliente.
2. **Segredos protegidos em repouso.** Chaves de IA e credenciais de conectores ficam criptografadas; a interface no máximo mostra um identificador parcial.
3. **Chaves de acesso externas mostradas uma única vez** e guardadas apenas de forma irreversível (com trilha de uso e revogação).
4. **Senhas nunca em texto claro** e proteção contra tentativas de força bruta no login.
5. **Exclusão limpa por empresa.** Encerrar um cliente remove seus dados associados.
6. **Privacidade e conformidade (LGPD, GDPR, PIA).** Dados pessoais isolados por empresa; prever exportação, retenção e direito ao esquecimento. Considerar **LGPD** e **GDPR** e realizar **PIA/RIPD** (avaliação de impacto à privacidade) desde o início do desenvolvimento. O plano Expert promete "LGPD avançado", deve ser detalhado (DPA, retenção, encarregado).
7. **SSO/SAML** como requisito do plano Expert.
8. **Disponibilidade e suporte** conforme o plano (Expert cita SLA elevado e 24/7).

### 7.D. Governança de IA

**Por que importa:** define **de quem é a IA** que roda por trás do produto, **quanto** cada empresa usa e **sob quais limites**, o que impacta diretamente custo, precificação e confiança.

**Requisito central:** a IA pode ser **corporativa (BYOK, a empresa usa a própria chave)** ou **gerida pela plataforma (chave da plataforma)**.

**Capacidades e regras:**
1. **BYOK (traga sua chave).** Owner/admin conecta a chave de IA da empresa; o sistema **valida** a chave, guarda-a protegida e passa a usá-la nas gerações. Vantagem: a empresa controla custo e provedor.
2. **IA gerida pela plataforma.** Sem BYOK, o produto usa a chave da própria plataforma; nesse caso, o consumo é medido por empresa para **rateio e cobrança**.
3. **Ordem de resolução clara.** Primeiro a chave da empresa (se houver); senão, a chave gerida; senão, uma mensagem amigável pedindo para configurar a IA.
4. **Mídia pode ter conexões próprias.** Geração de imagem e vídeo podem usar provedores/chaves específicos por modalidade.
5. **Todo uso é medido.** Cada chamada de IA registra consumo (entrada/saída), exibido em janelas de tempo (ex.: 1h / 24h / 7d) e escopado por usuário dentro da empresa.
6. **Cotas e limites por plano.** O consumo alimenta cotas por plano, evitando abuso e sustentando o modelo comercial. (Definição das cotas por plano é decisão comercial a detalhar.)
7. **Rastreabilidade de quem paga o token.** O produto distingue uso em IA própria vs gerida, para telemetria e faturamento corretos.
8. **Diretrizes corporativas restringem a geração.** A empresa pode definir políticas que limitam o que a IA produz (ex.: proibir o uso de logotipos de clientes em materiais gerados). Essas diretrizes vivem na Memória corporativa (Pilar 1) e são aplicadas nas gerações do AI Studio.
9. **Controle de consumo como métrica de performance.** A medição de tokens serve não só a rateio/cobrança, mas também a **quantificar performance e otimizar recursos** por empresa e por usuário.

### 7.E. Na edição desktop

A edição individual **praticamente não tem governança**, por desenho: é single-user, sem login, papéis, planos ou multi-tenancy, o dono da máquina é sempre o administrador. A "governança" ali se resume a: isolamento pelo próprio sistema operacional, segredos guardados com segurança na máquina, e **cada usuário com a própria chave de IA e o próprio custo**. Isso reforça, por contraste, por que a edição web precisa de toda a camada de Governança descrita acima.

---

## 8. Requisitos de Segurança e Privacidade (LGPD / GDPR)

Esta seção consolida os requisitos **normativos** de segurança e privacidade que o produto deve atender, detalhando a frente §7.C. São requisitos de conformidade (**LGPD** e **GDPR**, com **PIA/RIPD**) que o squad interno **deve** implementar desde o início do desenvolvimento. Aplicam-se à **edição web** (multi-tenant), onde há dados pessoais de múltiplos usuários e empresas.

### 8.1. Proteção e criptografia de dados pessoais (PII)

- Todos os dados pessoais (PII) devem ser **mascarados na interface** e **criptografados com AES-256**.
- Campos mínimos a proteger: **Nome**, **CPF**, **Telefone**, **E-mail**, **Cartão** (quando aplicável) e **Endereço**.

### 8.2. Consentimento do usuário

Registrar, a cada aceite de termo:

- Usuário
- Data/hora
- IP
- Versão do termo aceito
- Origem (Web, Mobile, API)

Permitir a **revogação** do consentimento a qualquer momento.

### 8.3. Controle de acesso

- **Passwordless** (autenticação sem senha)
- **MFA** (autenticação multifator)
- **RBAC** (controle por papéis), ver §7.A
- **Menor privilégio**
- **Timeout de sessão**
- **Bloqueio após tentativas de acesso inválidas**

### 8.4. Criptografia

**Dados em trânsito**

- TLS 1.2 ou superior

**Dados armazenados**

- AES-256 para dados PII
- Criptografia em repouso habilitada
- Backups criptografados

**Gestão de chaves**

- Cofre de chaves (Key Vault)
- Rotação periódica de chaves

### 8.5. Auditoria

Eventos que devem ser auditados: **Login**, **Logout**, **Consulta de PII**, **Alteração**, **Exclusão**, **Exportação**, **Compartilhamento**, **Consentimento** e **Revogação**.

Cada registro de auditoria deve conter:

- Usuário
- Data/hora
- IP
- Ação
- Recurso
- Resultado da operação

### 8.6. Exclusão de dados

- **Exclusão lógica** (*soft delete*)
- Manter **rastreabilidade**
- **Acesso auditado** ao dado excluído

### 8.7. APIs

- OAuth2 / JWT
- Rate limit
- Versionamento
- HTTPS / TLS
- Proteção contra injeção (*injection*)
- Validação de entrada

### 8.8. Logs

**Nunca registrar:** senhas, tokens, CPF completo, cartão, CVV, cookies de sessão ou qualquer dado PII em texto claro.

Quando for necessário registrar um dado sensível, utilizar **mascaramento**.

---

## 9. Resumo de capacidades por pilar

| Pilar | Entrega central | Regra de negócio mais importante |
|---|---|---|
| **Memória** | Conhecimento de longo prazo injetado na IA | Memória ativa entra no contexto; corporativa é read-only para membros |
| **Squads & Agentes** | Conselheiros de IA por área, no contexto da empresa | Personificam referências (não são as pessoas); prompts são ativo do produto |
| **Transcrição** | Reuniões viram ata executiva + conhecimento | Áudio e texto levam ao mesmo resultado; salvar na Memória é opcional |
| **Conectores** | Ferramentas externas conectadas à IA | Consentimento explícito, mínimo privilégio, credenciais protegidas |
| **AI Studio** | Produção de conteúdo profissional por IA | Memória como fonte opcional; tudo editável; uso medido |
| **Governança** | Controle, venda e proteção do produto | Trial 14 dias sem cartão; isolamento por empresa; IA BYOK ou gerida |

---

## 10. Glossário

- **beculture.ai**, o produto (plataforma de inteligência de pessoas com IA).
- **beculture®**, a marca visível na interface.
- **Empresa (tenant)**, a unidade que contrata; seus dados são isolados das demais. (Edição web.)
- **Usuário**, quem faz login; pertence a uma empresa e tem um papel.
- **Papel**, owner, admin ou membro; define o que o usuário pode alterar.
- **Memória**, base de conhecimento de longo prazo que a IA usa em toda resposta.
- **Memória corporativa**, memória oficial da empresa, protegida contra edição por membros.
- **Squad**, grupo de agentes de IA de um domínio (ex.: Financeiro).
- **Agente**, persona de IA dentro de um squad, que personifica uma referência humana.
- **Conector**, integração com uma ferramenta externa.
- **AI Studio**, conjunto de geradores de conteúdo por IA.
- **BYOK** (*Bring Your Own Key*), a empresa usa a própria chave de IA.
- **IA gerida**, a plataforma fornece a IA e mede/cobra o uso.
- **Trial**, teste grátis de 14 dias sem cartão de crédito.
- **Edição Web / Edição Desktop**, as duas formas do produto (SaaS multi-tenant / app individual).
- **PII** (*Personally Identifiable Information*), dados pessoais identificáveis (nome, CPF, telefone, e-mail, cartão, endereço).
- **MFA** (*Multi-Factor Authentication*), autenticação com mais de um fator.
- **RBAC** (*Role-Based Access Control*), controle de acesso por papéis.

---

## 11. Fora de escopo desta especificação

Para manter o foco nos seis pilares de valor, esta spec **não** detalha:
- Os módulos comerciais adjacentes (Performance, Learning, Hiring, Project Management) além da forma como são cobrados (Pilar 6.B), merecem specs próprias.
- Detalhes de implementação técnica (arquitetura, dados, endpoints, algoritmos), por definição, decisão do squad interno.
- A lista fechada de campos/eventos de cada conector individual, aqui fica o **padrão de negócio** dos conectores.

> **Nota de marca:** a interface usa a marca **beculture®**; nomes legados no código (*GregHub*, *Confi*) não devem aparecer ao usuário final. O arquivo `beautyin-design-system.md` na raiz do repositório refere-se a **outra marca** (suplementos) e **não** se aplica a este produto.
