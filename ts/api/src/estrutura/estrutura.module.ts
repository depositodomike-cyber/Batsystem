import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { CargosController } from './cargos.controller';
import { CargosService } from './cargos.service';
import { AcessoModule } from '@/acesso/acesso.module';
import { AuthModule } from '@/auth/auth.module';

/**
 * Estrutura — Áreas e Cargos da organização (V4).
 *
 * `AcessoModule` entra por causa do `PermissoesGuard` usado nas rotas de
 * escrita, mesma razão de `MembrosModule`.
 *
 * Exporta os dois services porque `MembrosService` valida que a área e o
 * cargo escolhidos pertencem ao tenant e estão ativos.
 */
@Module({
  imports: [AuthModule, AcessoModule],
  controllers: [AreasController, CargosController],
  providers: [AreasService, CargosService],
  exports: [AreasService, CargosService],
})
export class EstruturaModule {}
