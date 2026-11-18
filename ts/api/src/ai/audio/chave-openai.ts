import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiConnectionsService } from '../connections.service';
import { AiMediaConnectionsService } from '../media-connections.service';

/**
 * Chave OpenAI para o STT (Whisper) a partir de QUALQUER conexão do tenant:
 * Texto primeiro, depois Imagem/Vídeo; por fim a chave do servidor
 * (`OPENAI_API_KEY`). Vazio = não há como transcrever.
 *
 * Usado pelo POST /ai/audio e pela transcrição das notas do Telegram.
 */
@Injectable()
export class ChaveOpenAiService {
  constructor(
    private readonly connections: AiConnectionsService,
    private readonly media: AiMediaConnectionsService,
    private readonly config: ConfigService,
  ) {}

  async resolver(empresaId: string): Promise<string> {
    const texto = await this.connections.listDecrypted(empresaId);
    const daTexto = texto.find((c) => c.provider === 'openai' && c.apiKey);
    if (daTexto) return daTexto.apiKey;

    for (const kind of ['image', 'video'] as const) {
      const fila = await this.media.listDecrypted(empresaId, kind);
      const conn = fila.find((c) => c.provider === 'openai' && c.apiKey);
      if (conn) return conn.apiKey;
    }

    return this.config.get<string>('OPENAI_API_KEY') || '';
  }
}
