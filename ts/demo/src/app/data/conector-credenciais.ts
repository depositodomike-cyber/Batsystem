// ----------------------------------------------------------------------
// Credenciais por conector — o que cada integração pede para conectar.
//
// Conectores como Gmail, Slack e Google Calendar têm OAuth próprio no backend
// (o usuário autoriza no provedor e não digita nada). Os daqui são os que se
// conectam informando as credenciais de um app criado pela empresa no painel do
// provedor. Os nomes dos campos seguem o vocabulário de cada plataforma, para o
// valor copiado de lá cair no campo certo sem tradução.
//
// Espelhado em ts/api/src/conectores/credenciais-spec.ts, que valida a entrada.
// Ao mexer nos campos, atualize os DOIS arquivos — o backend recusa com 400 um
// id de campo que ele não conheça.
// ----------------------------------------------------------------------

export interface CampoCredencial {
  /** Id enviado à API (e validado contra a spec do backend). */
  id: string;
  label: string;
  /** `senha` mascara a digitação; `url` valida o formato antes de enviar. */
  tipo: "texto" | "senha" | "url";
  obrigatorio: boolean;
  placeholder?: string;
  /** Uma linha dizendo de onde no painel do provedor o valor sai. */
  ajuda?: string;
}

export interface EspecificacaoCredenciais {
  /** Onde criar/achar as credenciais, mostrado no topo do formulário. */
  origem: string;
  campos: CampoCredencial[];
}

export const CREDENCIAIS_POR_CONECTOR: Record<
  string,
  EspecificacaoCredenciais
> = {
  "google-drive": {
    origem:
      "Crie um cliente OAuth 2.0 (tipo aplicativo Web) em Google Cloud → APIs e serviços → Credenciais, com a API do Drive habilitada.",
    campos: [
      {
        id: "clientId",
        label: "Client ID",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "000000000000-xxxxxxxx.apps.googleusercontent.com",
        ajuda: "ID do cliente OAuth do projeto no Google Cloud.",
      },
      {
        id: "clientSecret",
        label: "Client Secret",
        tipo: "senha",
        obrigatorio: true,
        placeholder: "GOCSPX-••••••••••••",
        ajuda: "Segredo do mesmo cliente OAuth.",
      },
      {
        id: "pastaRaizId",
        label: "ID da pasta raiz",
        tipo: "texto",
        obrigatorio: false,
        placeholder: "1a2B3cD4eF5gH6iJ7kL8",
        ajuda:
          "Opcional: limita a integração a uma pasta. É o trecho final da URL da pasta no Drive.",
      },
    ],
  },

  teams: {
    origem:
      "Registre um aplicativo em Microsoft Entra ID → Registros de aplicativo, com as permissões do Microsoft Graph que você pretende usar.",
    campos: [
      {
        id: "tenantId",
        label: "Tenant ID (Directory ID)",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
        ajuda: "Identificador do diretório da sua organização.",
      },
      {
        id: "clientId",
        label: "Client ID (Application ID)",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
        ajuda: "ID do aplicativo registrado.",
      },
      {
        id: "clientSecret",
        label: "Client Secret",
        tipo: "senha",
        obrigatorio: true,
        placeholder: "••••••••••••••••",
        ajuda:
          "Valor do segredo (aparece uma única vez em Certificados e segredos).",
      },
    ],
  },

  onedrive: {
    origem:
      "Mesmo modelo do Teams: aplicativo no Microsoft Entra ID com permissões de Files no Microsoft Graph.",
    campos: [
      {
        id: "tenantId",
        label: "Tenant ID (Directory ID)",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      {
        id: "clientId",
        label: "Client ID (Application ID)",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      {
        id: "clientSecret",
        label: "Client Secret",
        tipo: "senha",
        obrigatorio: true,
        placeholder: "••••••••••••••••",
      },
      {
        id: "driveId",
        label: "Drive ID",
        tipo: "texto",
        obrigatorio: false,
        placeholder: "b!xxxxxxxxxxxxxxxxxxxx",
        ajuda:
          "Opcional: aponta para uma biblioteca específica. Em branco, usa o OneDrive do usuário autorizado.",
      },
    ],
  },

  whatsapp: {
    origem:
      "Use a WhatsApp Cloud API: crie um app em developers.facebook.com, vincule sua conta do WhatsApp Business e gere um token permanente.",
    campos: [
      {
        id: "phoneNumberId",
        label: "Phone Number ID",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "123456789012345",
        ajuda:
          "Id do número emissor, em WhatsApp → Configuração da API (não é o telefone).",
      },
      {
        id: "wabaId",
        label: "WhatsApp Business Account ID",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "123456789012345",
        ajuda: "Id da WABA, no Gerenciador de Negócios.",
      },
      {
        id: "accessToken",
        label: "Token de acesso permanente",
        tipo: "senha",
        obrigatorio: true,
        placeholder: "EAAG••••••••",
        ajuda:
          "Token de usuário do sistema. Tokens temporários de teste expiram em 24 h.",
      },
      {
        id: "webhookVerifyToken",
        label: "Token de verificação do webhook",
        tipo: "senha",
        obrigatorio: false,
        ajuda:
          "Opcional: só se você for receber mensagens. É o valor que a Meta confere ao registrar o webhook.",
      },
    ],
  },

  youtube: {
    origem:
      "Habilite a YouTube Data API v3 no Google Cloud. Publicar vídeos exige cliente OAuth; leitura de estatísticas públicas aceita chave de API.",
    campos: [
      {
        id: "clientId",
        label: "Client ID",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "000000000000-xxxxxxxx.apps.googleusercontent.com",
      },
      {
        id: "clientSecret",
        label: "Client Secret",
        tipo: "senha",
        obrigatorio: true,
        placeholder: "GOCSPX-••••••••••••",
      },
      {
        id: "apiKey",
        label: "Chave de API",
        tipo: "senha",
        obrigatorio: false,
        ajuda: "Opcional: usada nas leituras que não exigem autorização.",
      },
      {
        id: "channelId",
        label: "ID do canal",
        tipo: "texto",
        obrigatorio: false,
        placeholder: "UC••••••••••••••••••••",
        ajuda: "Opcional: fixa o canal de destino das publicações.",
      },
    ],
  },

  zapier: {
    origem:
      "No Zap que vai receber os eventos, use o gatilho Webhooks by Zapier → Catch Hook e copie a URL gerada.",
    campos: [
      {
        id: "webhookUrl",
        label: "URL do webhook (Catch Hook)",
        tipo: "url",
        obrigatorio: true,
        placeholder: "https://hooks.zapier.com/hooks/catch/000000/xxxxxx/",
        ajuda: "Para onde enviamos os eventos.",
      },
      {
        id: "apiKey",
        label: "Chave de API do Zapier",
        tipo: "senha",
        obrigatorio: false,
        ajuda:
          "Opcional: só se você também for disparar Zaps pela API REST do Zapier.",
      },
    ],
  },
};

/** True quando o conector se conecta por formulário (e não por OAuth). */
export function exigeCredenciais(connectorId: string): boolean {
  return connectorId in CREDENCIAIS_POR_CONECTOR;
}

/** Spec do conector, ou `undefined` se ele não usa formulário. */
export function credenciaisDoConector(
  connectorId: string,
): EspecificacaoCredenciais | undefined {
  return CREDENCIAIS_POR_CONECTOR[connectorId];
}

/** Rótulo de um campo pelo id — usado para listar o que já está preenchido. */
export function labelDoCampo(connectorId: string, campoId: string): string {
  const campo = CREDENCIAIS_POR_CONECTOR[connectorId]?.campos.find(
    (c) => c.id === campoId,
  );
  return campo?.label ?? campoId;
}
