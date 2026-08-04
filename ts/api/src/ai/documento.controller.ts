import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { buildDocumentoUser, parseDocumento, SYSTEM_DOCUMENTO } from './documento/prompts';
import { extrairTexto } from './analise/extrair-texto';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

interface DocumentoBody {
  texto?: string;
}

const CATEGORIA_DOCUMENTOS = 'documentos';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class DocumentoController {
  private readonly logger = new Logger(DocumentoController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/documento (multipart) → organiza um documento (arquivo ou texto) e
   * o SALVA na Memória (Documentos). Retorna { titulo, conteudo, resumo, salvo }.
   */
  @Post('documento')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async documento(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() arquivo: UploadedFileLike | undefined,
    @Body() body: DocumentoBody,
  ): Promise<{ titulo: string; conteudo: string; resumo: string; salvo: boolean; memoriaId?: string }> {
    let texto = (body.texto || '').trim();
    if (arquivo) {
      try {
        const t = (await extrairTexto(arquivo.buffer, arquivo.originalname)).trim();
        if (t) texto = t;
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Não consegui ler o arquivo enviado.',
        );
      }
    }
    if (!texto) throw new BadRequestException('Cole o conteúdo ou envie um arquivo.');

    let titulosMemoria: string[] = [];
    try {
      titulosMemoria = (await this.memorias.list(user.empresaId))
        .filter((m) => m.active)
        .map((m) => m.title)
        .slice(0, 200);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos da memória: ${String(err)}`);
    }

    // Alvos dos [[wikilinks]] do bloco "Conexões no Vault".
    let titulosVault: string[] = [];
    try {
      titulosVault = await this.vault.titulos(user.empresaId, texto.slice(0, 1000), 40);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    const userPrompt = buildDocumentoUser(texto, titulosMemoria, titulosVault);
    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_DOCUMENTO, userPrompt, 8000);
    const { titulo, conteudo, resumo } = parseDocumento(text);

    let salvo = false;
    let memoriaId: string | undefined;
    try {
      const item = await this.memorias.create(
        user.empresaId,
        { category: CATEGORIA_DOCUMENTOS, title: titulo, content: conteudo, source: 'Documento' },
        false,
      );
      salvo = true;
      memoriaId = item.id;
    } catch (err) {
      this.logger.error(`Falha ao salvar o documento na Memória: ${String(err)}`);
    }

    return { titulo, conteudo, resumo, salvo, memoriaId };
  }
}
