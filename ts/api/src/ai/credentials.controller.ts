import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiCredentialsService } from './credentials.service';
import { CreateCredentialDto } from './dto/credential.dto';
import { UNIFIED_CATALOG } from './catalogo';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiCredentialsController {
  constructor(private readonly credentials: AiCredentialsService) {}

  /**
   * GET /ai/providers → catálogo unificado (texto + imagem + vídeo), com
   * `modalities` e `models[].modality` para o front filtrar por seção.
   */
  @Get('providers')
  catalog() {
    return UNIFIED_CATALOG;
  }

  /** GET /ai/credentials → chaves do tenant (sem o valor cru). */
  @Get('credentials')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.credentials.listPublic(user.empresaId);
  }

  /** POST /ai/credentials → cadastra uma chave (provedor + chave + nome). */
  @Post('credentials')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCredentialDto,
  ) {
    return this.credentials.create(user.empresaId, dto);
  }

  /** DELETE /ai/credentials/:id → remove a chave e os modelos das filas. */
  @Delete('credentials/:id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.credentials.remove(user.empresaId, id);
    return { ok: true };
  }
}
