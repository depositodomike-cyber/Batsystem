import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { BillingModule } from '@/billing/billing.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [BillingModule, AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
