# Conectores Google (Gmail, Calendar, Drive)

O Oracle lê seus e-mails, sua agenda e seus arquivos do Google **somente para
leitura**, e você escolhe o que salvar no Repositório. Nada é enviado, criado,
alterado ou apagado na sua conta Google.

## Como a integração é segura

| Proteção | O que significa |
|---|---|
| **OAuth 2.0** | Você faz login e autoriza **na página do próprio Google**. O Oracle nunca vê sua senha. |
| **Menor privilégio** | Só permissões de leitura: `gmail.readonly`, `calendar.readonly`, `drive.readonly`. |
| **PKCE** | Mesmo que alguém intercepte o código de autorização no redirecionamento, não consegue trocá-lo por acesso. |
| **`state` assinado** | O retorno do Google só é aceito se veio de um "Conectar" feito por você, nos últimos 10 minutos (proteção contra CSRF). |
| **Tokens cifrados** | As chaves de acesso ficam no banco cifradas (AES-256-GCM, com a `ENCRYPTION_KEY`). Nunca vão para o navegador nem para logs. |
| **Segredo só no servidor** | O Client Secret fica em `ts/api/.env`, fora do git. O navegador só recebe a URL de consentimento. |
| **Revogação** | Ao desconectar o último conector Google, o Oracle revoga o acesso no Google (ele some de myaccount.google.com/permissions). |

## Configuração (uma vez, ~15 minutos)

### 1. Projeto e APIs
1. Abra <https://console.cloud.google.com/> e crie um projeto (ex.: "Oracle").
2. Em **APIs e serviços → Biblioteca**, ative: **Gmail API**, **Google Calendar
   API** e **Google Drive API**.

### 2. Tela de consentimento (OAuth consent screen)
1. **APIs e serviços → Tela de consentimento OAuth** (ou "Google Auth Platform").
2. Tipo de usuário: **Externo**. Nome do app: "Oracle". E-mails de contato: o seu.
3. **Escopos**: adicione só estes três, de leitura:
   - `.../auth/gmail.readonly`
   - `.../auth/calendar.readonly`
   - `.../auth/drive.readonly`
4. **Público / Usuários de teste**: adicione **o seu e-mail Google**.
5. Deixe o status em **Testing** (teste). Assim só os usuários de teste conseguem
   conectar e o Google não exige verificação do app.

> Em modo Testing o Google pode pedir para reconectar a cada 7 dias. É normal
> para uso pessoal; basta clicar em "Conectar" de novo.

### 3. Credencial (ID do cliente OAuth)
1. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
2. Tipo: **Aplicativo da Web**.
3. **URIs de redirecionamento autorizados** — adicione os três:
   ```
   http://localhost:3001/conectores/email/gmail/callback
   http://localhost:3001/conectores/agenda/google-calendar/callback
   http://localhost:3001/conectores/drive/google-drive/callback
   ```
4. Crie e copie o **Client ID** e o **Client Secret**.

### 4. Variáveis do servidor
Em `ts/api/.env` (este arquivo não vai para o git), preencha:
```
GOOGLE_CLIENT_ID="cole-o-client-id"
GOOGLE_CLIENT_SECRET="cole-o-client-secret"
```
Reinicie a API. **Não troque a `ENCRYPTION_KEY`** depois de conectar: os
tokens guardados deixariam de abrir (seria preciso reconectar tudo).

### 5. Conectar
Em **Conectores**, clique em **Conectar** no Gmail, no Google Calendar e no
Google Drive. Em cada um, o Google mostra o que o Oracle vai poder ler; aceite
**todas as caixas** — sem a permissão de leitura a conexão é recusada com aviso.

## Onde usar

- **Email** — suas mensagens reais; "Salvar no Repositório" vira nota.
- **Agenda** — seus próximos eventos; "Salvar no Repositório" cria a nota em
  Reuniões e as notas dos participantes em Pessoas.
- **Google Drive** — em Conectores → Google Drive → **Importar arquivos para o
  Repositório**: busque, marque e importe Docs, Planilhas, Apresentações, PDF,
  Word e textos (até 15 MB). Cada arquivo vira uma nota com link para o original.

## Problemas comuns

| Mensagem | Causa |
|---|---|
| "Integração ... ainda não configurada no servidor" | `GOOGLE_CLIENT_ID`/`SECRET` vazios ou API não reiniciada. |
| `redirect_uri_mismatch` (página do Google) | A URI do passo 3 não foi cadastrada exatamente igual. |
| `access_denied` / "app não verificado" | Seu e-mail não está em Usuários de teste. |
| "A permissão de leitura ... não foi concedida" | Uma caixa ficou desmarcada na tela do Google. Conecte de novo. |
| "... recusou o acesso" depois de dias | A autorização expirou (modo Testing). Conecte de novo. |

## Código

- `ts/api/src/conectores/oauth-provider.service.ts` — provedores, escopos, PKCE, troca e renovação de tokens, revogação.
- `ts/api/src/conectores/oauth-state.service.ts` — `state` assinado (e o verificador PKCE cifrado).
- `ts/api/src/conectores/{email,agenda,drive}.controller.ts` e `*-api.service.ts` — rotas e leitura.
- `ts/demo/src/app/pages/ceo/Agenda.tsx`, `ts/demo/src/app/pages/ceo/drive/ImportarDoDrive.tsx`.
