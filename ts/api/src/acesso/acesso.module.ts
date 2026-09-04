import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissoesGuard } from './permissoes.guard';
import { AuthModule } from '@/auth/auth.module';

/**
 * Acesso — roles e permissões da plataforma (V3).
 *
 * Exporta o service e o guard porque o módulo de Membros usa os dois para
 * aplicar permissão nas próprias rotas.
 */
@Module({
  imports: [AuthModule],
  controllers: [RolesController],
  providers: [RolesService, PermissoesGuard],
  exports: [RolesService, PermissoesGuard],
})
export class AcessoModule {}
