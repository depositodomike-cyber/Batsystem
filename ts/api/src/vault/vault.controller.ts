import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { VaultService, type VaultNotaRef } from './vault.service';
import {
  VaultCategoriasService,
  type CategoriasDoVault,
  type ResultadoClassificacao,
} from './categorias.service';
import { FinalizeVaultDto, SyncVaultBatchDto } from './dto/sync-vault.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import { RepositorioAtual } from '@/common/repositorio-atual.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Vault de notas .md do tenant (a "Memória" literal do usuário — os arquivos
 * da pasta que gera o grafo). O cliente lê os .md no navegador e sincroniza
 * aqui em lotes; o /ai/prompt recupera as notas relevantes por busca textual.
 *
 * Tudo é escopado ao REPOSITÓRIO ativo (header X-Repositorio-Id), não só ao
 * tenant: cada repositório aponta para uma pasta própria, e sem esse recorte
 * a sincronização de um apagaria o índice dos outros.
 */
@Controller('ai/vault')
@UseGuards(JwtAuthGuard)
export class VaultController {
  constructor(
    private readonly vault: VaultService,
    private readonly categorias: VaultCategoriasService,
  ) {}

  /** GET /ai/vault → status da sincronização (total de notas). */
  @Get()
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
  ): Promise<{ total: number }> {
    return { total: await this.vault.count(user.empresaId, repositorioId) };
  }

  /**
   * GET /ai/vault/notas?q=&limit= → títulos das notas para o autocomplete de
   * "[[" (conectar conteúdo à Memória). Sem `q`, devolve as mais recentes.
   */
  @Get('notas')
  async notas(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<{ notas: VaultNotaRef[] }> {
    const k = Math.min(Math.max(Number(limit) || 200, 1), 500);
    return {
      notas: await this.vault.buscarNotas(
        user.empresaId,
        repositorioId,
        q ?? '',
        k,
      ),
    };
  }

  /** POST /ai/vault/sync/batch → upsert de um lote (pula inalteradas). */
  @Post('sync/batch')
  async syncBatch(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: SyncVaultBatchDto,
  ): Promise<{ gravadas: number; inalteradas: number }> {
    return this.vault.syncBatch(user.empresaId, repositorioId, body.notas);
  }

  /**
   * GET /ai/vault/categorias → vocabulário confirmado + mapa path→categorias.
   * É o que o grafo consome para montar os nós de categoria.
   */
  @Get('categorias')
  async categoriasDoVault(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
  ): Promise<CategoriasDoVault> {
    return this.categorias.listar(user.empresaId, repositorioId);
  }

  /**
   * POST /ai/vault/classificar → classifica a próxima FATIA de notas pendentes.
   *
   * Fatiado de propósito: a classificação faz parte do Sincronizar, mas uma
   * chamada de IA por nota num único request levaria minutos e encostaria no
   * teto da função. O cliente chama em laço até `pendentes` zerar (ou até vir
   * `erro`, que sinaliza IA indisponível e encerra o laço sem quebrar o sync).
   */
  @Post('classificar')
  async classificar(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
  ): Promise<ResultadoClassificacao> {
    return this.categorias.classificar(
      user.empresaId,
      repositorioId,
      user.id,
    );
  }

  /** POST /ai/vault/sync/finalize → poda notas removidas da pasta. */
  @Post('sync/finalize')
  async finalize(
    @CurrentUser() user: AuthenticatedUser,
    @RepositorioAtual() repositorioId: string | null,
    @Body() body: FinalizeVaultDto,
  ): Promise<{ total: number; removidas: number }> {
    return this.vault.finalize(user.empresaId, repositorioId, body.paths);
  }
}
