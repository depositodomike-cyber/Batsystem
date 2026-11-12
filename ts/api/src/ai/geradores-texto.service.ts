import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { buildMelhorarUser, parseMelhorado, SYSTEM_MELHORAR, type Melhorado } from './melhorar/prompts';
import { buildAtaUser, parseAta, SYSTEM_ATA, SYSTEM_ATA_MEMORIA, type Ata } from './ata/prompts';
import { buildArtigoUser, parseArtigo, SYSTEM_ARTIGO, type Artigo } from './artigo/prompts';
import { designBrief, parseDesign } from './design/design';
import { MemoriasService } from '@/memorias/memorias.service';
import { VaultService } from '@/vault/vault.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Geradores de texto do AI Studio (melhorar, ata, artigo), fora do HTTP: os
 * controllers só leem a requisição e delegam; o orquestrador usa os mesmos
 * métodos como ferramentas. A lógica é a que estava nos controllers.
 */
@Injectable()
export class GeradoresTextoService {
  private readonly logger = new Logger(GeradoresTextoService.name);

  constructor(
    private readonly ai: AiService,
    private readonly vault: VaultService,
    private readonly memorias: MemoriasService,
  ) {}

  /** Alvos dos [[wikilinks]] do bloco "Conexões no Vault". Nunca lança. */
  private async titulosVault(
    user: AuthenticatedUser,
    repositorioId: string | null,
    consulta: string,
  ): Promise<string[]> {
    try {
      return await this.vault.titulos(user.empresaId, repositorioId, consulta, 40);
    } catch (err) {
      this.logger.warn(`Falha ao carregar títulos do Vault: ${String(err)}`);
      return [];
    }
  }

  /** Reescreve um texto (mais claro/forte), sem mudar o sentido. */
  async melhorar(
    user: AuthenticatedUser,
    repositorioId: string | null,
    p: { texto?: string; instrucoes?: string; design?: unknown },
  ): Promise<Melhorado> {
    const texto = (p.texto || '').trim();
    if (!texto) throw new BadRequestException('Cole um texto para melhorar.');
    // Busca as notas do vault pelo próprio texto (o começo já basta para achar os assuntos).
    const titulosVault = await this.titulosVault(user, repositorioId, texto.slice(0, 1000));
    const userPrompt =
      designBrief(parseDesign(p.design)) +
      buildMelhorarUser(texto, (p.instrucoes || '').trim(), titulosVault);
    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_MELHORAR, userPrompt, 4000);
    return parseMelhorado(text, texto);
  }

  /**
   * Cria uma ata a partir do conteúdo da reunião (já extraído do arquivo,
   * quando veio um). `memoria` = formata para a Memória (frontmatter + links).
   */
  async ata(
    user: AuthenticatedUser,
    repositorioId: string | null,
    p: { conteudo: string; instrucoes?: string; memoria: boolean; design?: unknown },
  ): Promise<Ata & { memoria: boolean }> {
    const conteudo = p.conteudo.trim();
    if (!conteudo) {
      throw new BadRequestException('Envie um arquivo ou cole o conteúdo da reunião.');
    }
    let titulosMemoria: string[] = [];
    if (p.memoria) {
      try {
        titulosMemoria = (await this.memorias.list(user.empresaId))
          .filter((m) => m.active)
          .map((m) => m.title)
          .slice(0, 200);
      } catch (err) {
        this.logger.warn(`Falha ao carregar títulos da memória: ${String(err)}`);
      }
    }
    // Independem da opção "Memória": a ata pode ser salva na pasta da Memória de qualquer forma.
    const titulosVault = await this.titulosVault(user, repositorioId, conteudo.slice(0, 1000));

    const system = p.memoria ? SYSTEM_ATA_MEMORIA : SYSTEM_ATA;
    const userPrompt =
      designBrief(parseDesign(p.design)) +
      buildAtaUser({
        conteudo,
        instrucoes: (p.instrucoes || '').trim(),
        memoria: p.memoria,
        titulosMemoria,
        titulosVault,
      });
    const { text } = await this.ai.completar(user.empresaId, user.id, system, userPrompt, 8000);
    return { ...parseAta(text), memoria: p.memoria };
  }

  /** Gera (ou refina) um artigo em Markdown. */
  async artigo(
    user: AuthenticatedUser,
    repositorioId: string | null,
    p: {
      tema?: string;
      contexto?: string;
      fontes?: string[];
      referencia?: string;
      ajuste?: string;
      anterior?: Artigo | null;
      design?: unknown;
    },
  ): Promise<Artigo> {
    const tema = (p.tema || '').trim();
    if (!tema) throw new BadRequestException('Descreva o tema do artigo.');

    // Referência: "memoria" (diretrizes ativas do tenant) + texto do cliente.
    let referencia = (p.referencia || '').trim();
    if (Array.isArray(p.fontes) && p.fontes.includes('memoria')) {
      try {
        const itens = (await this.memorias.list(user.empresaId)).filter((m) => m.active).slice(0, 60);
        if (itens.length) {
          const bloco =
            '### Memória (diretrizes ativas)\n' + itens.map((m) => `- ${m.title}: ${m.content}`).join('\n');
          referencia = referencia ? `${bloco}\n\n${referencia}` : bloco;
        }
      } catch (err) {
        this.logger.warn(`Falha ao carregar memórias: ${String(err)}`);
      }
    }

    // Buscados pelo tema/contexto para trazer os assuntos vizinhos.
    const titulosVault = await this.titulosVault(
      user,
      repositorioId,
      `${tema}\n${(p.contexto || '').trim()}`,
    );
    const userPrompt =
      designBrief(parseDesign(p.design)) +
      buildArtigoUser({
        tema,
        contexto: (p.contexto || '').trim(),
        referencia,
        ajuste: (p.ajuste || '').trim(),
        anterior: p.anterior ?? null,
        titulosVault,
      });
    const { text } = await this.ai.completar(user.empresaId, user.id, SYSTEM_ARTIGO, userPrompt, 6000);
    return parseArtigo(text, tema);
  }
}
