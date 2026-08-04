import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { UsoController } from './uso.controller';
import { UsoTokensService } from './uso-tokens.service';

/**
 * Contador de tokens da IA. Expõe `UsoTokensService` (registrar/resumo) para o
 * `AiModule` gravar o consumo, e o endpoint `GET /uso/tokens` para o header.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsoController],
  providers: [UsoTokensService],
  exports: [UsoTokensService],
})
export class UsoModule {}
