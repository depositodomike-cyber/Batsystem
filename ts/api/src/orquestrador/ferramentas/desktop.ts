// Ferramentas DESKTOP do orquestrador: o Oracle agindo no computador do
// usuário através do Oracle Local Agent. Aqui fica só a forma (esquema,
// descrição, resumo); a autorização é do GatewayDesktopService, que é o único
// caminho até o agente (SR-09a) e refaz tudo de forma determinística.
// Esquemas `.strict()`: o modelo não consegue injetar campos de controle.
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import { GatewayDesktopService, redigirParametros, VALIDADE_APROVACAO_DESKTOP_MS } from '@/desktop/gateway.service';
import { PoliticaDesktopService } from '@/desktop/politica-desktop.service';
import type { Operacao } from '@/desktop/risco-desktop';
import {
  definirFerramenta,
  ErroFerramenta,
  type AvaliacaoDinamica,
  type ContextoFerramenta,
  type Ferramenta,
} from './ferramenta';

interface App {
  id: string;
  nome: string;
  alvo: string;
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Resolve "figma" → app autorizado. Só entre os AUTORIZADOS (nunca um caminho). */
export function resolverApp(pedido: string, apps: App[]): App | null {
  const p = normalizar(pedido);
  if (!p) return null;
  const porId = apps.find((a) => a.id === pedido);
  if (porId) return porId;
  const exato = apps.filter((a) => normalizar(a.nome) === p);
  if (exato.length === 1) return exato[0];
  const contem = apps.filter((a) => normalizar(a.nome).includes(p) || p.includes(normalizar(a.nome)));
  return contem.length === 1 ? contem[0] : null;
}

const SAIDA_REDIGIDA = (conteudo: string) => `[resultado com ${conteudo.split('\n').length} linha(s) omitido do histórico por privacidade]`;

type Ctx = ContextoFerramenta & { execucao: { id: string; etapaId: string } };

@Injectable()
export class FerramentasDesktop {
  constructor(
    private readonly gateway: GatewayDesktopService,
    private readonly politicas: PoliticaDesktopService,
    private readonly prisma: PrismaService,
  ) {}

  /** SR-51: sem liberação, as ferramentas nem existem para o modelo. */
  todas(): Ferramenta[] {
    if (!this.gateway.liberacao().ativo) return [];
    return [
      this.op('listar_processos', 'desktop_listar_processos',
        'Lista os aplicativos abertos no computador do usuário (nome do processo; título da janela só para apps marcados como observáveis).',
        z.object({}).strict(), () => 'Ver os aplicativos abertos'),
      this.op('listar_janelas', 'desktop_listar_janelas',
        'Lista as janelas abertas no computador do usuário (para organizar janelas).',
        z.object({}).strict(), () => 'Ver as janelas abertas'),
      this.listarAplicativos(),
      this.op('buscar_arquivos', 'desktop_buscar_arquivos',
        'Procura arquivos por nome dentro de um diretório autorizado do computador do usuário. Devolve nome, caminho, tamanho e data de modificação (nunca o conteúdo). Use ordenar="modificado" para "o último documento que editei".',
        z.object({
          diretorio: z.string().min(3).max(400).describe('Caminho absoluto de um diretório autorizado (ex.: C:\\Users\\nome\\Documents).'),
          nome: z.string().max(100).optional().describe('Trecho do nome do arquivo (sem curingas).'),
          extensoes: z.array(z.string().regex(/^\.[a-z0-9]{1,8}$/)).max(10).optional(),
          ordenar: z.enum(['modificado', 'nome']).default('modificado'),
          limite: z.number().int().min(1).max(200).default(20),
        }).strict(),
        (e) => `Procurar arquivos${e.nome ? ` com "${e.nome}"` : ''} em ${e.diretorio}`),
      this.porApp('abrir_aplicativo', 'desktop_abrir_aplicativo',
        'Abre um aplicativo AUTORIZADO no computador do usuário (ex.: "Figma", "Spotify"). Use o nome como o usuário falou.',
        (nome) => `Abrir o aplicativo "${nome}"`),
      this.porApp('fechar_aplicativo', 'desktop_fechar_aplicativo',
        'Fecha (de forma normal, como clicar no X) um aplicativo autorizado no computador do usuário. Sempre pede confirmação.',
        (nome) => `Fechar o aplicativo "${nome}" (trabalho não salvo pode pedir confirmação no próprio app)`),
      this.op('abrir_url', 'desktop_abrir_url',
        'Abre um endereço http(s) no navegador padrão do usuário. Para pesquisar, monte a URL de busca (ex.: https://www.google.com/search?q=...).',
        z.object({ url: z.string().min(8).max(2048).describe('URL completa, http ou https.') }).strict(),
        (e) => `Abrir no navegador: ${e.url}`),
      this.op('abrir_documento', 'desktop_abrir_documento',
        'Abre um documento (pdf, docx, xlsx, pptx, imagens, etc.) de um diretório autorizado no aplicativo padrão. Executáveis e scripts não podem ser abertos.',
        z.object({ caminho: z.string().min(3).max(400).describe('Caminho absoluto do arquivo.') }).strict(),
        (e) => `Abrir o documento ${e.caminho}`),
      this.organizarJanelas(),
      this.op('controlar_midia', 'desktop_controlar_midia',
        'Controla a mídia em reprodução no computador (tocar/pausar, próxima, anterior, parar, volume).',
        z.object({ acao: z.enum(['tocar_pausar', 'proxima', 'anterior', 'parar', 'volume_mais', 'volume_menos', 'mudo']) }).strict(),
        (e) => `Mídia: ${e.acao.replace('_', ' ')}`),
      this.op('criar_pasta', 'desktop_criar_pasta',
        'Cria uma pasta dentro de um diretório autorizado.',
        z.object({ caminho: z.string().min(3).max(400) }).strict(),
        (e) => `Criar a pasta ${e.caminho}`),
      this.op('mover_arquivo', 'desktop_mover_arquivo',
        'Move (ou renomeia, mantendo a extensão) um arquivo entre diretórios autorizados. Não apaga nada.',
        z.object({
          origem: z.string().min(3).max(400),
          destino: z.string().min(3).max(400).describe('Caminho completo do arquivo no destino (inclui o nome).'),
          sobrescrever: z.boolean().default(false),
        }).strict(),
        (e) => `Mover ${e.origem} → ${e.destino}${e.sobrescrever ? ' (SOBRESCREVENDO o existente)' : ''}`),
      this.op('energia', 'desktop_energia',
        'Desliga, reinicia, encerra a sessão ou bloqueia o computador (com 30 segundos de aviso), ou cancela um desligamento agendado. Sempre pede confirmação.',
        z.object({ acao: z.enum(['desligar', 'reiniciar', 'encerrar_sessao', 'bloquear', 'cancelar_desligamento']) }).strict(),
        (e) => ({ desligar: 'DESLIGAR o computador', reiniciar: 'REINICIAR o computador', encerrar_sessao: 'Encerrar a sessão do Windows', bloquear: 'Bloquear a tela', cancelar_desligamento: 'Cancelar o desligamento agendado' })[e.acao]),
    ] as Ferramenta[];
  }

  // ------------------------------------------------------------ fábricas

  private avaliarCom(op: Operacao) {
    return async (parametros: Record<string, unknown>, ctx: Ctx, detalhe?: string): Promise<AvaliacaoDinamica> => {
      const av = await this.gateway.avaliar(op, parametros, ctx);
      const motivo = av.motivos.join(' ');
      if (av.risco === 'bloqueado') {
        return { decisao: 'negar', risco: 'bloqueado', motivo: `${motivo} Não tente de novo; explique ao usuário.` };
      }
      if (av.risco === 'alto') {
        return { decisao: 'aprovar', risco: 'alto', motivo, validadeAprovacaoMs: VALIDADE_APROVACAO_DESKTOP_MS, detalhe };
      }
      return { decisao: 'permitir', risco: av.risco };
    };
  }

  private op<S extends z.ZodType<Record<string, unknown>>>(
    op: Operacao,
    nome: string,
    descricao: string,
    esquema: S,
    resumir: (e: z.output<S>) => string,
  ) {
    const avaliar = this.avaliarCom(op);
    return definirFerramenta({
      nome,
      descricao,
      esquema,
      // Estático: só a permissão. O risco real vem de `avaliar`.
      risco: 'escrita_externa',
      permissao: 'desktop.usar',
      resumir,
      redigir: (e) => redigirParametros(e as Record<string, unknown>),
      redigirSaida: SAIDA_REDIGIDA,
      avaliar: (e, ctx) => avaliar(e as Record<string, unknown>, ctx),
      executar: async (e, ctx) => {
        const entrada = e as Record<string, unknown>;
        const conteudo = await this.gateway.enviar(nome, op, entrada, entrada, ctx);
        return { conteudo };
      },
    });
  }

  /** Apps autorizados com nome e alvo (inventário do dispositivo ∩ política). */
  private async appsAutorizados(ctx: ContextoFerramenta): Promise<App[]> {
    const politica = await this.politicas.obter(ctx.user.empresaId, ctx.user.id);
    const d = await this.prisma.dispositivoDesktop.findFirst({
      where: { empresaId: ctx.user.empresaId, usuarioId: ctx.user.id, revogadoEm: null, status: { notIn: ['pendente', 'revogado'] } },
      orderBy: { ultimoContato: { sort: 'desc', nulls: 'last' } },
      select: { inventario: true },
    });
    const inv = (d?.inventario ?? []) as unknown as App[];
    return inv.filter((a) => politica.apps.includes(a.id));
  }

  private listarAplicativos() {
    return definirFerramenta({
      nome: 'desktop_listar_aplicativos',
      descricao: 'Lista os aplicativos que o usuário autorizou o Oracle a abrir e fechar neste computador.',
      esquema: z.object({}).strict(),
      risco: 'leitura',
      permissao: 'desktop.usar',
      executar: async (_e, ctx) => {
        const apps = await this.appsAutorizados(ctx);
        if (!apps.length) return { conteudo: 'Nenhum aplicativo autorizado. O usuário autoriza em Configurações > Ambiente local.' };
        return { conteudo: apps.map((a) => `- ${a.nome}`).join('\n') };
      },
    });
  }

  private porApp(op: 'abrir_aplicativo' | 'fechar_aplicativo', nome: string, descricao: string, resumir: (n: string) => string) {
    const avaliar = this.avaliarCom(op);
    const resolver = async (pedido: string, ctx: ContextoFerramenta) => {
      const apps = await this.appsAutorizados(ctx);
      const app = resolverApp(pedido, apps);
      if (!app) {
        throw new ErroFerramenta(
          apps.length
            ? `"${pedido}" não corresponde a um único aplicativo autorizado. Autorizados: ${apps.map((a) => a.nome).join(', ')}.`
            : 'Nenhum aplicativo autorizado neste computador. O usuário autoriza em Configurações > Ambiente local.',
        );
      }
      return app;
    };
    return definirFerramenta({
      nome,
      descricao,
      esquema: z.object({ aplicativo: z.string().trim().min(1).max(120).describe('Nome do aplicativo, como o usuário falou.') }).strict(),
      risco: 'escrita_externa',
      permissao: 'desktop.usar',
      // GB-10: o nome vem do modelo; no resumo ele não pode imitar a linha
      // "Programa: …" que o gateway usa como vínculo da aprovação.
      resumir: (e) => resumir(e.aplicativo.replace(/programa\s*:/gi, '').replace(/["\\:]/g, ' ').slice(0, 60).trim()),
      redigir: (e) => ({ aplicativo: e.aplicativo }),
      redigirSaida: SAIDA_REDIGIDA,
      avaliar: async (e, ctx) => {
        let app: App;
        try {
          app = await resolver(e.aplicativo, ctx);
        } catch (err) {
          return { decisao: 'negar', risco: 'bloqueado', motivo: (err as Error).message };
        }
        // GA-09: o caminho real aparece na aprovação.
        return avaliar({ aplicativoId: app.id }, ctx, `Programa: ${app.alvo}`);
      },
      executar: async (e, ctx) => {
        const app = await resolver(e.aplicativo, ctx);
        // GB-04: o programa resolvido agora tem de ser o que o usuário viu ao aprovar.
        const conteudo = await this.gateway.enviar(nome, op, e, { aplicativoId: app.id }, ctx, [`Programa: ${app.alvo}`]);
        return { conteudo };
      },
    });
  }

  private organizarJanelas() {
    const op: Operacao = 'organizar_janelas';
    const avaliar = this.avaliarCom(op);
    const esquema = z
      .object({
        layout: z.enum(['lado_a_lado', 'maximizar', 'minimizar_outras', 'restaurar']),
        aplicativos: z.array(z.string().trim().min(1).max(120)).min(1).max(2)
          .describe('Nomes dos aplicativos (2 para lado a lado; 1 para os demais).'),
      })
      .strict();
    const resolverTodos = async (nomes: string[], ctx: ContextoFerramenta) => {
      const apps = await this.appsAutorizados(ctx);
      return nomes.map((n) => {
        const a = resolverApp(n, apps);
        if (!a) throw new ErroFerramenta(`"${n}" não é um aplicativo autorizado.`);
        return a;
      });
    };
    const programas = (apps: App[]) => apps.map((a) => `Programa: ${a.alvo}`);
    return definirFerramenta({
      nome: 'desktop_organizar_janelas',
      descricao: 'Organiza janelas de aplicativos autorizados: lado a lado (2 apps), maximizar, minimizar as outras ou restaurar.',
      esquema,
      risco: 'escrita_externa',
      permissao: 'desktop.usar',
      resumir: (e) => `Organizar janelas (${e.layout.replace('_', ' ')}): ${e.aplicativos.join(', ')}`,
      redigirSaida: SAIDA_REDIGIDA,
      avaliar: async (e, ctx) => {
        try {
          const apps = await resolverTodos(e.aplicativos, ctx);
          if (e.layout === 'lado_a_lado' && apps.length !== 2) {
            return { decisao: 'negar', risco: 'bloqueado', motivo: 'Lado a lado precisa de exatamente 2 aplicativos.' };
          }
          return avaliar({ layout: e.layout, aplicativoIds: apps.map((a) => a.id) }, ctx, programas(apps).join(' · '));
        } catch (err) {
          return { decisao: 'negar', risco: 'bloqueado', motivo: (err as Error).message };
        }
      },
      executar: async (e, ctx) => {
        const apps = await resolverTodos(e.aplicativos, ctx);
        const conteudo = await this.gateway.enviar(
          'desktop_organizar_janelas', op, e, { layout: e.layout, aplicativoIds: apps.map((a) => a.id) }, ctx, programas(apps),
        );
        return { conteudo };
      },
    });
  }
}
