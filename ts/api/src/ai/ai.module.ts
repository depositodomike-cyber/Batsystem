import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiConnectionsController } from './connections.controller';
import { AiCredentialsController } from './credentials.controller';
import { AiMediaConnectionsController } from './media-connections.controller';
import { AnaliseController } from './analise.controller';
import { ApresentacaoController } from './apresentacao.controller';
import { ArtigoController } from './artigo.controller';
import { AtaController } from './ata.controller';
import { PromptController } from './prompt.controller';
import { CarrosselController } from './carrossel.controller';
import { ImagemController } from './imagem.controller';
import { VideoController } from './video.controller';
import { MelhorarController } from './melhorar.controller';
import { TranscricaoController } from './transcricao.controller';
import { DocumentoController } from './documento.controller';
import { AudioController } from './audio.controller';
import { DashboardController } from './dashboard.controller';
import { InsightsController } from '@/insights/insights.controller';
import { InsightsService } from '@/insights/insights.service';
import { VaultController } from '@/vault/vault.controller';
import { VaultService } from '@/vault/vault.service';
import { VaultCategoriasService } from '@/vault/categorias.service';
import { AiService } from './ai.service';
import { AiConnectionsService } from './connections.service';
import { AiCredentialsService } from './credentials.service';
import { AiMediaConnectionsService } from './media-connections.service';
import { CryptoService } from './crypto';
import { AuthModule } from '@/auth/auth.module';
import { ConversasModule } from '@/conversas/conversas.module';
import { MemoriasModule } from '@/memorias/memorias.module';
import { UsoModule } from '@/uso/uso.module';

@Module({
  imports: [AuthModule, ConversasModule, MemoriasModule, UsoModule],
  controllers: [
    AiController,
    AiConnectionsController,
    AiCredentialsController,
    AiMediaConnectionsController,
    AnaliseController,
    ApresentacaoController,
    ArtigoController,
    AtaController,
    CarrosselController,
    PromptController,
    ImagemController,
    VideoController,
    MelhorarController,
    TranscricaoController,
    DocumentoController,
    AudioController,
    DashboardController,
    InsightsController,
    VaultController,
  ],
  providers: [
    AiService,
    AiConnectionsService,
    AiCredentialsService,
    AiMediaConnectionsService,
    CryptoService,
    InsightsService,
    VaultService,
    VaultCategoriasService,
  ],
})
export class AiModule {}
