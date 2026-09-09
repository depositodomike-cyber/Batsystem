import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { BillingModule } from '@/billing/billing.module';
import { AuthModule } from '@/auth/auth.module';
import { AcessoModule } from '@/acesso/acesso.module';

@Module({
  // `AcessoModule` pelo `PermissoesGuard` das rotas de convite.
  imports: [BillingModule, AuthModule, AcessoModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
