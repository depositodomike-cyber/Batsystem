// Ferramentas de GERAÇÃO de texto do orquestrador: os geradores do AI Studio
// (melhorar, ata, artigo) acessíveis no chat. Só produzem texto — não gravam
// nada nem agem fora do Oracle —, então são de risco "leitura" e não pedem
// aprovação. Salvar o resultado é outra ferramenta (salvar_no_repositorio),
// essa sim com aprovação.
//
// Exigem `ia.criar_conteudo`, a mesma permissão de gerar conteúdo na tela.
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { GeradoresTextoService } from '@/ai/geradores-texto.service';
import { definirFerramenta, type Ferramenta } from './ferramenta';

@Injectable()
export class FerramentasGeracao {
  constructor(private readonly geradores: GeradoresTextoService) {}

  todas(): Ferramenta[] {
    return [this.melhorarTexto(), this.gerarAta(), this.gerarArtigo()] as Ferramenta[];
  }

  private melhorarTexto() {
    return definirFerramenta({
      nome: 'melhorar_texto',
      descricao:
        'Reescreve um texto para ficar mais claro e forte, sem mudar o sentido. ' +
        'Use quando o usuário pedir para revisar, melhorar, reescrever ou deixar um texto mais profissional.',
      esquema: z.object({
        texto: z.string().trim().min(1).max(20_000).describe('O texto a melhorar, completo.'),
        instrucoes: z
          .string()
          .trim()
          .max(1000)
          .optional()
          .describe('Pedido específico, ex.: "mais curto", "tom formal".'),
      }),
      risco: 'leitura',
      permissao: 'ia.criar_conteudo',
      executar: async ({ texto, instrucoes }, ctx) => {
        const r = await this.geradores.melhorar(ctx.user, ctx.repositorioId, { texto, instrucoes });
        return {
          conteudo: [r.texto.trim(), r.resumo.trim() ? `O que mudou: ${r.resumo.trim()}` : '']
            .filter(Boolean)
            .join('\n\n'),
        };
      },
    });
  }

  private gerarAta() {
    return definirFerramenta({
      nome: 'gerar_ata',
      descricao:
        'Transforma anotações, transcrição ou relato de uma reunião numa ata estruturada ' +
        '(participantes, decisões, pendências com responsáveis). Passe o conteúdo da reunião inteiro.',
      esquema: z.object({
        conteudo: z
          .string()
          .trim()
          .min(1)
          .max(50_000)
          .describe('O conteúdo da reunião: anotações, transcrição ou relato.'),
        instrucoes: z.string().trim().max(1000).optional().describe('Pedido específico para a ata.'),
      }),
      risco: 'leitura',
      permissao: 'ia.criar_conteudo',
      executar: async ({ conteudo, instrucoes }, ctx) => {
        const r = await this.geradores.ata(ctx.user, ctx.repositorioId, {
          conteudo,
          instrucoes,
          memoria: false,
        });
        return { conteudo: `# ${r.titulo}\n\n${r.ata.trim()}` };
      },
    });
  }

  private gerarArtigo() {
    return definirFerramenta({
      nome: 'gerar_artigo',
      descricao:
        'Escreve um artigo completo em Markdown sobre um tema (título, subtítulo e corpo). ' +
        'Use para artigos, posts longos e textos editoriais. Passe no contexto o público, o tom ' +
        'e o material que o artigo deve usar (ex.: trechos vindos de buscar_memoria ou buscar_web).',
      esquema: z.object({
        tema: z.string().trim().min(2).max(500).describe('O tema do artigo.'),
        contexto: z
          .string()
          .trim()
          .max(20_000)
          .optional()
          .describe('Público, tom, objetivo e material de apoio.'),
        usarDiretrizes: z
          .boolean()
          .optional()
          .describe('true para incluir as diretrizes da organização como referência.'),
      }),
      risco: 'leitura',
      permissao: 'ia.criar_conteudo',
      executar: async ({ tema, contexto, usarDiretrizes }, ctx) => {
        const r = await this.geradores.artigo(ctx.user, ctx.repositorioId, {
          tema,
          contexto,
          fontes: usarDiretrizes ? ['memoria'] : [],
        });
        return {
          conteudo: [`# ${r.titulo}`, r.subtitulo.trim() ? `_${r.subtitulo.trim()}_` : '', r.conteudo.trim()]
            .filter(Boolean)
            .join('\n\n'),
        };
      },
    });
  }
}
