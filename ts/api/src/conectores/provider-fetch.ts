import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * GET autenticado numa API de provedor OAuth (Gmail, Microsoft Graph, Google
 * Calendar), com as mensagens de erro que o usuário vê no produto.
 *
 * 401/403 quase sempre significam escopo faltando ou autorização revogada —
 * a saída é reconectar, então o texto aponta para Conectores. Os demais
 * códigos viram 503: falha do provedor, não do tenant.
 */
export async function getProviderJson<T>(
  ctx: {
    logger: Logger;
    /** Nome do provedor como aparece na UI (ex.: "Google Calendar"). */
    label: string;
    /** Recurso acessado, para a frase de erro (ex.: "a agenda"). */
    recurso: string;
  },
  url: string,
  token: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    ctx.logger.error(err);
    throw new ServiceUnavailableException(
      `Falha ao falar com o ${ctx.label}. Tente novamente.`,
    );
  }
  if (!res.ok) {
    const detalhe = await res.text().catch(() => '');
    ctx.logger.warn(
      `${ctx.label} ${res.status} em ${url}: ${detalhe.slice(0, 300)}`,
    );
    if (res.status === 401 || res.status === 403) {
      throw new BadRequestException(
        `O ${ctx.label} recusou o acesso ${ctx.recurso}. ` +
          `Abra Conectores → ${ctx.label} → Conectar e autorize a conta novamente.`,
      );
    }
    throw new ServiceUnavailableException(
      `O ${ctx.label} retornou um erro (${res.status}) ao ler ${ctx.recurso}.`,
    );
  }
  return (await res.json()) as T;
}
