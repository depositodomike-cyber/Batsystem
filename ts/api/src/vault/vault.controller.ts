import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { VaultService, type VaultNotaRef } from './vault.service';
import { FinalizeVaultDto, SyncVaultBatchDto } from './dto/sync-vault.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Vault de notas .md do tenant (a "Memória" literal do usuário — os arquivos
 * da pasta que gera o grafo). O cliente lê os .md no navegador e sincroniza
 * aqui em lotes; o /ai/prompt recupera as notas relevantes por busca textual.
 */
@Controller('ai/vault')
@UseGuards(JwtAuthGuard)
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  /** GET /ai/vault → status da sincronização (total de notas). */
  @Get()
  async status(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ total: number }> {
    return { total: await this.vault.count(user.empresaId) };
  }

  /**
   * GET /ai/vault/notas?q=&limit= → títulos das notas para o autocomplete de
   * "[[" (conectar conteúdo à Memória). Sem `q`, devolve as mais recentes.
   */
  @Get('notas')
  async notas(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<{ notas: VaultNotaRef[] }> {
    const k = Math.min(Math.max(Number(limit) || 200, 1), 500);
    return { notas: await this.vault.buscarNotas(user.empresaId, q ?? '', k) };
  }

  /** POST /ai/vault/sync/batch → upsert de um lote (pula inalteradas). */
  @Post('sync/batch')
  async syncBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SyncVaultBatchDto,
  ): Promise<{ gravadas: number; inalteradas: number }> {
    return this.vault.syncBatch(user.empresaId, body.notas);
  }

  /** POST /ai/vault/sync/finalize → poda notas removidas da pasta. */
  @Post('sync/finalize')
  async finalize(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: FinalizeVaultDto,
  ): Promise<{ total: number; removidas: number }> {
    return this.vault.finalize(user.empresaId, body.paths);
  }
}
