import { Module } from '@nestjs/common';
import { AcessoModule } from '@/acesso/acesso.module';
import { AuthModule } from '@/auth/auth.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

/**
 * Templates de apresentação da organização. `AcessoModule` pelo
 * `PermissoesGuard` das rotas de escrita, como em MarcasModule.
 */
@Module({
  imports: [AuthModule, AcessoModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}
