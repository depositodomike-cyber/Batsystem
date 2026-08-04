import { Module } from '@nestjs/common';
import { ConectoresController } from './conectores.controller';
import { ConectoresService } from './conectores.service';
import { SlackController } from './slack.controller';
import { SlackOauthService } from './slack-oauth.service';
import { SlackApiService } from './slack-api.service';
import { EmailController } from './email.controller';
import { EmailApiService } from './email-api.service';
import { AgendaController } from './agenda.controller';
import { AgendaApiService } from './agenda-api.service';
import { OauthProviderService } from './oauth-provider.service';
import { OauthStateService } from './oauth-state.service';
import { CryptoService } from '@/ai/crypto';

@Module({
  controllers: [
    ConectoresController,
    SlackController,
    EmailController,
    AgendaController,
  ],
  providers: [
    ConectoresService,
    SlackOauthService,
    SlackApiService,
    OauthProviderService,
    EmailApiService,
    AgendaApiService,
    OauthStateService,
    CryptoService,
  ],
  exports: [
    ConectoresService,
    SlackApiService,
    OauthProviderService,
    EmailApiService,
    AgendaApiService,
  ],
})
export class ConectoresModule {}
