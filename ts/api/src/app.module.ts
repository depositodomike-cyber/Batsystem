import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CompaniesModule } from './companies/companies.module';
import { AiModule } from './ai/ai.module';
import { SquadsModule } from './squads/squads.module';
import { MemoriasModule } from './memorias/memorias.module';
import { ConversasModule } from './conversas/conversas.module';
import { ConectoresModule } from './conectores/conectores.module';
import { McpModule } from './mcp/mcp.module';
import { UsoModule } from './uso/uso.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limit global por IP; endpoints sensíveis (login/cadastro) têm
    // limites mais estritos via @Throttle nos próprios controllers.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    BillingModule,
    CompaniesModule,
    AiModule,
    SquadsModule,
    MemoriasModule,
    ConversasModule,
    ConectoresModule,
    McpModule,
    UsoModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
