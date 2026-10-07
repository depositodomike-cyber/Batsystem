import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  RepositorioOrgService,
  type DocumentoOrg,
} from './repositorio-org.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { OrganizacaoAtual } from '@/common/organizacao-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

// O multer (memoryStorage) entrega o arquivo com estes campos.
interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/**
 * Repositório da organização (Configurações → Repositório → Visualizar
 * arquivos). Escopado a empresa + organização (header X-Organizacao-Id).
 *
 * Quem pode enviar e remover é decidido na interface pelo papel na
 * organização (`capacidades` do protótipo de contas) — as organizações do
 * protótipo só existem no cliente, então o servidor não tem como conferir o
 * papel. O que o servidor garante é o isolamento entre organizações.
 */
@Controller('repositorio-org/documentos')
@UseGuards(JwtAuthGuard)
export class RepositorioOrgController {
  constructor(private readonly repositorio: RepositorioOrgService) {}

  /** GET /repositorio-org/documentos → documentos da organização ativa. */
  @Get()
  async listar(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
  ): Promise<{ documentos: DocumentoOrg[] }> {
    return {
      documentos: await this.repositorio.listar(user.empresaId, organizacaoId),
    };
  }

  /** POST /repositorio-org/documentos (multipart `arquivo`) → documento criado. */
  @Post()
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async enviar(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @UploadedFile() arquivo: UploadedFileLike | undefined,
  ): Promise<{ documento: DocumentoOrg }> {
    if (!organizacaoId) {
      throw new BadRequestException('Nenhuma organização ativa.');
    }
    if (!arquivo) throw new BadRequestException('Envie um arquivo.');
    return {
      documento: await this.repositorio.enviar(
        user.empresaId,
        organizacaoId,
        user.id,
        arquivo,
      ),
    };
  }

  /** DELETE /repositorio-org/documentos/:id */
  @Delete(':id')
  async remover(
    @CurrentUser() user: AuthenticatedUser,
    @OrganizacaoAtual() organizacaoId: string | null,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    if (!organizacaoId) {
      throw new BadRequestException('Nenhuma organização ativa.');
    }
    await this.repositorio.remover(user.empresaId, organizacaoId, id);
    return { ok: true };
  }
}
