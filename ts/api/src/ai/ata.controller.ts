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
import { buildAtaUser, parseAta, SYSTEM_ATA, SYSTEM_ATA_MEMORIA, type Ata } from './ata/prompts';
import { extrairTexto } from './analise/extrair-texto';
import { designBrief, parseDesign } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

interface AtaBody {
  texto?: string;
  instrucoes?: string;
  memoria?: string; // "true" | "false"
  /** Design system da marca (AI Studio) — JSON serializado no multipart. */
  design?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AtaController {
  private readonly logger = new Logger(AtaController.name);

  constructor(
    private readonly ai: AiService,
    private readonly memorias: MemoriasService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/ata (multipart) → cria uma ata a partir de arquivo OU texto colado.
   * Campos: arquivo (opcional), texto, instrucoes, memoria ("true" = formata p/ a
   * Memória com frontmatter + [[wikilinks]]). Retorna { titulo, ata, memoria }.
   */
  @Post('ata')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async ata(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @UploadedFile() arquivo: UploadedFileLike | undefined,
    @Body() body: AtaBody,
  ): Promise<Ata & { memoria: boolean }> {
    let conteudo = (body.texto || '').trim();
    if (arquivo) {
      try {
        const txt = (await extrairTexto(arquivo.buffer, arquivo.originalname)).trim();
        if (txt) conteudo = txt;
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Não consegui ler o arquivo enviado.',
        );
      }
    }
    if (!conteudo) {
      throw new BadRequestException('Envie um arquivo ou cole o conteúdo da reunião.');
    }

    const memoria = ['true', '1', 'on'].includes(String(body.memoria || '').toLowerCase());
    let titulosMemoria: string[] = [];
    if (memoria) {
      try {
        titulosMemoria = (await this.memorias.list(user.empresaId))
          .filter((m) => m.active)
          .map((m) => m.title)
          .slice(0, 200);
      } catch (err) {
        this.logger.warn(`Falha ao carregar títulos da memória: ${String(err)}`);
      }
    }

    // Alvos dos [[wikilinks]] do bloco "Conexões no Vault" — independem da opção
    // "Memória": a ata pode ser salva na pasta da Memória de qualquer forma.
    let titulosVault: string[] = [];
    try {
      titulosVault = await this.vault.titulos(user.empresaId, repositorioId, conteudo.slice(0, 1000), 40);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    const system = memoria ? SYSTEM_ATA_MEMORIA : SYSTEM_ATA;
    const userPrompt =
      designBrief(parseDesign(body.design)) +
      buildAtaUser({
        conteudo,
        instrucoes: (body.instrucoes || '').trim(),
        memoria,
        titulosMemoria,
        titulosVault,
      });

    const { text } = await this.ai.completar(user.empresaId, user.id, system, userPrompt, 8000);
    return { ...parseAta(text), memoria };
  }
}
