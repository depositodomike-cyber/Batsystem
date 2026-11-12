import { Module } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { AuthModule } from '@/auth/auth.module';
import { AcessoModule } from '@/acesso/acesso.module';
import { ConversasModule } from '@/conversas/conversas.module';
import { FerramentasLeitura } from './ferramentas/leitura';
import { FerramentasEscrita } from './ferramentas/escrita';
import { FerramentasGeracao } from './ferramentas/geracao';
import { FerramentasConectores } from './ferramentas/conectores';
import { FerramentasWeb } from './ferramentas/web';
import { ConectoresModule } from '@/conectores/conectores.module';
import { PoliticaExecucaoService } from './politica.service';
import { RevisorSegurancaService } from './revisor.service';
import { RegistroFerramentasService } from './ferramentas/registro.service';
import { RoteadorService } from './roteador.service';
import { PlanejadorService } from './planejador.service';
import { ExecutorService } from './executor.service';
import { AuditoriaService } from './auditoria.service';
import { OrquestradorService } from './orquestrador.service';
import { OrquestradorController } from './orquestrador.controller';

/**
 * Orquestrador do Oracle: roteia o pedido (direto ou planejado), planeja,
 * executa ferramentas sob a política de execução (leituras direto, escritas
 * só com aprovação) e grava execução, etapas, aprovações e auditoria.
 * Rotas atrás da flag ORQUESTRADOR_ATIVO.
 */
@Module({
  imports: [AiModule, AuthModule, AcessoModule, ConversasModule, ConectoresModule],
  controllers: [OrquestradorController],
  providers: [
    FerramentasLeitura,
    FerramentasEscrita,
    FerramentasGeracao,
    FerramentasConectores,
    FerramentasWeb,
    RegistroFerramentasService,
    PoliticaExecucaoService,
    RevisorSegurancaService,
    RoteadorService,
    PlanejadorService,
    ExecutorService,
    AuditoriaService,
    OrquestradorService,
  ],
  exports: [RegistroFerramentasService],
})
export class OrquestradorModule {}
