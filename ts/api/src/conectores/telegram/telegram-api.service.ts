// Cliente mínimo da Bot API do Telegram (só chamadas de SAÍDA por HTTPS).
//
// O token vai no caminho da URL (`/bot<token>/...`), então NENHUMA falha daqui
// carrega a URL nem a mensagem crua do fetch: tudo vira `ErroTelegram` com o
// texto já redigido. O token nunca é logado.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE = 'https://api.telegram.org';

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

export interface TgArquivo {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  mime_type?: string;
  file_name?: string;
  duration?: number;
}

export interface TgMessage {
  message_id: number;
  date: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  caption?: string;
  voice?: TgArquivo;
  audio?: TgArquivo;
  document?: TgArquivo;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

/** Erro da Bot API sem segredo: nunca leva URL nem token. */
export class ErroTelegram extends Error {
  constructor(
    readonly metodo: string,
    detalhe: string,
    readonly retryAfter?: number,
  ) {
    super(`Telegram ${metodo}: ${detalhe}`);
    this.name = 'ErroTelegram';
  }
}

/** Remove qualquer coisa com cara de token de bot de um texto. */
export function redigirToken(texto: string, token?: string): string {
  let t = texto;
  if (token) t = t.split(token).join('***');
  return t.replace(/\d{5,}:[A-Za-z0-9_-]{20,}/g, '***');
}

@Injectable()
export class TelegramApiService {
  private botCache: { username: string } | null = null;

  constructor(private readonly config: ConfigService) {}

  private token(): string {
    return (this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '').trim();
  }

  /** Há um token com formato de token de bot? (não valida no Telegram) */
  configurado(): boolean {
    return /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(this.token());
  }

  private async chamar<T>(metodo: string, corpo: Record<string, unknown> = {}, sinal?: AbortSignal): Promise<T> {
    const token = this.token();
    if (!token) throw new ErroTelegram(metodo, 'bot não configurado (TELEGRAM_BOT_TOKEN).');
    let resp: Response;
    try {
      resp = await fetch(`${BASE}/bot${token}/${metodo}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: sinal,
      });
    } catch (e) {
      // A mensagem do fetch pode trazer a URL: só o tipo do erro sai daqui.
      const nome = e instanceof Error ? e.name : 'Erro';
      throw new ErroTelegram(metodo, nome === 'AbortError' ? 'cancelado' : `falha de rede (${nome})`);
    }
    const json = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      result?: T;
      description?: string;
      parameters?: { retry_after?: number };
    } | null;
    if (!json?.ok) {
      const desc = redigirToken(String(json?.description ?? 'resposta inválida'), token).slice(0, 200);
      throw new ErroTelegram(metodo, `${resp.status} ${desc}`, json?.parameters?.retry_after);
    }
    return json.result as T;
  }

  /** @username do bot (cacheado). Null se não configurado/indisponível. */
  async bot(): Promise<{ username: string } | null> {
    if (this.botCache) return this.botCache;
    if (!this.configurado()) return null;
    try {
      const me = await this.chamar<TgUser>('getMe');
      if (me.username) this.botCache = { username: me.username };
    } catch {
      return null;
    }
    return this.botCache;
  }

  deleteWebhook(): Promise<boolean> {
    return this.chamar<boolean>('deleteWebhook', { drop_pending_updates: false });
  }

  getUpdates(offset: number, timeoutSeg: number, sinal?: AbortSignal): Promise<TgUpdate[]> {
    return this.chamar<TgUpdate[]>(
      'getUpdates',
      { offset, timeout: timeoutSeg, allowed_updates: ['message'] },
      sinal,
    );
  }

  async sendMessage(chatId: string, texto: string, responderA?: number): Promise<void> {
    await this.chamar('sendMessage', {
      chat_id: chatId,
      text: texto,
      ...(responderA
        ? { reply_parameters: { message_id: responderA, allow_sending_without_reply: true } }
        : {}),
    });
  }

  getFile(fileId: string): Promise<{ file_path?: string; file_size?: number }> {
    return this.chamar('getFile', { file_id: fileId });
  }

  /** Baixa um arquivo do Telegram, abortando acima de `limite` bytes. */
  async baixar(filePath: string, limite: number): Promise<Buffer> {
    const token = this.token();
    if (!token) throw new ErroTelegram('download', 'bot não configurado.');
    let resp: Response;
    try {
      resp = await fetch(`${BASE}/file/bot${token}/${filePath}`);
    } catch (e) {
      throw new ErroTelegram('download', `falha de rede (${e instanceof Error ? e.name : 'Erro'})`);
    }
    if (!resp.ok || !resp.body) throw new ErroTelegram('download', `HTTP ${resp.status}`);
    const partes: Buffer[] = [];
    let total = 0;
    const leitor = resp.body.getReader();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > limite) {
        await leitor.cancel().catch(() => undefined);
        throw new ErroTelegram('download', 'arquivo acima do limite.');
      }
      partes.push(Buffer.from(value));
    }
    return Buffer.concat(partes);
  }
}
