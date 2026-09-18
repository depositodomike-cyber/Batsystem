import { Module } from '@nestjs/common';
import { MarcasController } from './marcas.controller';
import { MarcasService } from './marcas.service';
import { AcessoModule } from '@/acesso/acesso.module';
import { AuthModule } from '@/auth/auth.module';

/**
 * Marcas — os guias de marca (design systems) da organização.
 *
 * `AcessoModule` entra por causa do `PermissoesGuard` usado nas rotas de
 * escrita, mesma razão de `EstruturaModule`.
 */
@Module({
  imports: [AuthModule, AcessoModule],
  controllers: [MarcasController],
  providers: [MarcasService],
})
export class MarcasModule {}
