import { BadRequestException, Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { buildMelhorarUser, parseMelhorado, SYSTEM_MELHORAR, type Melhorado } from './melhorar/prompts';
import { designBrief, parseDesign, type DesignSystemDto } from './design/design';
import { VaultService } from '@/vault/vault.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

interface MelhorarBody {
  texto?: string;
  instrucoes?: string;
  /** Design system da marca escolhida no AI Studio. */
  design?: DesignSystemDto;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class MelhorarController {
  private readonly logger = new Logger(MelhorarController.name);

  constructor(
    private readonly ai: AiService,
    private readonly vault: VaultService,
  ) {}

  /**
   * POST /ai/melhorar → reescreve um texto (mais claro/forte), sem mudar o
   * sentido. Body: { texto, instrucoes? }. Retorna { texto, resumo }.
   */
  @Post('melhorar')
  async melhorar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MelhorarBody,
  ): Promise<Melhorado> {
    const texto = (body.texto || '').trim();
    if (!texto) throw new BadRequestException('Cole um texto para melhorar.');
    // Alvos dos [[wikilinks]] do bloco "Conexões no Vault": busca as notas do
    // vault pelo próprio texto (o começo já basta para achar os assuntos).
    let titulosVault: string[] = [];
    try {
      titulosVault = await this.vault.titulos(user.empresaId, texto.slice(0, 1000), 40);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
    }

    const userPrompt =
      designBrief(parseDesign(body.design)) +
      buildMelhorarUser(texto, (body.instrucoes || '').trim(), titulosVault);
    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_MELHORAR, userPrompt, 4000);
    return parseMelhorado(text, texto);
  }
}
