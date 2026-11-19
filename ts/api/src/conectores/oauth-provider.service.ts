import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from '@/ai/crypto';
import { OauthStateService } from './oauth-state.service';
import { RETORNO_DESKTOP, type OrigemOauth } from './oauth-retorno';
import { chaveConexao, ehPessoal, titularDe } from './titular';

/** Família do conector — cada controller só aceita os provedores da sua. */
export type ProviderKind = 'email' | 'agenda' | 'drive';

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
  /**
   * PKCE (RFC 7636, S256): protege a troca do `code` mesmo se ele for
   * interceptado no redirecionamento. O Google aceita em clientes Web.
   */
  pkce?: boolean;
  /** Google: tokens revogáveis em oauth2.googleapis.com/revoke. */
  google?: boolean;
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
      // Só leitura (menor privilégio): o Oracle lê e-mails e os salva no
      // Repositório; nunca envia, apaga ou altera nada na caixa.
      'https://www.googleapis.com/auth/gmail.readonly',
    ].join(' '),
    extraAuthorizeParams: GOOGLE_AUTHORIZE_PARAMS,
    defaultRedirectUrl: 'http://localhost:3001/conectores/email/gmail/callback',
    pkce: true,
    google: true,
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
      // Só leitura (menor privilégio): lê agendas e eventos; não cria nem
      // altera eventos.
      'https://www.googleapis.com/auth/calendar.readonly',
    ].join(' '),
    extraAuthorizeParams: GOOGLE_AUTHORIZE_PARAMS,
    defaultRedirectUrl:
      'http://localhost:3001/conectores/agenda/google-calendar/callback',
    pkce: true,
    google: true,
    fetchAccount: fetchGoogleAccount,
  },
  {
    id: 'google-drive',
    label: 'Google Drive',
    kind: 'drive',
    envPrefix: 'GOOGLE',
    redirectEnv: 'GOOGLE_DRIVE_REDIRECT_URL',
    authorizeUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      // Só leitura: lista e baixa arquivos para importar ao Repositório.
      'https://www.googleapis.com/auth/drive.readonly',
    ].join(' '),
    extraAuthorizeParams: GOOGLE_AUTHORIZE_PARAMS,
    defaultRedirectUrl:
      'http://localhost:3001/conectores/drive/google-drive/callback',
    pkce: true,
    google: true,
    fetchAccount: fetchGoogleAccount,
  },
];

/** PKCE: verifier aleatório (64 caracteres) e o challenge S256 dele. */
function novoPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Escopos de API pedidos (sem os de identidade, que o Google renomeia). */
function escoposDeApi(scopes: string): string[] {
  return scopes
    .split(/\s+/)
    .filter((s) => s.startsWith('https://www.googleapis.com/auth/'));
}

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
    return `${base}/oracle/conectores`;
  }

  /** Destino do retorno conforme quem iniciou o fluxo (web ou app desktop). */
  frontRetorno(state: string | undefined): string {
    return this.state.origemDe(state) === 'desktop'
      ? RETORNO_DESKTOP
      : this.frontConectoresUrl;
  }

  /** URL de autorização. A conta autorizada será de `usuarioId` (conector pessoal). */
  buildAuthorizeUrl(
    empresaId: string,
    usuarioId: string,
    providerId: string,
    kind: ProviderKind,
    origem?: OrigemOauth,
  ): string {
    const provider = this.requireProvider(providerId, kind);
    const pkce = provider.pkce ? novoPkce() : null;
    const params = new URLSearchParams({
      ...provider.extraAuthorizeParams,
      client_id: this.clientId(provider),
      scope: provider.scopes,
      redirect_uri: this.redirectUrl(provider),
      state: this.state.sign(empresaId, provider.id, pkce?.verifier, usuarioId, origem),
      ...(pkce
        ? { code_challenge: pkce.challenge, code_challenge_method: 'S256' }
        : {}),
    });
    return `${provider.authorizeUrl(this.config)}?${params.toString()}`;
  }

  /** Troca o `code` pelos tokens e persiste; retorna o e-mail da conta. */
  async handleCallback(
    code: string,
    rawState: string,
    kind: ProviderKind,
  ): Promise<string> {
    const { empresaId, connectorId, codeVerifier, usuarioId } =
      this.state.verify(rawState);
    const provider = this.requireProvider(connectorId, kind);
    // Conta pessoal: sem dono no state (link gerado antes desta versão), não
    // há a quem atribuir a caixa — melhor pedir de novo do que adivinhar.
    if (ehPessoal(provider.id) && !usuarioId) {
      throw new BadRequestException('Autorização antiga. Clique em "Conectar" novamente.');
    }
    if (provider.pkce && !codeVerifier) {
      throw new BadRequestException(
        'Autorização inválida (verificador PKCE ausente). Clique em "Conectar" novamente.',
      );
    }

    const tokens = await this.requestTokens(provider, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUrl(provider),
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    if (!tokens.access_token) {
      throw new BadRequestException(
        `${provider.label} recusou a autorização (${tokens.error ?? 'erro desconhecido'}).`,
      );
    }

    // Na tela do Google o usuário pode desmarcar permissões. Sem o escopo de
    // API pedido a conexão não serve para nada — melhor avisar já.
    if (provider.google && tokens.scope) {
      const concedidos = new Set(tokens.scope.split(/\s+/));
      const faltando = escoposDeApi(provider.scopes).filter(
        (sc) => !concedidos.has(sc),
      );
      if (faltando.length) {
        throw new BadRequestException(
          `A permissão de leitura do ${provider.label} não foi concedida. ` +
            'Clique em "Conectar" de novo e marque a caixa de acesso na tela do Google.',
        );
      }
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
    const titular = titularDe(provider.id, usuarioId ?? null);
    await this.prisma.empresaConector.upsert({
      where: chaveConexao(empresaId, provider.id, usuarioId ?? null),
      create: {
        empresaId,
        connectorId: provider.id,
        titular,
        usuarioId: titular || null,
        ...credenciais,
      },
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
    usuarioId: string,
    providerId: string,
    kind: ProviderKind,
  ): Promise<string> {
    const provider = this.requireProvider(providerId, kind);
    // Só a conexão DESTE usuário: a caixa de outro membro não existe para ele.
    const vinculo = await this.prisma.empresaConector.findUnique({
      where: chaveConexao(empresaId, provider.id, usuarioId),
    });
    if (!vinculo?.accessTokenEncrypted) {
      // "ainda não foi autorizado" é o que o front reconhece (ehNaoConectado).
      throw new BadRequestException(
        `O ${provider.label} ainda não foi autorizado na sua conta. ` +
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
    usuarioId: string,
    providerId: string,
    kind: ProviderKind,
  ): Promise<string> {
    const provider = this.requireProvider(providerId, kind);
    const token = await this.getAccessToken(empresaId, usuarioId, provider.id, kind);
    const conta = await provider.fetchAccount(token);
    if (!conta.email) {
      throw new ServiceUnavailableException(
        `${provider.label} não devolveu a conta autorizada. Tente reconectar.`,
      );
    }
    return conta.email;
  }

  /** Este conector é um dos conectores Google (Gmail, Calendar, Drive)? */
  static ehGoogle(connectorId: string): boolean {
    return PROVIDERS.some((p) => p.id === connectorId && p.google);
  }

  /** Ids de todos os conectores Google. */
  static idsGoogle(): string[] {
    return PROVIDERS.filter((p) => p.google).map((p) => p.id);
  }

  /**
   * Revoga no Google o acesso concedido por um vínculo, antes de ele ser
   * apagado. Os conectores Google compartilham a mesma concessão (escopos
   * incrementais) e revogar um token derruba a concessão inteira — por isso
   * quem chama só revoga quando é o ÚLTIMO conector Google DO USUÁRIO.
   * Best-effort: falha de rede não impede a desconexão local.
   */
  async revogarGoogle(
    empresaId: string,
    usuarioId: string | null,
    connectorId: string,
  ): Promise<void> {
    if (!usuarioId) return; // Google é sempre pessoal.
    const vinculo = await this.prisma.empresaConector.findUnique({
      where: chaveConexao(empresaId, connectorId, usuarioId),
    });
    const cifrado =
      vinculo?.refreshTokenEncrypted ?? vinculo?.accessTokenEncrypted;
    if (!cifrado) return;
    try {
      const res = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: this.crypto.decrypt(cifrado) }),
      });
      // 400 = token já inválido/revogado: nada a fazer.
      if (!res.ok && res.status !== 400) {
        this.logger.warn(`Google revoke respondeu ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`Falha ao revogar o acesso ao Google: ${String(err)}`);
    }
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
