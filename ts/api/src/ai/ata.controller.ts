import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GeradoresTextoService } from './geradores-texto.service';
import type { Ata } from './ata/prompts';
import { extrairTexto } from './analise/extrair-texto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissoesGuard, RequerPermissao } from '@/acesso/permissoes.guard';
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
// Usar a IA exige `ia.usar` (todas as roles de sistema a têm).
@UseGuards(JwtAuthGuard, PermissoesGuard)
@RequerPermissao('ia.usar')
export class AtaController {
  constructor(private readonly geradores: GeradoresTextoService) {}

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
    return this.geradores.ata(user, repositorioId, {
      conteudo,
      instrucoes: body.instrucoes,
      memoria: ['true', '1', 'on'].includes(String(body.memoria || '').toLowerCase()),
      design: body.design,
    });
  }
}
