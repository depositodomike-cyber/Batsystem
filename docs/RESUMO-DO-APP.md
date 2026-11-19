# Oracle (repositório Batsystem): resumo do que foi desenvolvido

> Contexto para outra IA. Estado em 2026-11-18, branch `orquestrador`.
> Os textos, o código e os nomes de rotas estão em português.

## 1. O que é

O **Oracle** é um "sistema operacional pessoal/corporativo com IA". Ele junta:

- um repositório de conhecimento (notas `.md` locais + base da organização);
- um assistente que conversa com essa memória, a web e os conectores;
- um AI Studio que gera conteúdo (apresentações, planilhas, artigos, atas etc.);
- insights automáticos;
- resumo matinal por voz;
- controle seguro do computador do usuário por um agente local.

O projeto saiu do `beculture-product` (BeHuman) e passou por um rebranding completo para Oracle. Hoje é **independente e só para uso local**, sem deploy ativo; os arquivos da Vercel continuam no repo, mas estão inertes.

## 1.1 Catálogo completo de funcionalidades

Legenda: ✅ ativo · 🔒 existe no código, mas oculto ou desligado por flag · 🧪 mock ou simulado · 🚧 em desenvolvimento (não commitado)

### Conta, acesso e organização
- ✅ **Login e senha**, com sessão JWT.
- ✅ **Conta de demonstração**: botão que preenche `demo@oracle.ai`.
- ✅ **Modo local**: se a API cair, o app continua com os dados do navegador.
- ✅ **Criação de conta**: nome, e-mail e senha; a confirmação de e-mail é 🧪 simulada.
- ✅ Organização opcional.
- ✅ **Contextos e repositórios múltiplos**: seletor na sidebar, criação de repositório e uma pasta local por repositório.
- ✅ **Isolamento por conta**: os dados de um usuário não vazam para outro no mesmo navegador.
- ✅ Splash após o login.
- 🔒 **Cadastro legado com calculadora de preço**, onboarding guiado e calculadora: o backend cria empresa, owner e trial de 14 dias.
- 🧪 **Assinatura e cobrança** por módulo, plano e ciclo, com desconto anual; a Iugu não está integrada.
- 🔒 **Convites de membros**.

### Gestão de pessoas e estrutura (backend pronto, telas ocultas no Oracle)
- 🔒 **Membros**:
  - cadastro, com gestor direto, gestores indiretos, área, cargo e tipo (membro ou convidado);
  - visões em Lista, Árvore, Hierarquia e Organograma;
  - realocação, conversão de convidado em membro e exclusão com opções.
- 🔒 **Áreas e Cargos**: CRUD; desativar é o caminho normal e excluir é bloqueado se houver membros.
- 🔒 **Roles e permissões**:
  - roles de sistema: Owner, Admin, Editor, Viewer e Convidado;
  - roles personalizadas;
  - matriz de permissões granular;
  - transferência de owner.
- 🔒 **Módulos de RH**: Learning (universidade, treinamentos, LMS), Performance (1:1, avaliação 360, autoavaliação, PDI, calibração, elogios, metas), Gestão de Projetos (alocação de horas) e Hiring (vagas, candidatos, banco de CVs, WhatsApp, páginas de divulgação, campanhas). **São só entradas de menu com Placeholder; não há funcionalidade.**
- 🔒 **Feed** com likes e comentários (no localStorage) e **Relatórios**.

### Repositório e Memória (o "segundo cérebro")
- ✅ **Pasta local de notas `.md`** como repositório pessoal:
  - acessada direto do disco pelo navegador (File System Access);
  - em navegadores sem essa API, vira uma cópia somente leitura.
- ✅ **Visão em Lista** das notas, com pastas, tags e busca.
- 🔒 **Visão em Grafo**: force-directed, com [[wikilinks]], tags e pastas, e painel de contexto.
- ✅ **Abrir nota** e exportar o arquivo original. 🔒 A edição de notas está desligada.
- ✅ **Sincronizar com a IA**: indexa as notas no backend e as classifica automaticamente em categorias macro.
- ✅ **Organização automática por pastas**: cada ação de IA salva na subpasta certa (Artigos, Imagens, Reuniões, Pessoas…).
- ✅ **Adicionar ao repositório**:
  - Upload Documento: extrai o texto e gera uma página de documento.
  - Upload Áudio: transcreve com Whisper, resume e salva em Reuniões.
  - Upload Transcrição: gera a ata.
- ✅ **Sugestões depois do upload**: gerar atividades ou insights.
- ✅ **Importar do Google Drive**: explorador de pastas, somente leitura.
- ✅ **Importar Notas Autoadesivas do Windows**: lê o banco do Sticky Notes no próprio navegador, sem IA.
- ✅ **Repositório da organização**: documentos compartilhados (PDF e DOCX, com extração de texto), consultados pela IA via busca. Quem pode enviar ou remover depende do papel.
- ✅ **Regras / diretrizes da IA**:
  - regras que entram em todo prompt;
  - ativar e desativar;
  - estimativa de tokens.
  - 🔒 Regras corporativas fixadas estão desligadas.
- ✅ **Biblioteca de Documentos**, local no navegador.

### Notas e tarefas
- ✅ **Notas**:
  - assuntos e notas rápidas;
  - "Gravar no Repositório", que gera o `.md` e sincroniza;
  - atalhos que abrem ferramentas de IA já preenchidas com a nota.
- ✅ **To Do em Kanban**: a rota existe, mas não está no menu.
- 🔒 **Grupos e Projetos**: cada grupo tem pasta própria (Conversas e Documentos) e chat de grupo. 🔒 "Enviar para grupo" também está desligado.

### Assistente e conversas
- ✅ **PromptBar "Pergunte ao seu Repositório"**, no header:
  - fonte **Auto, Memória ou Web**;
  - anexo de texto;
  - ditado por voz.
- ✅ **Assistente flutuante** (bolinha + painel):
  - responde com base na memória, na web e nos conectores;
  - mostra etapas em tempo real (SSE).
- ✅ **Orquestrador multi-etapas**:
  - planeja e executa ferramentas;
  - pede **aprovação** antes de qualquer escrita, com cards de aprovar ou recusar;
  - retoma ou cancela execuções;
  - lista as tarefas em aberto.
- ✅ **Ferramentas do Assistente**:
  - buscar na memória, buscar na web e abrir página;
  - ler e-mails, agenda e Drive;
  - consultar agentes;
  - melhorar texto, gerar ata e gerar artigo;
  - salvar no repositório;
  - controlar o computador.
- ✅ **@menção de agentes**: cada agente mencionado responde no seu turno.
- ✅ **Histórico de conversas**: lista, abrir, renomear e excluir, por repositório.
- ✅ **Painel lateral** com Histórico e Documentos.
- ✅ **"Pare tudo"**: interrompe as ações em andamento no computador.

### Squads e Agentes
- ✅ **Catálogo de 15 squads** com agentes especialistas: comunicação interna, conselho, cultura, dados, financeiro, gestão de pessoas, jurídico, marketing, processos, produto, redes sociais, RH, sucesso do cliente, vendas inbound e outbound.
  - Cada squad tem perguntas e ações iniciais.
- ✅ **Página do agente**: perfil, skills e especialistas; o botão "Conversar" insere a @menção.
- ✅ **Agentes personalizados**: pessoais ou da organização, criados pelo usuário com o próprio prompt.
- ✅ **Personalizar agentes do sistema** na organização: sobrescrever ou ocultar.
- 🔒 **Fixar agentes na sidebar**.

### AI Studio (criação de conteúdo)

Todas as ferramentas têm wizard em etapas, autosave e retomada, e podem salvar no Repositório.

- ✅ **Criar apresentação**:
  - identidade visual;
  - plano, roteiro e slides;
  - ajustes por conversa;
  - gera **PPTX** e HTML;
  - usa a marca ativa e templates.
- ✅ **Criar planilha**: plano por aba, fontes de dados e ajustes; gera **XLSX**.
- ✅ **Análise de conteúdo**: relatório de 17 seções, exportado em `.md`, impressão ou cópia, e cruzado com as Notas.
- ✅ **Criar artigo**, com refino iterativo.
- ✅ **Criar ata**, a partir de arquivo ou transcrição.
- ✅ **Criar carrossel** para redes sociais: roteiro e HTML autônomo.
- ✅ **Criar imagem** (OpenAI): grade com download.
- ✅ **Criar dashboard**: página HTML autônoma.
- ✅ **Melhorar texto**: rodadas com desfazer.
- ✅ **Criar vídeo** com avatar (HeyGen): roteiro, escolha de avatar e voz, geração e acompanhamento do status.
- ✅ **Criar cortes de vídeo**, processados 100% no navegador (ffmpeg.wasm).
- ✅ **Minhas criações**: lista, rascunhos, retomada e exclusão, privada por usuário.

### Insights
- ✅ **Insights estratégicos gerados por IA** a partir de atas, áudios, documentos e do repositório. Classificados por severidade, com detalhe.
- ✅ **Gerar insights sob demanda**, do repositório ou de um conteúdo.
- ✅ **Feedback 👍/👎** com motivo; o 👎 sugere um direcionamento.
- ✅ **"Conversar com o assistente"** sobre um insight.
- ✅ **Notificações**: o sino mostra insights não lidos; é possível marcar como lido.
- ✅ **Orientador (direcionadores)**: define o foco dos insights. Admins definem para a organização ou uma área; os demais, para a própria área.
- 🧪 **Ações a partir do insight**: criar tarefa, reunião ou 1:1.

### Resumo Matinal
- ✅ **Briefing diário**:
  - agenda do dia;
  - e-mails importantes;
  - destaques do repositório;
  - clima;
  - notícias;
  - tarefas e projetos;
  - personalizado pelo Perfil.
- ✅ **Leitura em voz alta** por segmentos, com pausar e retomar. Também pode ser acionado por voz, com "Oracle, bom dia".
- ✅ **Perguntar sobre um item** do briefing e voltar à leitura.
- ✅ **Criar tarefa** a partir do briefing.

### Conectores e integrações
- ✅ **Google Calendar**: a página Agenda mostra os eventos reais e permite enviá-los ao Repositório (Reuniões ou Pessoas).
- ✅ **Gmail e Outlook**: a página Email tem caixa de entrada, marca como lido e salva no Repositório.
- ✅ **Google Drive**: explorador e importação, somente leitura.
- ✅ **Telegram**:
  - o bot recebe notas por **texto e áudio**, com o áudio transcrito;
  - cada mensagem vira uma Nota e um `.md` no Repositório;
  - o vínculo é feito por código.
- 🔒 **Slack**: ler canais e mensagens. O envio de mensagens funciona via MCP.
- 🧪 **Cerca de 60 outros conectores** (RH, ATS, CRM, produtividade, Teams, OneDrive, WhatsApp, YouTube, Zapier…): catálogo com filtros e credenciais, sem integração real.
- ✅ **Servidor MCP**: expõe conectores e Slack para clientes MCP externos com chave de API. 🔒 A tela de gestão de chaves não aparece.

### IA: configuração e consumo
- ✅ **BYOK, traga sua própria chave**:
  - chaves Anthropic e OpenAI, validadas e criptografadas.
- ✅ **Fila de prioridade de modelos** por modalidade (Texto, Imagem, Vídeo):
  - ordem definida por arrastar;
  - failover automático entre provedores.
- ✅ **Escolha entre vários modelos** Claude e GPT.
- ✅ **Recusa por política de conteúdo** tratada com mensagem amigável.
- 🔒 **Painel de consumo de tokens** (1h, 24h, 7d, 30d). Os dados são registrados mesmo com o painel oculto.

### Perfil e personalização
- ✅ **Perfil pessoal**: básico, formação, interesses, comunicação, objetivos e estilo de vida.
  - Personaliza as respostas da IA e o briefing.
  - Também é salvo como `.md` no Repositório.
  - A exclusão é definitiva.
- ✅ **Guia de marca / Identidade visual**: marcas da organização (cores, tipografia, logos) usadas pelo AI Studio, e templates de apresentação analisados por IA.
- ✅ **Aparência**: animação de fundo e vinheta. O tema é escuro, com primária rose. 🔒 O painel completo de aparência está desligado.
- ✅ **Idiomas**: português, inglês, espanhol, árabe e chinês.

### Voz
- ✅ **Palavra de ativação "Oracle"**, reconhecida localmente no navegador (Vosk), sem enviar áudio para fora.
- ✅ **Ditado**, com envio automático e bipe.
- ✅ **Resposta falada**, com escolha de voz.
- ✅ **Comandos de voz para o computador**, com vocabulário fonético em PT e correção de nomes de apps.

### Controle do computador ("Ambiente local")
- ✅ **Parear um PC Windows** com o Oracle Local Agent, por código e conferência de impressão digital.
- ✅ **Política por categoria**, que o usuário liga e desliga:
  - apps, processos, janelas;
  - busca de arquivos, escrita de arquivos, documentos;
  - navegador, mídia, energia.
  - Também é possível marcar operações como "sempre confirmar".
- ✅ **Ações**:
  - abrir aplicativos, incluindo apps da Microsoft Store, sites e documentos;
  - listar processos e janelas;
  - organizar janelas;
  - controlar mídia (play, pause, volume);
  - buscar arquivos, criar pasta e mover arquivo;
  - fechar app;
  - desligar ou reiniciar, com aviso.
- ✅ **Comandos diretos instantâneos** ("abrir o Spotify", "pausar música"), com **Desfazer**.
- ✅ **Aprovação humana** para ações de risco alto.
- ✅ **Gestão de dispositivos**: confirmar, revogar, retomar e ver o histórico de execuções.
- ✅ **Bandeja do agente**: "Pare tudo" offline e confirmação local das permissões.
- 📋 **Planejado (Fases 4–6)**: mouse e teclado, captura de tela, wake word no agente e reautenticação para aprovar risco alto.

### Oracle Desktop (app Windows) 🚧
- 🚧 **Instalador Windows** com atualização automática.
- 🚧 **Banco e API embutidos**: roda sem Docker.
- 🚧 **Login persistente** com cifragem do sistema.
- 🚧 **Migração dos dados do navegador** para o app.
- 🚧 **Conectores via navegador do sistema**, com retorno automático ao app.
- 🚧 **Ditado por gravação + Whisper**.
- 🚧 **Prévias de HTML** em janela isolada.
- 🚧 **Recursos de desktop**:
  - ícone na bandeja;
  - atalho global `Ctrl+Alt+O`;
  - iniciar com o Windows;
  - notificações nativas.
- 🚧 **Supervisão do Local Agent** pelo app.

## 2. Stack e estrutura do repositório

Não há monorepo com ferramenta: cada pasta é um projeto independente.

| Pasta | O que é |
|---|---|
| `ts/api` | **API**: NestJS 11, Prisma 6 e PostgreSQL (Docker `batsystem-db`, porta 5433). Roda na porta 3001. |
| `ts/demo` | **Web**: Vite 7, React 19 e kit de UI Tailux. Roda na porta 5173. |
| `desktop/` | **Oracle Desktop**: Electron 45 com Postgres embutido e a API embutida. Ainda **não commitado**. |
| `desktop-agent/` | **Oracle Local Agent**: .NET 8, executa as ações no Windows. |
| `docs/` | Arquitetura do desktop, segurança (threat model, requisitos, achados, gates), voz e conectores Google. |
| `js/*`, `ts/starter` | Sobras do kit Tailux, não usadas. |

Conta demo: `demo@oracle.ai` (seed `seed-demo-conta.ts`).

## 3. Backend (`ts/api`)

### Pontos transversais

- **Autenticação**:
  - JWT stateless (Bearer), com `sub`, `email`, `empresaId` e `role`.
  - Senhas em bcrypt, com proteção contra timing attack.
  - Não há sessões no servidor.
- **Multi-tenant**: o tenant é `Empresa`. Todo service filtra por `empresaId` e devolve 404 para registros de outro tenant. Há escopos extras pelos headers `X-Repositorio-Id` e `X-Organizacao-Id`.
- **Autorização**:
  - `UserRole` (owner, admin ou membro) mais Roles com permissões granulares (`membros.*`, `repositorio.*`, `ia.*`, `desktop.*`, `conectores.*`…), checadas por `PermissoesGuard` e `@RequerPermissao`.
  - Roles de sistema: Owner, Admin, Editor, Viewer e Convidado.
- **Hardening**:
  - helmet, ValidationPipe com whitelist, throttler (100/min, com limites menores em login e ditado) e id de correlação;
  - CORS com lista de origens, qualquer porta de localhost em dev e a origem `oracle-app://app` do Desktop;
  - segredos (chaves de IA, tokens OAuth) em AES-256-GCM (`ENCRYPTION_KEY`).

### Módulos

| Módulo | Função |
|---|---|
| `auth`, `companies` | Login, cadastro (empresa, owner, roles e trial numa transação), convites e onboarding. |
| `acesso` | Catálogo de permissões, CRUD de Roles, minhas-permissões e transferência de owner. |
| `membros`, `estrutura` | Membros (gestor direto e indiretos, área, cargo, convidado), Áreas e Cargos. |
| `ai` | Núcleo de IA (detalhes abaixo). |
| `criacoes` | Workspace privado do AI Studio, com rascunho e autosave por usuário. |
| `conversas` | Histórico do Assistente e dos chats de squad. |
| `memorias` | Fatos e **diretrizes**, que são regras anexadas a todo system prompt. |
| `vault` | Índice das notas `.md` do repositório pessoal sincronizadas pelo cliente, com classificação por IA em categorias. |
| `repositorio-org` | Base de documentos da organização. Faz upload com extração de texto de PDF e DOCX; a IA só chega a ela por busca. |
| `insights` | Insights gerados de atas, documentos e repositório. Tem feedback 👍/👎, lidos e não lidos, e **direcionadores**, que definem o foco por organização ou área. |
| `perfil` | Perfil pessoal (formação, interesses, comunicação, objetivos), que alimenta o contexto da IA. |
| `briefing` | **Resumo Matinal**: agenda, Gmail, perfil, repositório, clima (Open-Meteo) e notícias (RSS), com cache diário. |
| `marcas`, `templates` | Guias de marca e templates de apresentação (PPTX/HTML), analisados e versionados. |
| `squads`, `agentes` | Catálogo de 15 squads com agentes especialistas (seed) e agentes personalizados, pessoais ou da organização, mencionáveis com @. |
| `conectores` | Catálogo de cerca de 70 conectores. Os reais estão abaixo. |
| `mcp` | Servidor MCP (Streamable HTTP) em `/mcp`, com chaves `bcl_mcp_…` guardadas em hash e ferramentas de conectores e Slack. |
| `uso` | Consumo de tokens em janelas de 1h, 24h, 7d e 30d. |
| `billing` | Trial de 14 dias e preço por módulo, plano e ciclo. **A Iugu não está integrada**: o checkout é simulado. |
| `orquestrador`, `desktop` | Ver seções 5 e 6. |

### IA (`ai`)

- **Provedores de texto**: Anthropic (Claude Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6, Haiku 4.5) e OpenAI (gpt-4o, gpt-4o-mini, gpt-4.1). A busca web usa a ferramenta nativa de cada provedor.
- **BYOK**: o usuário cadastra as próprias chaves.
  - As chaves são validadas e criptografadas, e nunca voltam ao cliente.
  - Há uma fila de prioridade de modelos por modalidade (texto, imagem, vídeo), com failover.
  - Se não houver chave cadastrada, a API usa a das variáveis de ambiente.
- **Endpoints principais**:
  - `ai/prompt`: Assistente "Pergunte ao seu Repositório", com modo Memória, Web ou Auto.
  - `ai/chat/stream`: chat de squad (SSE).
  - Geradores: `apresentacao/*` (pptxgenjs), `planilha/*` (exceljs), `analise`, `artigo`, `ata`, `carrossel`, `dashboard`, `documento`, `melhorar`, `transcricao` e `imagem` (OpenAI).
  - `video/*`: HeyGen.
  - `audio`: Whisper, resumo, salvamento na memória e geração de insights.
  - `audio/transcrever`: ditado do Desktop.
- **Em toda chamada**: diretrizes do tenant e perfil vão no system prompt, e o consumo fica registrado em `AiUsage`.

### Conectores reais (OAuth no backend, tokens criptografados, refresh automático)

- **Gmail e Outlook** (Microsoft Graph), **Google Calendar** e **Google Drive**, todos somente leitura. Usam PKCE e `state` assinado com HMAC. São conexões **pessoais**: só o dono lê.
- **Slack**: bot e token de usuário, como conexão da organização.
- **Telegram**:
  - Bot por long polling, vinculado por código de uso único.
  - Recebe texto e áudio; o áudio é transcrito pelo Whisper.
  - As mensagens ficam numa fila que o navegador drena e transforma em Notas.
- Os demais conectores só guardam ativação e credenciais.

### Banco (Prisma, 27 migrations)

| Área | Modelos |
|---|---|
| Tenant e pessoas | Empresa, Usuario, Convite, Membro, Role, MembroRole, Area, Cargo, Assinatura |
| IA | AiCredential, AiConnection, AiMediaConnection, AiUsage |
| Conhecimento | Memoria, VaultNota, VaultCategoria, RepositorioOrgDocumento, PerfilPessoal, Briefing |
| Squads e agentes | Squad*, AgenteUsuario |
| Insights | Insight*, com direcionamentos, feedback e leituras |
| Conversas e criações | Conversa, Mensagem, Criacao |
| Marca e templates | Marca, TemplateApresentacao |
| Integrações | EmpresaConector, McpApiKey |
| Orquestrador | Execucao, EtapaExecucao, AprovacaoAcao, RegistroAuditoria |
| Desktop | DispositivoDesktop, PareamentoDesktop, ComandoDesktop, NonceDesktop, PoliticaDesktop |
| Telegram | Telegram* |

## 4. Front-end (`ts/demo`)

Só o produto `oracle` está ativo. Os módulos de RH (Learning, Performance, Hiring, PM), Membros, Roles e Estrutura, Feed e Relatórios existem no código, mas estão **ocultos** por `configs/oracleModules.ts` e `temporarilyDisabledFeatures.ts`.

### Login e conta

- O login confere o "protótipo de contas", que fica no localStorage, e depois garante a sessão no backend: tenta `/login` e, se falhar, `/registrar`.
- Se a API estiver fora, entra em **modo local**, com um token falso.
- Tudo é escopado por conta (`escopoConta.ts`): os providers são remontados quando a conta muda.

### Navegação (sidebar)

- **Repositório**: seletor de contexto e Home.
- **Resumo Matinal**.
- **Painel**: Repositório, Insights, Notas, Email, Agenda e Google Drive.
- **AI Studio**: ferramentas e "Minhas criações".
- **Pasta local**.
- **Header**: PromptBar, notificações (insights não lidos), perfil e idioma.

### Funcionalidades

- **Repositório e Memória**:
  - O usuário escolhe uma **pasta local de notas `.md`**, acessada pela File System Access API; o handle fica no IndexedDB.
  - Há visão em Lista e em Grafo (force-directed, com wikilinks e tags); o Grafo está desligado no momento.
  - "Sincronizar" indexa as notas no backend (`/ai/vault`).
  - Cada ação de IA salva numa subpasta (Artigos, Reuniões, Imagens…).
  - Upload de documento, áudio ou transcrição, com sugestões depois do upload.
  - Importação do Google Drive e das Notas Autoadesivas do Windows (lê o `plum.sqlite` no navegador).
- **Notas**: assuntos e notas no localStorage, com "Gravar no Repositório" e ações de IA. Também há um Kanban To Do e uma biblioteca de Documentos no IndexedDB.
- **Insights**: lista por severidade, detalhe, 👍/👎, "conversar com o assistente" e ações mock. O Orientador (direcionadores) fica nas configurações do usuário.
- **Assistente**:
  - Bolinha e painel; chama `/ai/prompt` e o **orquestrador** (`/ai/orquestrar`, SSE com etapas e cards de aprovação).
  - Agentes entram por @menção, e as conversas são persistidas no backend.
  - A PromptBar tem fonte Auto, Memória ou Web, anexo, ditado, wake word e "pare tudo".
- **AI Studio / Lab** (`/oracle/ia/*`), com wizard em etapas e autosave em Criações:
  - ferramentas: Apresentação, Planilha, Análise de conteúdo, Artigo, Ata, Carrossel (HTML), Imagem, Dashboard (HTML) e Melhorar texto;
  - em modal: Vídeo (HeyGen) e Cortes de vídeo (ffmpeg.wasm no cliente);
  - o resultado pode ser salvo no Repositório.
- **Guia de marca**: marcas e templates no backend, consumidos pelo AI Studio. Fica em Configurações › Aparência.
- **Squads e Agentes**: catálogo, perfil do agente e agentes personalizados, pessoais ou da organização.
- **Conectores**: catálogo de cerca de 60 itens; os reais estão na seção 3.
  - Página Agenda: envia eventos ao Repositório.
  - Página Drive: explorador de importação.
  - Página Email: com fallback para uma caixa mock.
  - Telegram: código de vínculo e sincronização a cada 30 s, gerando Notas.
- **Configurações da organização**:
  - Aparência e Identidade visual.
  - Voz: wake word, resposta falada e escolha da voz.
  - Repositório da organização.
  - Oracle Desktop.
  - Regras: diretrizes da IA.
  - Agentes.
  - **IA & API**: BYOK e prioridade de modelos.
  - **Ambiente local**: pareamento e política do agente, parar, revogar e histórico.
  - O cartão de chaves MCP existe, mas não aparece na tela.
- **Configurações do usuário**: Perfil pessoal (salvo no backend e também como `.md`), Orientador, Conectores e Agentes.
- **Resumo Matinal**:
  - Briefing do dia, lido em voz alta por TTS do navegador e acionado por "Oracle, bom dia".
  - É possível pausar, perguntar sobre um item e continuar.
- **Voz**:
  - A wake word "Oracle" é reconhecida localmente (Vosk em WASM).
  - Depois vem o ditado pela Web Speech API; no Desktop, é gravação + Whisper.
- **i18n**: pt (padrão), en, es, ar e zh-cn. O tema padrão é escuro, com cor primária rose.

### Navegador vs backend

| Onde | O que fica |
|---|---|
| Só no navegador | Pasta e arquivos `.md`, notas, kanban, grupos, documentos locais, preferências de voz e aparência, contas do protótipo e toggles dos conectores mock. |
| No backend | Conta, regras, índice do vault, insights, conversas, criações, marcas, perfil, agentes, OAuth, Telegram, briefing, chaves de IA, pareamento do desktop e uso de tokens. |

## 5. Orquestrador do Assistente (`ts/api/src/orquestrador`, flag `ORQUESTRADOR_ATIVO`)

1. Detecta comandos de computador de forma determinística, **antes** do LLM. Pode responder direto, executar um comando direto ou planejar.
2. O **Roteador** (LLM, com saída validada por zod) escolhe entre resposta direta (memória ou web) e plano. Se falhar, cai na resposta direta.
3. No caminho de plano, a execução passa por:
   - **Planejador**;
   - **Executor**, um loop com ferramentas;
   - **Política** determinística;
   - **Revisor de segurança**, consultivo: só barra ou alerta, nunca autoriza;
   - **Auditoria**, só com inserções.
4. **Ferramentas**, por nível:
   - leitura: `buscar_memoria`, `buscar_web`, `abrir_pagina` (com proteção anti-SSRF), `listar_agentes`, `consultar_agente`, `ler_emails`, `ler_agenda`, `buscar_drive` e `ler_arquivo_drive`;
   - geração: `melhorar_texto`, `gerar_ata` e `gerar_artigo`;
   - escrita: `salvar_no_repositorio`;
   - as 13 `desktop_*`.
5. Escritas pausam a execução em `aguardando_aprovacao`, e o usuário aprova os parâmetros exatos. A execução sobrevive à desconexão do cliente.
6. O resultado de cada ferramenta volta embrulhado como dado e marca a execução como "contaminada", o que eleva o risco.

## 6. Controle do computador ("Ambiente local") — Fases 1–3 concluídas e aprovadas

- **Arquitetura**: web → API (gateway determinístico em `ts/api/src/desktop`) → **Oracle Local Agent** (.NET 8, roda como o usuário, sem admin e sem serviço, com ícone na bandeja).
- **Canal**:
  - O agente faz **long-poll HTTPS de saída**, sem porta aberta.
  - Há **assinatura ECDSA P-256** nos dois sentidos: a chave do agente fica na CNG, não exportável, e a do servidor é fixada no pareamento.
  - Proteção contra replay: nonce, validade de 60 s e id de comando de uso único.
- **Pareamento**:
  1. A tela gera um código de 8 caracteres, válido por 10 min, com até 5 tentativas.
  2. O usuário roda `oracle-agent pair CODIGO`.
  3. As impressões digitais são conferidas dos dois lados.
  4. O dispositivo nasce pendente até ser confirmado.
  - Revogar apaga a chave, e o agente para.
- **Operações**: são 12 operações tipadas, **sem shell**.
  - Listar processos, listar janelas e buscar arquivos.
  - Abrir app (por id opaco do inventário), abrir URL e abrir documento (com allowlist de extensões).
  - Organizar janelas, controlar mídia, criar pasta e mover arquivo (sem trocar a extensão).
  - Fechar app e energia (desligar com 30 s de aviso).
  - Não há leitura de conteúdo de arquivos nem captura de tela.
- **Política de risco**:
  - O risco é calculado em código e **só sobe**; o LLM não tem campo de risco.
  - Um pedido moderado vira alto quando a operação está marcada para sempre confirmar, quando a execução está contaminada, quando o pedido veio pela wake word ou quando a URL está fora da allowlist.
  - Alto exige aprovação de uso único, ligada ao hash da entrada e válida por 10 min.
  - **Comandos diretos** ("abrir X", mídia, janelas) são extraídos do texto de forma determinística e rodam sem aprovação, com limite de 1 a cada 3 s, botão Desfazer e checagem de hash no gateway.
  - Dupla checagem: o agente reaplica a política e tem listas fixas (LOLBins, processos protegidos) que o servidor não consegue afrouxar.
  - "Pare tudo" funciona no servidor e, offline, na bandeja.
  - A funcionalidade só é liberada com `DESKTOP_ATIVO=true` e sem achado crítico ou alto pendente em `docs/security/achados.md`.
- **Fases 4–6 (planejadas)**: mouse e teclado, captura de tela, wake word no agente e reautenticação para aprovar risco alto.

## 7. Oracle Desktop (Electron, `desktop/`) — trabalho atual, não commitado

- **Shell**:
  - O app é servido pelo esquema `oracle-app://app`, com CSP, `contextIsolation` + `sandbox` e navegação presa à origem.
  - O preload expõe `window.oracleDesktop`.
- **Sessão**: o JWT é cifrado com `safeStorage`/DPAPI, e o IPC é validado por remetente.
- **Backend embutido**: Postgres 16 e a API, ambos só em `127.0.0.1`. Os segredos ficam em `backend.bin`, e há importação do ambiente Docker.
- **Integrações**:
  - OAuth pelo navegador do sistema, com volta pelo deep link `oracle-desktop://conectores` (`?origem=desktop` no state).
  - Microfone liberado, câmera não; o ditado é gravação + Whisper.
  - Prévias de HTML abrem em janela isolada.
  - Migração única dos dados do navegador (localStorage + IndexedDB) por arquivo JSON.
- **Recursos de desktop**:
  - Bandeja, atalho `Ctrl+Alt+O`, iniciar com o Windows e notificações.
  - Supervisão do Local Agent, que é iniciado e monitorado sem IPC.
- **Empacotamento**: electron-builder (NSIS x64) e electron-updater via GitHub Releases. Já existe `Oracle-Setup-0.1.0.exe` gerado. A Fase 6 ainda não está documentada.
- **Testes**: 30 testes de segurança.
- **Pendências**:
  - OAuth real ponta a ponta sem teste.
  - Telegram com o mesmo token em dois lugares.
  - Persistência do FS Access sem teste.
  - Pacote da API com cerca de 540 MB.
  - Fuses e `RUN_AS_NODE`.
  - A API na 3001 não autentica o Electron; a proposta é um desafio HMAC.

## 8. Segurança: processo e estado

- Há documentos de threat model (componentes C1–C7, ameaças T*), requisitos SR-01…SR-51, achados e **gates de revisão independentes** (agente `security-engineer`).

| Gate | Resultado |
|---|---|
| Gate A (arquitetura) | Reprovado na r1, aprovado na r2 |
| Gate B (código das Fases 1–3) | Reprovado na r1, aprovado na r2 (jest 261 testes, dotnet 72) |
| Comandos diretos | Aprovado com ressalvas, já corrigidas |
| Oracle Desktop | Reprovado na r1, aprovado na r2 em 2026-11-18 |

- **Não há achado crítico nem alto em aberto.** Ficam abertos alguns achados INFO/BAIXA:
  - corpo grande devolve 500 em vez de 413;
  - dependências a revisar antes de expor a API fora do localhost;
  - autenticação HMAC Electron↔API;
  - fuses.
- **Riscos aceitos**:
  - JWT roubado age dentro do que já foi autorizado;
  - áudio de terceiros pode abrir um app permitido;
  - malware rodando como o mesmo usuário.

## 9. O que é mock, simulado ou desligado

- Cobrança (Iugu simulada).
- Cerca de 60 conectores, que são só toggles; os reais são Gmail, Outlook, Calendar, Drive, Slack e Telegram.
- Ações dos insights (tarefa, reunião).
- Confirmação de e-mail no cadastro.
- Telas ocultas por flag: Grafo, Grupos, Membros/Roles/Estrutura, Feed, Relatórios, Slack, uso de tokens e edição de notas.

## 10. Como rodar (local)

- API: `cd ts/api`, depois `npm run db:up`, `npx prisma migrate dev`, `npm run db:seed && npm run db:seed:demo` e `npm run start:dev`.
- Web: `cd ts/demo` e `npm run dev`. Há também o `dev.cmd` na raiz.
- Agente: `desktop-agent` (dotnet), com `oracle-agent pair CODIGO --api http://localhost:3001`.
- Variáveis principais (nomes):
  - base: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`;
  - IA: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`;
  - OAuth: `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_*`, `SLACK_*`;
  - Telegram: `TELEGRAM_BOT_TOKEN`;
  - flags: `ORQUESTRADOR_ATIVO`, `DESKTOP_ATIVO`.
