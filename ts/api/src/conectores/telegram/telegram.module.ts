import { Module } from '@nestjs/common';
import { AcessoModule } from '@/acesso/acesso.module';
import { AiModule } from '@/ai/ai.module';
import { AcessoConectores } from '../acesso-conectores';
import { TelegramApiService } from './telegram-api.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCaixaService } from './telegram-caixa.service';
import { TelegramController } from './telegram.controller';
import { TelegramProcessadorService } from './telegram-processador.service';
import { TelegramVinculoService } from './telegram-vinculo.service';

/**
 * Bot privado do Telegram → Notas. Módulo próprio (e não dentro de
 * ConectoresModule) porque usa a transcrição do AiModule, que já importa
 * ConectoresModule.
 */
@Module({
  imports: [AcessoModule, AiModule],
  controllers: [TelegramController],
  providers: [
    TelegramApiService,
    TelegramVinculoService,
    TelegramCaixaService,
    TelegramProcessadorService,
    TelegramBotService,
    AcessoConectores,
  ],
})
export class TelegramModule {}
