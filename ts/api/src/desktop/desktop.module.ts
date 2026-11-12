import { Module } from '@nestjs/common';
import { AcessoModule } from '@/acesso/acesso.module';
import { AuthModule } from '@/auth/auth.module';
import { AgenteDesktopGuard } from './agente.guard';
import { AgenteDesktopController, DesktopController } from './desktop.controller';
import { DispositivosService } from './dispositivos.service';
import { GatewayDesktopService } from './gateway.service';
import { PoliticaDesktopService } from './politica-desktop.service';

/**
 * Controle do computador pelo Oracle: pareamento, política (Permission
 * Manager), Runtime Security Layer (gateway) e o canal com o Oracle Local
 * Agent. As ferramentas que o orquestrador oferece ao modelo ficam em
 * `orquestrador/ferramentas/desktop.ts` e só falam com o gateway.
 * Docs: docs/security/ (threat model, requisitos SR-xx, achados, gates).
 */
@Module({
  imports: [AuthModule, AcessoModule],
  controllers: [DesktopController, AgenteDesktopController],
  providers: [GatewayDesktopService, PoliticaDesktopService, DispositivosService, AgenteDesktopGuard],
  exports: [GatewayDesktopService, PoliticaDesktopService],
})
export class DesktopModule {}
