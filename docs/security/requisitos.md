# Requisitos de segurança: controle do computador

Cada requisito tem um ID estável, referenciado no [threat model](threat-model.md), no código (comentários `SR-xx`) e nos testes. **Verificação** diz como o gate confere o requisito.

## Autorização e política

| ID | Requisito | Verificação |
|---|---|---|
| SR-01 | Toda operação desktop é autorizada por código determinístico (servidor + agente), nunca pelo LLM ou pelo revisor consultivo. O executor consulta a política, e o gateway consulta de novo antes de enfileirar. | teste: chamada sem passar pela política é negada no gateway |
| SR-02 | Permissões por categoria (`apps`, `processos`, `janelas`, `arquivos_busca`, `documentos`, `arquivos_escrita`, `navegador`, `midia`, `energia`) vêm desligadas por padrão. | teste: política nova nega tudo |
| SR-03 | O risco (`baixo`, `moderado`, `alto`, `bloqueado`) é função pura de (operação, parâmetros, política) e só pode subir em relação ao risco base. O modelo não fornece o risco. | teste de propriedade: para qualquer entrada, risco ≥ base |
| SR-04 | Risco moderado roda sem confirmação só se a categoria estiver ligada **e** a operação não estiver em "pedir confirmação". | teste |
| SR-05 | Risco alto sempre exige aprovação humana por operação; nenhuma configuração desliga isso. O gateway exige uma `AprovacaoAcao` aprovada, não expirada, da mesma execução, mesma ferramenta e mesmo hash de entrada. | teste: alto sem aprovação → negado |
| SR-06 | **(rev. GA-01)** Uma operação moderada só roda sem confirmação se a execução estiver **limpa**: nenhuma etapa `concluida` da execução, lida **do banco** pelo gateway (sem confiar no contexto), foi de ferramenta fora da allowlist `FERRAMENTAS_LIMPAS` (operações desktop que devolvem só status: abrir app, mídia, janelas, criar pasta). Qualquer outra ferramenta, incluindo `buscar_memoria`, `consultar_agente`, `desktop_buscar_arquivos` e `desktop_listar_*`, contamina, e nesse caso moderado vira alto. | jest `desktop-politica.spec: contaminacao_*` |
| SR-06a | `desktop_abrir_url` é alta, a menos que o host esteja na allowlist de domínios do dono (rev. GA-16: compara o host IDN/punycode em minúsculas, sem ponto final e sem porta, por rótulos: igual ao domínio ou terminando em `.` + domínio; `evil-exemplo.com` e `exemplo.com.evil.com` não casam com `exemplo.com`). Isso fecha a exfiltração pela query string. | jest `risco.spec: url_*` |
| SR-06c | **(GA-14)** `Execucao.contextoExterno` é calculado pelo servidor ao criar a execução: verdadeiro se houver `referencia` ou qualquer turno anterior no histórico. O gateway lê esse campo junto com as etapas; se for verdadeiro, a execução não está limpa. | jest `contaminacao_referencia`, `contaminacao_historico` |
| SR-06d | **Comando direto do usuário (decisão do dono, 2026-11-13).** Um comando reconhecido pelo parser determinístico (`desktop/intencao.ts`, sem LLM) roda como **comando direto**: plano fixo, primeira chamada sintetizada pelo executor, sem histórico nem referências no contexto. Ele só vale se o **gateway** conferir no banco que (a) a etapa é a 1ª da execução e tem `tipo = comando_direto` e (b) reaplicar o parser ao `Execucao.pedido` gravado produz exatamente a mesma ferramenta e o mesmo hash de entrada. Nessa condição, **abrir app, mídia e janelas** com alvo autorizado não sobem para alto por contaminação nem por voz. A lista "pedir confirmação" do dono continua valendo. Fechar, energia, mover/sobrescrever, sites fora da allowlist e `.doc/.xls/.ppt/.svg` continuam exigindo aprovação. Por voz: no máximo 1 comando direto a cada 3 s; um segundo volta a pedir aprovação. **Desfazer:** só o app aberto por comando direto da mesma execução, até 2 min, uma única vez (`ComandoDesktop.desfazDe @unique`); o clique autenticado do dono é a autorização. | jest `SR-06d: comando direto…`, `Desfazer (SR-06d)`, `intencao.spec`, `comandos.service.spec`, `primeiraChamada` |
| SR-06b | **(GA-10)** Pedidos que chegam pela wake word (`origem: 'voz_ativacao'`) tratam o moderado como alto. Digitar ou ditar pelo botão de microfone mantém a regra normal. | jest `desktop-politica.spec: voz_*` |
| SR-07 | **(rev. GA-03)** `ContextoFerramenta.execucao = {id, etapaId, aprovacaoId?}` é preenchido **só pelo executor**, e os esquemas zod das ferramentas desktop são `.strict()`, sem esses campos. Para risco alto, o gateway confere numa transação: aprovação `aprovada`, mesma empresa, solicitante, execução, etapa e ferramenta, `expiraEm > agora`, `hashEntrada == hash(entrada validada)` e `risco aprovado ≥ risco atual`. `ComandoDesktop.aprovacaoId` é `@unique`, então cada aprovação é consumida uma vez. Para ferramentas desktop, a aprovação vale **10 minutos**. | jest `gateway.spec: aprovacao_*` |
| SR-09 | **(GA-04)** (a) O gateway é o único caminho até o agente: `FerramentasDesktop` só recebe o `GatewayDesktopService`, e nenhum outro código cria `ComandoDesktop`. (b) O risco é calculado sobre a entrada **validada** pelo zod, e é exatamente ela que vai no comando. (c) A auditoria obrigatória `desktop.comando.enviado` e o insert do `ComandoDesktop` acontecem na **mesma transação**, com etapaId. (d) Para `desktop_*`, o executor grava em `EtapaExecucao.entrada` e na auditoria só a versão redigida (`redigir()`). | jest `gateway.spec: transacao_*`, `executor desktop redige` |
| SR-08 | Operações bloqueadas são negadas sempre, mesmo com a categoria ligada. | teste |

## Execução local

| ID | Requisito | Verificação |
|---|---|---|
| SR-10 | Não existe operação de shell ou script. O agente nunca chama cmd, PowerShell, wscript ou mshta, nem monta linha de comando a partir de texto do modelo. | revisão de código + grep |
| SR-11 | Aplicativos são abertos só por id do inventário local do agente (atalhos do Menu Iniciar). O caminho do executável nunca vem da rede. | teste xUnit |
| SR-11a | **(GA-09)** No inventário, o alvo de cada `.lnk` é resolvido (IShellLink). Atalhos com argumentos, com alvo fora de `.exe` ou com alvo na lista do SR-12 ficam fora. O caminho do alvo aparece na UI e no resumo da aprovação; só o agente o usa para executar. | xUnit `InventarioTests` |
| SR-12a | **(rev. GA-02)** `abrir_documento` aceita só uma **allowlist** de extensões: `.pdf .txt .md .rtf .csv .doc .docx .xls .xlsx .ppt .pptx .odt .ods .odp .png .jpg .jpeg .gif .webp .bmp .mp3 .wav .m4a .mp4 .mov .fig .psd .ai .zip`. `.doc .xls .ppt .svg` (rev. GA-17) são de risco **alto**. Qualquer outra é **bloqueada**. `mover_arquivo` não pode mudar a extensão. | xUnit `CaminhosTests`, jest `risco.spec` |
| SR-12 | Lista de bloqueio no binário: executáveis e scripts como documento (`.exe .bat .cmd .ps1 .vbs .js .msi .lnk .scr .com .hta .reg …`), LOLBins como app (`cmd powershell pwsh wscript cscript mshta rundll32 regsvr32 reg regedit bcdedit vssadmin schtasks sc net certutil bitsadmin msiexec …`) e processos protegidos em fechar (`csrss lsass winlogon services smss wininit svchost MsMpEng explorer` e o próprio agente). | teste xUnit |
| SR-13 | Caminhos: canonicalizar (`GetFullPath`); recusar UNC (`\\`), `\\?\`, ADS (`:` fora de `X:\`), nomes reservados (CON, NUL, COM1…), componentes `..` e reparse points (symlink/junction) no caminho; exigir prefixo de um diretório autorizado (comparação sem diferenciar maiúsculas, com separador final). Diretórios autorizados não podem ser de sistema (`Windows`, `Program Files*`, `ProgramData`, `AppData`, `.ssh`, raiz de unidade). | teste xUnit + teste jest (pré-checagem no servidor) |
| SR-14 | O agente roda como usuário comum, sem pedir elevação; não altera registro (exceto a sua entrada em `HKCU\…\Run`, e só por configuração explícita), serviços, Defender, firewall ou UAC. | revisão + manifesto `asInvoker` |
| SR-15 | Fases 1–3 não leem conteúdo de arquivos; a busca devolve só nome, caminho relativo ao diretório autorizado, tamanho e data. | revisão |
| SR-16 | Títulos de janela só são devolvidos para apps marcados como observáveis; nos demais, só o nome do processo. | teste |
| SR-17 | Fechar app usa `CloseMainWindow` (sem `Kill`). Desligar e reiniciar usam aviso de 30s e podem ser abortados pela bandeja. | revisão |

## Canal e identidade

| ID | Requisito | Verificação |
|---|---|---|
| SR-20 | Comandos servidor→agente são `payload` (bytes JSON em base64) + assinatura ECDSA P-256/SHA-256 (formato IEEE P1363) com a chave do servidor. O agente fixa a chave pública do servidor no pareamento e verifica os bytes exatos antes de interpretar. | teste xUnit + jest |
| SR-21 | Cada comando tem `id`, `nonce` e `expiraEm` (≤ 60s). O agente guarda os ids/nonces vistos até expirar e rejeita repetidos ou expirados. O servidor marca o comando como entregue uma única vez. | teste |
| SR-22 | Requisições agente→servidor são assinadas com a chave CNG não exportável do dispositivo sobre `MÉTODO\nCAMINHO\nTIMESTAMP\nNONCE\nSHA256(corpo)`; janela de ±60s; nonce único por dispositivo. | teste jest |
| SR-23 | Código de pareamento: 8 caracteres de um alfabeto de 32 símbolos sem ambíguos, guardado em SHA-256, vale 10 min, uso único, máximo de 5 tentativas, `@Throttle` por IP. | teste |
| SR-24 | Fora de loopback, o agente recusa `http://`. Nenhuma porta é aberta no computador; a conexão é sempre de saída. | teste xUnit + revisão |
| SR-26 | **(GA-05)** As rotas `/desktop/agente/*` usam o corpo cru (`json({verify})` guarda `rawBody`) com limite de **64 KB**. A assinatura cobre o caminho **com a query string**. | jest `assinatura.spec` |
| SR-27 | **(GA-06)** Os bytes assinados pelo servidor incluem `tipo` (`comando` ou `politica`), `dispositivoId` e `versaoPolitica`. O agente rejeita outro dispositivo, outro tipo no canal errado ou uma política com versão menor que a atual. | xUnit `CanalTests` |
| SR-28 | **(GA-07)** No pareamento, o agente mostra a impressão digital (SHA-256, 16 hex) da chave do servidor e pede confirmação local. O dispositivo nasce `pendente` e só fica `conectado` quando o dono confere a impressão digital do **dispositivo**, exibida no agente, na UI. | jest `pareamento.spec`, E2E |
| SR-29 | **(GA-08)** Sem resultado até o timeout, a ferramenta devolve "estado desconhecido: não repita, peça ao usuário para conferir", e o comando vira `expirado`. O agente não inicia comando com `expiraEm` vencido nem emitido antes da sua própria inicialização. No boot da API, comandos `pendente` ou `entregue` viram `interrompido` e nunca são reenviados. | jest + xUnit |
| SR-25 | A chave privada do servidor vem de `DESKTOP_CHAVE_PRIVADA` (PKCS#8 PEM em base64) ou de um arquivo gerado no primeiro uso (`ts/api/.desktop/servidor.pem`, no gitignore). Nunca vai para o banco, para os logs ou para a auditoria. | revisão |

## Disponibilidade, parada e revogação

| ID | Requisito | Verificação |
|---|---|---|
| SR-30 | Fail-closed: agente offline (sem contato há mais de 60s), bloqueado, revogado ou com versão incompatível, política ilegível ou falha ao gravar a auditoria obrigatória → operação negada. | teste |
| SR-31 | "Parar tudo" (UI, voz ou bandeja) bloqueia o dispositivo, cancela os comandos pendentes e as execuções abertas, e o agente aborta. Só o dono retoma, pela UI ou pela bandeja. | teste + E2E |
| SR-32 | Revogar remove a chave pública; qualquer requisição do agente recebe 401 e o agente apaga a chave local. | teste |
| SR-33 | Até 30 comandos por minuto por dispositivo; até 200 resultados na busca; até 50 itens por operação de arquivo; timeout de 30s por comando. | teste |
| SR-35 | **(GA-11)** Política local independente: o agente só aplica **ampliações** depois da confirmação do usuário **na bandeja do próprio computador**. (rev. GA-15) Ampliação é **qualquer** mudança que reduza o risco ou aumente o alcance ou a observação: novo diretório, app, domínio, app observável, categoria ligada, operação retirada de "pedir confirmação" ou autoinicialização ligada, incluindo a política inicial do pareamento. A bandeja mostra o diff exato. Restrições valem na hora. Assim, um JWT roubado não amplia o alcance sozinho. | xUnit `PoliticaLocalTests` |
| SR-36 | **(GA-13)** O banco é a fonte da verdade para comandos e nonces (`@@unique([dispositivoId, nonce])`). `DESKTOP_ATIVO` é ignorado (sempre falso) quando `process.env.VERCEL` está definido. | jest |
| SR-37 | **(GA-12)** URLs: `Uri` absoluta, esquema `http` ou `https`, sem credenciais (`user@`), sem espaço, aspas ou caracteres de controle, até 2.048 caracteres. A URL é passada ao ShellExecute já normalizada (`AbsoluteUri`). | xUnit + jest |
| SR-34 | Rotas de configuração exigem JWT + `desktop.configurar`; as de uso exigem `desktop.usar`; tudo é escopado por empresa + usuário, com 404 para recursos de outros. | teste |

## Auditoria e privacidade

| ID | Requisito | Verificação |
|---|---|---|
| SR-40 | Auditoria obrigatória antes de enviar qualquer comando que não seja de leitura (`desktop.comando.enviado`), além de resultado, rejeição, pareamento, revogação e parada. Caminhos aparecem como nome + hash do caminho completo; sem conteúdo nem chaves. | teste |
| SR-41 | Capturas de tela e monitoramento contínuo não existem nas Fases 1–3. | revisão |

## Processo

| ID | Requisito | Verificação |
|---|---|---|
| SR-50 | O agente não usa pacotes NuGet de terceiros (só o SDK); `npm audit` da API e da web não pode ter achados altos ou críticos novos. | gate |
| SR-51 | `DESKTOP_ATIVO` só registra as ferramentas se `docs/security/achados.md` não tiver achados críticos ou altos `ABERTO`. Um teste falha caso contrário. | teste jest |
