import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiConnectionsController } from './connections.controller';
import { AiCredentialsController } from './credentials.controller';
import { AiMediaConnectionsController } from './media-connections.controller';
import { AnaliseController } from './analise.controller';
import { ApresentacaoController } from './apresentacao.controller';
import { PlanilhaController } from './planilha.controller';
import { ArtigoController } from './artigo.controller';
import { AtaController } from './ata.controller';
import { PromptController } from './prompt.controller';
import { PromptService } from './prompt.service';
import { GeradoresTextoService } from './geradores-texto.service';
import { CarrosselController } from './carrossel.controller';
import { ImagemController } from './imagem.controller';
import { VideoController } from './video.controller';
import { MelhorarController } from './melhorar.controller';
import { TranscricaoController } from './transcricao.controller';
import { DocumentoController } from './documento.controller';
import { AudioController } from './audio.controller';
import { ChaveOpenAiService } from './audio/chave-openai';
import { DashboardController } from './dashboard.controller';
import { InsightsController } from '@/insights/insights.controller';
import { InsightsService } from '@/insights/insights.service';
import { DirecionamentosController } from '@/insights/direcionamentos.controller';
import { DirecionamentosService } from '@/insights/direcionamentos.service';
import { AcessoModule } from '@/acesso/acesso.module';
import { VaultController } from '@/vault/vault.controller';
import { VaultService } from '@/vault/vault.service';
import { VaultCategoriasService } from '@/vault/categorias.service';
import { RepositorioOrgController } from '@/repositorio-org/repositorio-org.controller';
import { RepositorioOrgService } from '@/repositorio-org/repositorio-org.service';
import { AgentesController } from '@/agentes/agentes.controller';
import { AgentesService } from '@/agentes/agentes.service';
import { PerfilController } from '@/perfil/perfil.controller';
import { PerfilService } from '@/perfil/perfil.service';
import { AiService } from './ai.service';
import { AiConnectionsService } from './connections.service';
import { AiCredentialsService } from './credentials.service';
import { AiMediaConnectionsService } from './media-connections.service';
import { CryptoService } from './crypto';
import { AuthModule } from '@/auth/auth.module';
import { ConversasModule } from '@/conversas/conversas.module';
import { MemoriasModule } from '@/memorias/memorias.module';
import { UsoModule } from '@/uso/uso.module';
import { ConectoresModule } from '@/conectores/conectores.module';
import { BriefingController } from '@/briefing/briefing.controller';
import { BriefingService } from '@/briefing/briefing.service';
import { BriefingFontesService } from '@/briefing/briefing-fontes.service';

@Module({
  imports: [AuthModule, AcessoModule, ConversasModule, MemoriasModule, UsoModule, ConectoresModule],
  controllers: [
    AiController,
    AiConnectionsController,
    AiCredentialsController,
    AiMediaConnectionsController,
    AnaliseController,
    ApresentacaoController,
    PlanilhaController,
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
    // Antes de InsightsController: as rotas estáticas de direcionamentos
    // (/ai/insights/direcionamentos...) não disputam com /ai/insights/:id/...
    DirecionamentosController,
    InsightsController,
    VaultController,
    RepositorioOrgController,
    AgentesController,
    PerfilController,
    BriefingController,
  ],
  providers: [
    AiService,
    PromptService,
    GeradoresTextoService,
    AiConnectionsService,
    AiCredentialsService,
    AiMediaConnectionsService,
    ChaveOpenAiService,
    CryptoService,
    InsightsService,
    DirecionamentosService,
    VaultService,
    VaultCategoriasService,
    RepositorioOrgService,
    AgentesService,
    PerfilService,
    BriefingService,
    BriefingFontesService,
  ],
  // Usados pelas ferramentas do orquestrador (OrquestradorModule).
  exports: [AiService, PromptService, AgentesService, RepositorioOrgService, GeradoresTextoService, ChaveOpenAiService],
})
export class AiModule {}
