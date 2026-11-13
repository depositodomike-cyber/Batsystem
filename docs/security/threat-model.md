# Threat Model: controle do computador pelo Oracle

Versão 1 (Fase 1a), 2026-11-12. Método: STRIDE por fronteira de confiança. Requisitos em [requisitos.md](requisitos.md), achados em [achados.md](achados.md).

## 1. Escopo e componentes

| # | Componente | Onde roda | Confiança |
|---|---|---|---|
| C1 | Interface (chat, voz, Configurações) | navegador do dono | autenticada por JWT |
| C2 | Orquestrador (roteador, planejador, executor, LLM) | API NestJS | **o LLM não é confiável** |
| C3 | Runtime Security Layer (política desktop, risco, gateway) | API NestJS | confiável, determinística |
| C4 | Banco (dispositivos, comandos, nonces, política, auditoria) | Postgres | confiável |
| C5 | Oracle Local Agent | Windows, processo do usuário | confiável até a fronteira do binário |
| C6 | Desktop Automation Layer | dentro do C5 | executa só operações tipadas |
| C7 | Conteúdo externo (e-mail, páginas, documentos, nomes de arquivos, títulos de janelas) | — | **não confiável** |

Fronteiras de confiança: B1 navegador↔API · B2 LLM↔política (o texto do modelo atravessa uma fronteira) · B3 API↔agente (rede) · B4 agente↔sistema operacional · B5 conteúdo externo↔modelo.

## 2. Ativos

- A1. Arquivos e aplicativos do usuário (integridade e confidencialidade).
- A2. Sessão do Windows (disponibilidade: desligar e fechar apps).
- A3. Chave privada do dispositivo (identidade do agente).
- A4. Chave privada do servidor (autoridade de comando).
- A5. Política desktop (o que está autorizado).
- A6. Trilha de auditoria (não repúdio).
- A7. Aprovações do dono (autorização humana).
- A8. Proteções nativas do Windows (UAC, Defender, ACLs).

## 3. Pontos de entrada

- E1. `POST /ai/orquestrar` (pedido do usuário → LLM → chamadas de ferramenta).
- E2. `POST /ai/aprovacoes/:id/decisao` (aprovação humana).
- E3. Rotas JWT de configuração `/desktop/*` (pareamento, política, parar, revogar).
- E4. Rotas do agente `/desktop/agente/*` (pareamento, poll, resultado), sem JWT.
- E5. Arquivo de configuração e chaves do agente em `%LOCALAPPDATA%\Oracle\`.
- E6. Bandeja do agente (Parar tudo, Retomar).
- E7. Conteúdo lido por ferramentas (C7) que volta para o contexto do LLM.
- E8. **(GA-10)** Voz: a wake word "Oracle" no navegador e o ditado. Áudio de terceiros (um vídeo, uma chamada) pode soar como um pedido.

## 4. Ameaças (STRIDE) e mitigações

| ID | Ameaça | STRIDE | Fronteira | Mitigação (requisito) | Residual |
|---|---|---|---|---|---|
| T01 | Prompt injection num e-mail, página ou documento manda o modelo executar algo no PC | E | B5/B2 | Política determinística fora do LLM (SR-01); risco fixo que só sobe (SR-03); ação de risco alto exige aprovação humana por operação (SR-05); dado externo na execução sobe moderado para alto (SR-06) | Baixo: o dono ainda pode aprovar algo malicioso; o resumo da aprovação mostra os parâmetros exatos |
| T02 | O modelo escolhe um caminho ou executável arbitrário (`cmd.exe /c …`) | E/T | B2/B4 | Não há operação de shell (SR-10); apps só por id do inventário local, e o agente resolve o caminho (SR-11); executáveis e LOLBins bloqueados no binário (SR-12) | Baixo |
| T03 | Path traversal, symlink/junction, UNC, ADS ou nomes de dispositivo para sair dos diretórios autorizados | T/I | B4 | Canonicalização e checagem de prefixo nos dois lados; recusa de reparse points; recusa de UNC, `:` fora da unidade e nomes reservados (SR-13) | Baixo; há uma janela TOCTOU entre a checagem e o uso, mitigada pela recusa de reparse points no momento de abrir |
| T04 | Atacante na rede forja comandos para o agente | S/T | B3 | Todo comando assinado com ECDSA P-256 pela chave do servidor, fixada no pareamento (SR-20); TLS fora de loopback (SR-24) | Baixo |
| T05 | Replay de um comando ou requisição capturada | T | B3 | Nonce único + expiração de 60s + id do comando de uso único nos dois lados (SR-21) | Baixo |
| T06 | Outra máquina se passa pelo agente (rouba resultados ou injeta resultados falsos) | S | B3/E4 | Requisição do agente assinada com chave não exportável (CNG) (SR-22); o código de pareamento é de uso único, guardado em hash, vale 10 min e tem limite de tentativas (SR-23) | Baixo |
| T07 | Força bruta no código de pareamento | S | E4 | 8 caracteres de um alfabeto de 32 (40 bits), 10 min, 5 tentativas por código, throttle por IP (SR-23) | Baixo |
| T08 | Bypass da aprovação: o executor roda uma ação alta sem aprovação (bug, retomada, outro caminho de código) | E | C2→C3 | O gateway exige, para risco alto, uma `AprovacaoAcao` aprovada, não expirada, da mesma execução, com o hash da entrada e consumida uma única vez (SR-05, SR-07) | Baixo |
| T09 | O LLM rebaixa o risco ("isto é só uma leitura") | E | B2 | Risco calculado em código a partir de operação + parâmetros; o modelo não tem campo de risco (SR-03) | Nenhum |
| T10 | A camada de segurança ou o banco fica indisponível e o agente executa assim mesmo | E | C3/C5 | Fail-closed: o agente só executa um comando assinado e válido; o gateway nega se política, dispositivo ou auditoria falharem (SR-30) | Baixo |
| T11 | O agente segue executando depois de "pare tudo" | D | E6/E3 | Estado `bloqueado` no servidor + cancelamento das execuções + o agente aborta e rejeita até ser retomado; parada local na bandeja funciona offline (SR-31) | Baixo; uma operação atômica já iniciada (por exemplo mover um arquivo) termina |
| T12 | Dispositivo revogado continua aceitando comandos | E | B3 | Revogar apaga a chave pública no servidor; o agente recebe 401, apaga a chave local e para (SR-32) | Baixo |
| T13 | A auditoria vaza dados sensíveis (caminhos completos, conteúdo) | I | C4 | Caminhos reduzidos (nome + hash), sem conteúdo de arquivo, sem chaves; retenção configurável (SR-40) | Baixo |
| T14 | Escalonamento de privilégio pelo agente | E | B4 | Roda como usuário comum, sem serviço SYSTEM e sem `runas`; não mexe em registro (fora do HKCU Run da autoinicialização), serviços, Defender ou UAC (SR-14) | Baixo |
| T15 | DoS: o modelo dispara centenas de operações | D | B2/B3 | Limite de taxa por dispositivo, teto de itens por operação, limites do executor (SR-33) | Baixo |
| T16 | Configuração local adulterada (trocar a URL ou a chave fixada do servidor) | T | E5 | O arquivo fica no perfil do usuário com ACL só do usuário. Malware rodando como o mesmo usuário está **fora de escopo**: ele já teria os mesmos privilégios que o agente | Aceito |
| T17 | Exfiltração: o modelo lê arquivos e manda o conteúdo para fora | I | B2 | Fase 1–3 não lê conteúdo de arquivos (só nome, tamanho e data); a busca vale só nos diretórios autorizados (SR-15) | Baixo |
| T18 | Títulos de janelas e nomes de arquivos como vetor de injeção | T | B5 | Resultados embrulhados como dados (`embrulharResultado`); títulos só de apps "observáveis"; o resultado desktop marca a execução como tendo dado externo (SR-06, SR-16) | Baixo |
| T19 | CSRF ou abuso das rotas de configuração | S/T | E3 | JWT Bearer (não cookie), permissão `desktop.configurar`, escopo empresa + usuário (SR-34) | Baixo |
| T20 | O modelo descobre e chama uma ferramenta desktop que não foi oferecida | E | B2 | O executor reconfere a política em toda chamada; o gateway reconfere de novo (SR-01) | Nenhum |
| T21 | Dependência vulnerável | — | — | Zero pacote NuGet de terceiros no agente; `npm audit` no gate (SR-50) | Baixo |
| T23 | **(GA-01)** Injeção vinda do próprio Repositório ou de um especialista (`buscar_memoria`, `consultar_agente`) leva a `abrir_url` com dados na query string (exfiltração) | E/I | B5 | Contaminação calculada no banco com a allowlist de ferramentas limpas (SR-06); URL fora da allowlist de domínios é alta (SR-06a) | Baixo |
| T24 | **(GA-07)** Pareamento TOFU: o usuário é induzido a parear o agente com um servidor do atacante, ou um atacante pareia o próprio dispositivo na conta | S | B3 | Impressões digitais mostradas e confirmadas dos dois lados; o dispositivo nasce `pendente` (SR-28) | Baixo |
| T25 | **(GA-11)** JWT do dono roubado: o atacante amplia a política e manda o agente agir | E | B1 | Ampliações exigem confirmação local na bandeja (SR-35); risco alto sempre aprovado por operação; a lista de bloqueio do binário não pode ser alterada | Médio: dentro do que já estava autorizado, o atacante age como o dono. Reautenticação para aprovar risco alto fica para a Fase 4 |
| T26 | **(GA-10)** Áudio de terceiros dispara a wake word e pede uma ação | S | E8 | Pela wake word, o moderado vira alto (SR-06b) | Baixo |
| T26b | **(revisão de T26, 2026-11-13)** Com o SR-06d, "Oracle, abrir X" dito por áudio de terceiros abre um app autorizado sem clique | S | E8 | Só apps, mídia e janelas já autorizados (reversíveis); no máximo 1 a cada 3 s; "Desfazer" fecha na hora; o Oracle anuncia a ação; a auditoria registra. Fechar, energia, arquivos e sites seguem com aprovação | Aceito pelo dono: o custo é abrir um app permitido |
| T28 | O modelo ou um conteúdo externo tenta se passar por comando direto (forjar `tipo = comando_direto` ou os parâmetros) | E | B2 | A marcação vem só do executor (1ª chamada sintetizada); o gateway reaplica o parser ao texto gravado do usuário e compara o hash da entrada. Uma chamada do modelo nunca é a etapa de ordem 1 `comando_direto` | Baixo |
| T27 | **(GA-08)** Timeout ou queda: o modelo repete uma ação que talvez já tenha acontecido | T | B3 | "Estado desconhecido, não repita"; o agente não inicia comando vencido; comandos pendentes viram `interrompido` no boot (SR-29) | Baixo |
| T22 | Desligar ou fechar o app com trabalho não salvo | D | B4 | Risco alto (aprovação por operação); fechar apps usa `CloseMainWindow` (sem kill); desligar dá 30s de aviso e pode ser abortado (SR-17) | Baixo |

## 5. Fora de escopo (explícito)

- Malware rodando como o mesmo usuário do Windows (tem os mesmos poderes que o agente).
- Comprometimento da conta do dono (JWT roubado): **reavaliado (GA-11)**, ver T25. O impacto fica limitado ao que o computador já autorizou localmente.
- Fases 4–6 (mouse/teclado, captura de tela, wake word no agente): terão threat model próprio.

## 6. Decisões de arquitetura que saem deste modelo

1. **ECDSA P-256 (SHA-256) em vez de Ed25519:** o .NET 8 não tem Ed25519 nativo, e P-256 existe no `node:crypto` e no .NET sem pacote de terceiros (T21).
2. **A chave do agente é uma CNG não exportável** no repositório de chaves do usuário. Não fica num arquivo, nem num blob DPAPI (T06).
3. **O inventário de aplicativos é do agente:** o servidor só conhece ids opacos. O caminho do executável nunca viaja pela rede nem passa pelo modelo (T02).
4. **O comando viaja como bytes assinados** (`payload` em base64 + assinatura). O agente verifica os bytes exatos antes de interpretar o JSON (T04).
5. **Dupla checagem:** a política roda no servidor (gateway) e de novo no agente, com uma lista de bloqueio no binário que o servidor não consegue afrouxar.
