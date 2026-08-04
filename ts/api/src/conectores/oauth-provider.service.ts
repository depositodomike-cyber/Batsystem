import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from '@/ai/crypto';
import { OauthStateService } from './oauth-state.service';

/** Família do conector — cada controller só aceita os provedores da sua. */
export type ProviderKind = 'email' | 'agenda';

/**
 * Provedor OAuth suportado. O `id` é o mesmo do catálogo de conectores,
 * então o vínculo em EmpresaConector usa exatamente este valor.
 */
interface OauthProvider {
  id: string;
  label: string;
  kind: ProviderKind;
  /** Prefixo das variáveis de credencial (ex.: GOOGLE_CLIENT_ID). */
  envPrefix: string;
  /**
   * Variável do redirect_uri. É por provedor (e não pelo prefixo) porque o
   * Gmail e o Google Calendar compartilham as credenciais GOOGLE_* mas têm
   * callbacks distintos — cada um precisa estar registrado no Google Cloud.
   */
  redirectEnv: string;
  authorizeUrl: (config: ConfigService) => string;
  tokenUrl: (config: ConfigService) => string;
  scopes: string;
  /** Parâmetros extras exigidos pelo provedor na tela de consentimento. */
  extraAuthorizeParams: Record<string, string>;
  defaultRedirectUrl: string;
  /** Lê a conta autorizada (id + e-mail) com o access token recém-obtido. */
  fetchAccount: (accessToken: string) => Promise<{ id: string; email: string }>;
}

/** Tenant do Azure AD; `common` aceita contas corporativas e pessoais. */
function microsoftTenant(config: ConfigService): string {
  return config.get<string>('MICROSOFT_TENANT_ID', 'common');
}

/** Conta Google autorizada — igual para Gmail e Google Calendar. */
async function fetchGoogleAccount(
  accessToken: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as { sub?: string; email?: string };
  return { id: data.sub ?? '', email: data.email ?? '' };
}

/**
 * `access_type=offline` + `prompt=consent` garantem o refresh token — sem
 * eles o Google só o envia na primeiríssima autorização da conta.
 * `include_granted_scopes` mantém os escopos já concedidos (quem conectou o
 * Gmail antes não perde o acesso à caixa ao autorizar a agenda).
 */
const GOOGLE_AUTHORIZE_PARAMS = {
  response_type: 'code',
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'true',
};

const PROVIDERS: OauthProvider[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    kind: 'email',
    envPrefix: 'GOOGLE',
    redirectEnv: 'GOOGLE_REDIRECT_URL',
    authorizeUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ].join(' '),
    extraAuthorizeParams: GOOGLE_AUTHORIZE_PARAMS,
    defaultRedirectUrl: 'http://localhost:3001/conectores/email/gmail/callback',
    fetchAccount: fetchGoogleAccount,
  },
  {
    id: 'outlook',
    label: 'Outlook',
    kind: 'email',
    envPrefix: 'MICROSOFT',
    redirectEnv: 'MICROSOFT_REDIRECT_URL',
    authorizeUrl: (config) =>
      `https://login.microsoftonline.com/${microsoftTenant(config)}/oauth2/v2.0/authorize`,
    tokenUrl: (config) =>
      `https://login.microsoftonline.com/${microsoftTenant(config)}/oauth2/v2.0/token`,
    // `offline_access` é o que libera o refresh token no Microsoft Identity.
    scopes: [
      'openid',
      'email',
      'offline_access',
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.Send',
    ].join(' '),
    extraAuthorizeParams: { response_type: 'code', response_mode: 'query' },
    defaultRedirectUrl:
      'http://localhost:3001/conectores/email/outlook/callback',
    fetchAccount: async (accessToken) => {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as {
        id?: string;
        mail?: string;
        userPrincipalName?: string;
      };
      return {
        id: data.id ?? '',
        email: data.mail ?? data.userPrincipalName ?? '',
      };
    },
  },
  {
    id: 'google-calendar',
    label: 'Google Calendar',
    kind: 'agenda',
    // Mesmas credenciais do Gmail (um único app no Google Cloud); só o
    // callback e os escopos mudam.
    envPrefix: 'GOOGLE',
    redirectEnv: 'GOOGLE_CALENDAR_REDIRECT_URL',
    authorizeUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      // `readonly` lê agendas, eventos e disponibilidade; `events` permite
      // criar e atualizar eventos com convidados.
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '),
    extraAuthorizeParams: GOOGLE_AUTHORIZE_PARAMS,
    defaultRedirectUrl:
      'http://localhost:3001/conectores/agenda/google-calendar/callback',
    fetchAccount: fetchGoogleAccount,
  },
];

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * OAuth 2.0 (authorization code) dos conectores de e-mail — Gmail (Google) e
 * Outlook (Microsoft 365) — e de agenda — Google Calendar. Mesmo desenho do
 * Slack:
 *
 * 1. O front pede a URL de autorização; o `state` assinado leva empresa +
 *    conector, então o callback identifica o tenant sem sessão.
 * 2. O provedor redireciona com `code`; trocamos por access + refresh token,
 *    lemos o e-mail da conta autorizada e gravamos tudo criptografado.
 * 3. `getAccessToken` renova sozinho quando o access token está por expirar.
 *
 * Requer <PREFIXO>_CLIENT_ID/_CLIENT_SECRET (GOOGLE_*, MICROSOFT_*). Sem
 * eles, "Conectar" responde 503 explicando o que falta configurar.
 */
@Injectable()
export class OauthProviderService {
  private readonly logger = new Logger(OauthProviderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly state: OauthStateService,
  ) {}

  /** Ids de uma família (usados nas rotas e no vínculo em EmpresaConector). */
  static providerIds(kind: ProviderKind): string[] {
    return PROVIDERS.filter((p) => p.kind === kind).map((p) => p.id);
  }

  /** Para onde devolver o navegador do usuário ao final do fluxo. */
  get frontConectoresUrl(): string {
    const base = this.config
      .get<string>('FRONT_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    return `${base}/behuman/conectores`;
  }

  buildAuthorizeUrl(
    empresaId: string,
    providerId: string,
    kind: ProviderKind,
  ): string {
    const provider = this.requireProvider(providerId, kind);
    const params = new URLSearchParams({
      ...provider.extraAuthorizeParams,
      client_id: this.clientId(provider),
      scope: provider.scopes,
      redirect_uri: this.redirectUrl(provider),
      state: this.state.sign(empresaId, provider.id),
    });
    return `${provider.authorizeUrl(this.config)}?${params.toString()}`;
  }

  /** Troca o `code` pelos tokens e persiste; retorna o e-mail da conta. */
  async handleCallback(
    code: string,
    rawState: string,
    kind: ProviderKind,
  ): Promise<string> {
    const { empresaId, connectorId } = this.state.verify(rawState);
    const provider = this.requireProvider(connectorId, kind);

    const tokens = await this.requestTokens(provider, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUrl(provider),
    });
    if (!tokens.access_token) {
      throw new BadRequestException(
        `${provider.label} recusou a autorização (${tokens.error ?? 'erro desconhecido'}).`,
      );
    }

    let conta = { id: '', email: '' };
    try {
      conta = await provider.fetchAccount(tokens.access_token);
    } catch (err) {
      // Perder o e-mail da conta não invalida a conexão: seguimos e o
      // usuário vê o conector conectado, apenas sem o rótulo da conta.
      this.logger.warn(`Não foi possível ler a conta do ${provider.label}`);
      this.logger.warn(err);
    }

    const credenciais = {
      origem: 'oauth',
      accessTokenEncrypted: this.crypto.encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token
        ? this.crypto.encrypt(tokens.refresh_token)
        : null,
      tokenExpiresAt: this.expiresAt(tokens.expires_in),
      teamId: conta.id || null,
      teamName: conta.email || null,
      scopes: tokens.scope ?? provider.scopes,
    };
    await this.prisma.empresaConector.upsert({
      where: {
        empresaId_connectorId: { empresaId, connectorId: provider.id },
      },
      create: { empresaId, connectorId: provider.id, ...credenciais },
      update: credenciais,
    });

    return conta.email || provider.label;
  }

  /**
   * Access token válido do tenant, renovando pelo refresh token quando
   * faltar menos de um minuto para expirar. É o ponto de entrada para
   * qualquer chamada à API do provedor.
   */
  async getAccessToken(
    empresaId: string,
    providerId: string,
    kind: ProviderKind,
  ): Promise<string> {
    const provider = this.requireProvider(providerId, kind);
    const vinculo = await this.prisma.empresaConector.findUnique({
      where: {
        empresaId_connectorId: { empresaId, connectorId: provider.id },
      },
    });
    if (!vinculo?.accessTokenEncrypted) {
      throw new BadRequestException(
        `O ${provider.label} ainda não foi autorizado para esta empresa. ` +
          `Abra Conectores → ${provider.label} → Conectar e autorize a conta.`,
      );
    }

    const expiraEm = vinculo.tokenExpiresAt?.getTime() ?? 0;
    if (expiraEm > Date.now() + 60_000) {
      return this.crypto.decrypt(vinculo.accessTokenEncrypted);
    }
    if (!vinculo.refreshTokenEncrypted) {
      throw new BadRequestException(
        `A autorização do ${provider.label} expirou e não há refresh token. ` +
          `Abra Conectores → ${provider.label} → Conectar para reautorizar.`,
      );
    }

    const tokens = await this.requestTokens(provider, {
      grant_type: 'refresh_token',
      refresh_token: this.crypto.decrypt(vinculo.refreshTokenEncrypted),
    });
    if (!tokens.access_token) {
      throw new BadRequestException(
        `Não foi possível renovar o acesso ao ${provider.label} ` +
          `(${tokens.error ?? 'erro desconhecido'}). Reautorize a conta.`,
      );
    }
    await this.prisma.empresaConector.update({
      where: { id: vinculo.id },
      data: {
        accessTokenEncrypted: this.crypto.encrypt(tokens.access_token),
        // O Google costuma omitir o refresh token na renovação: mantemos o
        // que já temos; a Microsoft manda um novo a cada rotação.
        ...(tokens.refresh_token
          ? { refreshTokenEncrypted: this.crypto.encrypt(tokens.refresh_token) }
          : {}),
        tokenExpiresAt: this.expiresAt(tokens.expires_in),
      },
    });
    return tokens.access_token;
  }

  /** Conta autorizada, confirmada contra a API do provedor (health check). */
  async checkAccount(
    empresaId: string,
    providerId: string,
    kind: ProviderKind,
  ): Promise<string> {
    const provider = this.requireProvider(providerId, kind);
    const token = await this.getAccessToken(empresaId, provider.id, kind);
    const conta = await provider.fetchAccount(token);
    if (!conta.email) {
      throw new ServiceUnavailableException(
        `${provider.label} não devolveu a conta autorizada. Tente reconectar.`,
      );
    }
    return conta.email;
  }

  // ---------- infra ----------

  private requireProvider(
    providerId: string,
    kind: ProviderKind,
  ): OauthProvider {
    const provider = PROVIDERS.find(
      (p) => p.id === providerId && p.kind === kind,
    );
    if (!provider) {
      throw new NotFoundException(
        `Provedor "${providerId}" não suportado nesta rota ` +
          `(disponíveis: ${OauthProviderService.providerIds(kind).join(', ')}).`,
      );
    }
    return provider;
  }

  /** Client id do provedor; erro 503 orientando o setup quando ausente. */
  private clientId(provider: OauthProvider): string {
    const id = this.config.get<string>(`${provider.envPrefix}_CLIENT_ID`);
    const secret = this.config.get<string>(
      `${provider.envPrefix}_CLIENT_SECRET`,
    );
    if (!id || !secret) {
      throw new ServiceUnavailableException(
        `Integração com o ${provider.label} ainda não configurada no servidor ` +
          `(defina ${provider.envPrefix}_CLIENT_ID e ${provider.envPrefix}_CLIENT_SECRET).`,
      );
    }
    return id;
  }

  private redirectUrl(provider: OauthProvider): string {
    return this.config.get<string>(
      provider.redirectEnv,
      provider.defaultRedirectUrl,
    );
  }

  private expiresAt(expiresIn: number | undefined): Date {
    // Sem `expires_in` assumimos a validade típica (1h) — o pior caso é uma
    // renovação a mais, nunca um token vencido em uso.
    return new Date(Date.now() + (expiresIn ?? 3600) * 1000);
  }

  private async requestTokens(
    provider: OauthProvider,
    params: Record<string, string>,
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      ...params,
      client_id: this.clientId(provider),
      client_secret:
        this.config.get<string>(`${provider.envPrefix}_CLIENT_SECRET`) ?? '',
    });
    try {
      const res = await fetch(provider.tokenUrl(this.config), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = (await res.json()) as TokenResponse;
      if (data.error) {
        this.logger.warn(
          `${provider.label}: ${data.error} ${data.error_description ?? ''}`,
        );
      }
      return data;
    } catch (err) {
      this.logger.error(err);
      throw new ServiceUnavailableException(
        `Falha ao falar com o ${provider.label}. Tente novamente.`,
      );
    }
  }
}
