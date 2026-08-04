import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from '@/ai/crypto';
import { OauthStateService } from './oauth-state.service';

/**
 * Scopes de bot — o app agindo como ele mesmo: publicar mensagens e ler os
 * canais em que foi adicionado.
 *
 * Quem autorizou antes destes scopes existirem tem um token sem eles: o Slack
 * responde `missing_scope` e a única saída é desconectar e conectar de novo.
 */
const SLACK_SCOPES = [
  'channels:read',
  'channels:history',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'chat:write',
  'chat:write.public',
  'users:read',
].join(',');

/**
 * Scopes da pessoa que autoriza — é o que a página de Slack lê.
 *
 * O token de bot não serve para essa leitura: ele só enxerga os canais em que
 * o app foi adicionado, e as DMs que enxerga são as do próprio app (conversas
 * vazias com cada pessoa), nunca as da pessoa. Com o token de usuário a tela
 * mostra as conversas de quem autorizou — DMs, conversas em grupo e os canais
 * em que ela está, sem precisar de `/invite`.
 *
 * Só leitura: publicar continua sendo o bot (`chat:write` acima).
 */
const SLACK_USER_SCOPES = [
  'channels:read',
  'channels:history',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'users:read',
].join(',');

interface SlackOAuthAccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  scope?: string;
  team?: { id?: string; name?: string };
  /** Token da pessoa que autorizou, quando `user_scope` foi pedido. */
  authed_user?: {
    id?: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
}

/**
 * Fluxo OAuth v2 do Slack (piloto dos conectores com integração real).
 *
 * 1. O front pede a URL de autorização (`buildAuthorizeUrl`) — o `state`
 *    leva o empresaId assinado (HMAC), então o callback sabe a qual tenant
 *    a autorização pertence sem guardar sessão.
 * 2. O Slack redireciona para o callback com `code` + `state`; trocamos o
 *    code pelo bot token e salvamos criptografado no EmpresaConector.
 *
 * Requer SLACK_CLIENT_ID / SLACK_CLIENT_SECRET no ambiente (crie o app em
 * https://api.slack.com/apps). Sem eles, `buildAuthorizeUrl` responde 503.
 */
@Injectable()
export class SlackOauthService {
  private readonly logger = new Logger(SlackOauthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly state: OauthStateService,
  ) {}

  get isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SLACK_CLIENT_ID') &&
        this.config.get<string>('SLACK_CLIENT_SECRET'),
    );
  }

  private get redirectUrl(): string {
    return this.config.get<string>(
      'SLACK_REDIRECT_URL',
      'http://localhost:3001/conectores/slack/callback',
    );
  }

  /** Para onde devolver o navegador do usuário ao final do fluxo. */
  get frontConectoresUrl(): string {
    const base = this.config
      .get<string>('FRONT_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    return `${base}/behuman/conectores`;
  }

  buildAuthorizeUrl(empresaId: string): string {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Integração com o Slack ainda não configurada no servidor ' +
          '(defina SLACK_CLIENT_ID e SLACK_CLIENT_SECRET).',
      );
    }
    const params = new URLSearchParams({
      client_id: this.config.get<string>('SLACK_CLIENT_ID')!,
      scope: SLACK_SCOPES,
      user_scope: SLACK_USER_SCOPES,
      redirect_uri: this.redirectUrl,
      state: this.state.sign(empresaId, 'slack'),
    });
    // Enquanto o app do Slack não está distribuído publicamente, ele só pode
    // ser instalado no workspace onde foi criado — se o navegador estiver em
    // outro, o Slack recusa com `invalid_team_for_non_distributed_app`. Fixar
    // SLACK_TEAM_ID força a tela de consentimento no workspace certo.
    const team = this.config.get<string>('SLACK_TEAM_ID');
    if (team) params.set('team', team);
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /** Troca o `code` pelo token e persiste; retorna o nome do workspace. */
  async handleCallback(code: string, state: string): Promise<string> {
    const { empresaId } = this.state.verify(state);

    const body = new URLSearchParams({
      code,
      client_id: this.config.get<string>('SLACK_CLIENT_ID') ?? '',
      client_secret: this.config.get<string>('SLACK_CLIENT_SECRET') ?? '',
      redirect_uri: this.redirectUrl,
    });
    let data: SlackOAuthAccessResponse;
    try {
      const res = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      data = (await res.json()) as SlackOAuthAccessResponse;
    } catch (err) {
      this.logger.error(err);
      throw new ServiceUnavailableException(
        'Falha ao falar com o Slack. Tente novamente.',
      );
    }
    if (!data.ok || !data.access_token) {
      // Erros do Slack (ex.: invalid_code) são curtos e seguros de expor.
      throw new BadRequestException(
        `O Slack recusou a autorização (${data.error ?? 'erro desconhecido'}).`,
      );
    }

    // O token de usuário é opcional: se a pessoa recusar os acessos de leitura,
    // o conector continua valendo para publicar — a página de Slack é que avisa
    // que não dá para ler as conversas dela.
    const userToken = data.authed_user?.access_token;
    const credenciais = {
      accessTokenEncrypted: this.crypto.encrypt(data.access_token),
      teamId: data.team?.id ?? null,
      teamName: data.team?.name ?? null,
      scopes: data.scope ?? null,
      userTokenEncrypted: userToken ? this.crypto.encrypt(userToken) : null,
      userId: data.authed_user?.id ?? null,
      userScopes: data.authed_user?.scope ?? null,
    };

    await this.prisma.empresaConector.upsert({
      where: { empresaId_connectorId: { empresaId, connectorId: 'slack' } },
      create: {
        empresaId,
        connectorId: 'slack',
        origem: 'oauth',
        ...credenciais,
      },
      update: { origem: 'oauth', ...credenciais },
    });

    return data.team?.name ?? 'workspace';
  }
}
