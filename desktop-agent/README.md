# Oracle Local Agent

O Oracle Local Agent é o processo local do Windows que executa as ações que o Oracle pede no computador do usuário.

- A conversa continua no Oracle (chat e voz). Este agente não tem interface de chat; tem só um ícone na bandeja.
- A configuração fica em **Configurações > Organização > Ambiente local**.

Segurança: veja `docs/security/` (threat model, requisitos SR-xx, achados e pareceres dos gates).

## Como funciona

- **Conexão:** a conexão é sempre de saída (long-poll HTTPS para a API). Nenhuma porta é aberta neste computador.
- **Identidade:** a identidade do dispositivo é uma chave ECDSA P-256 no repositório CNG do usuário, não exportável.
  - Toda requisição sai assinada.
  - Todo comando do servidor chega assinado.
  - O agente verifica os bytes antes de interpretar o comando.
- **Execução:** só operações tipadas (abrir/fechar app autorizado, janelas, URLs, documentos, pastas, mídia, energia). Nunca shell.
- **Política local independente:** o que vale aqui é a interseção entre o que o servidor manda e o que **você confirmou neste computador**.
  - Ampliações esperam a bandeja (ou `oracle-agent permissoes`).
  - Restrições valem na hora.
- **Listas fixas no binário:** LOLBins, processos protegidos e extensões. O servidor não consegue afrouxá-las.
- **Privilégios:** roda como o usuário (`asInvoker`), sem administrador e sem serviço.

## Compilar e testar

Exige o .NET 8 SDK.

```bash
dotnet build desktop-agent/src/OracleAgent/OracleAgent.csproj -c Release
```

```bash
dotnet test desktop-agent/tests/OracleAgent.Tests
```

O executável fica em `desktop-agent/src/OracleAgent/bin/Release/net8.0-windows10.0.19041.0/oracle-agent.exe`.

## Usar

1. Em Configurações > Ambiente local, clique em **Conectar um computador**. A tela mostra o código e a impressão digital do servidor.
2. No computador, rode o comando abaixo. Confira a impressão do servidor e responda `s`.
   ```bash
   oracle-agent pair CODIGO --api http://localhost:3001
   ```
3. De volta na tela, digite a impressão **deste computador** e clique em **Confirmar computador**.
4. Libere as permissões e autorize apps, pastas e domínios na tela.
5. Confirme as ampliações neste computador. Pode ser pelo comando abaixo, com o agente parado, ou pela bandeja, com ele rodando.
   ```bash
   oracle-agent permissoes
   ```
6. Inicie o agente. A partir daí, peça no Oracle: "abra o Figma", "organize minhas janelas", "pare tudo".
   ```bash
   oracle-agent run
   ```

Outros comandos:

- `oracle-agent status`
- `oracle-agent unpair`: apaga a chave local. Revogue também na tela.

A flag `DESKTOP_ATIVO=true` na API só tem efeito quando `docs/security/achados.md` não tem achado crítico ou alto pendente (SR-51).
