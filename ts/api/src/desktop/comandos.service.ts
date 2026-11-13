import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { GatewayDesktopService } from './gateway.service';
import { chamadaDoComando, melhorComando, type Intencao } from './intencao';
import { paraEfetiva, PoliticaDesktopService } from './politica-desktop.service';
import { OPERACOES, type Operacao } from './risco-desktop';
import { APELIDOS_EMBUTIDOS, resolverAlvo, type AppConhecido } from './vocabulario';

/** O que o orquestrador faz com um pedido que parece comando de computador. */
export type DecisaoComando =
  /** Não é comando: segue o fluxo normal (resposta direta ou plano). */
  | null
  /** Pedido de arquivos/documentos: vai para o planejador, que tem as ferramentas desktop. */
  | { acao: 'planejar' }
  /** Não dá para executar agora: responde na hora, sem pesquisa, com o motivo. */
  | { acao: 'responder'; resposta: string }
  /** Executa pelo caminho rápido (comando direto, SR-06d). */
  | { acao: 'executar'; texto: string; entendido: string; chamada: { nome: string; entrada: Record<string, unknown> } };

/** "Figma", "Claude"… — catálogo usado só para entender o pedido quando não há inventário. */
const CATALOGO: AppConhecido[] = Object.keys(APELIDOS_EMBUTIDOS).map((n) => ({
  id: `catalogo:${n}`,
  nome: n.replace(/\b\w/g, (c) => c.toUpperCase()),
  alvo: '',
}));

const OPERACAO_DA_FERRAMENTA: Record<string, Operacao> = {
  desktop_abrir_aplicativo: 'abrir_aplicativo',
  desktop_fechar_aplicativo: 'fechar_aplicativo',
  desktop_abrir_url: 'abrir_url',
  desktop_controlar_midia: 'controlar_midia',
  desktop_energia: 'energia',
  desktop_organizar_janelas: 'organizar_janelas',
};

const VERBO: Record<string, string> = {
  abrir_aplicativo: 'abrir',
  fechar_aplicativo: 'fechar',
  maximizar: 'maximizar',
  restaurar: 'restaurar',
  minimizar_outras: 'deixar só',
  lado_a_lado: 'colocar lado a lado',
};
const MIDIA: Record<string, string> = {
  tocar_pausar: 'tocar/pausar a música',
  proxima: 'pular para a próxima música',
  anterior: 'voltar para a música anterior',
  parar: 'parar a música',
  volume_mais: 'aumentar o volume',
  volume_menos: 'abaixar o volume',
  mudo: 'silenciar o som',
};
const ENERGIA: Record<string, string> = {
  desligar: 'desligar o computador',
  reiniciar: 'reiniciar o computador',
  bloquear: 'bloquear a tela',
  encerrar_sessao: 'encerrar a sessão do Windows',
};

/**
 * Comandos de computador ditos ou digitados ao Oracle. Interpreta de forma
 * determinística (`intencao.ts`), corrige o nome do app contra o inventário
 * real (`vocabulario.ts`) e checa se dá para executar. NÃO autoriza nada:
 * a execução continua pelo executor → política → gateway.
 */
@Injectable()
export class ComandosDesktopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayDesktopService,
    private readonly politicas: PoliticaDesktopService,
  ) {}

  private async contexto(user: AuthenticatedUser) {
    const politica = await this.politicas.obter(user.empresaId, user.id);
    const d = await this.prisma.dispositivoDesktop.findFirst({
      where: { empresaId: user.empresaId, usuarioId: user.id, revogadoEm: null, status: { notIn: ['pendente', 'revogado'] } },
      orderBy: { ultimoContato: { sort: 'desc', nulls: 'last' } },
      select: { inventario: true },
    });
    const inventario = (d?.inventario ?? []) as unknown as AppConhecido[];
    const apelidos = (politica.apelidos ?? {}) as Record<string, string[]>;
    return {
      politica: paraEfetiva(politica),
      inventario,
      autorizados: inventario.filter((a) => politica.apps.includes(a.id)),
      apelidos,
    };
  }

  async interpretar(
    user: AuthenticatedUser,
    texto: string,
    alternativas: string[] = [],
    origem?: 'texto' | 'voz' | 'voz_ativacao',
  ): Promise<DecisaoComando> {
    const c = await this.contexto(user);
    const conhecidos = c.inventario.length ? c.inventario : CATALOGO;
    const reconhecido = (alvo: string) => resolverAlvo(alvo, conhecidos, c.apelidos).app !== null;
    // GC-01: alternativas só existem para ditado; texto digitado não as usa.
    const porVoz = origem === 'voz' || origem === 'voz_ativacao';
    const melhor = melhorComando(texto, porVoz ? alternativas : [], reconhecido);
    if (!melhor) return null;
    const { intencao } = melhor;
    if (intencao.tipo === 'arquivos') return { acao: 'planejar' };

    // Alvos de app: corrige o nome contra o inventário (ou o catálogo).
    const alvos = intencao.tipo === 'app' ? [intencao.alvo] : intencao.tipo === 'janelas' ? intencao.alvos : [];
    const resolvidos = alvos.map((a) => ({ falado: a, r: resolverAlvo(a, conhecidos, c.apelidos) }));
    const naoReconhecido = resolvidos.find((x) => !x.r.app);
    if (naoReconhecido) {
      // "abrir firma" sem nenhum app parecido e sem falar em app: não é comando (ex.: abrir uma empresa).
      const explicito = intencao.tipo === 'app' ? intencao.explicito : true;
      if (!explicito && !naoReconhecido.r.sugestoes.length) return null;
      const sug = naoReconhecido.r.sugestoes.map((s) => `**${s.nome}**`).join(' ou ');
      return {
        acao: 'responder',
        resposta: sug
          ? `Não tenho certeza de qual aplicativo é "${naoReconhecido.falado}". Você quis dizer ${sug}?`
          : `Não encontrei "${naoReconhecido.falado}" entre os aplicativos deste computador. Veja a lista em Configurações > Organização > Ambiente local.`,
      };
    }

    // GC-05: comando direto exige alvo curto ("abrir o Figma"). Se sobrar
    // instrução ("executa o claude e apaga tudo"), não executa só metade em
    // silêncio: segue o fluxo normal, que entende o pedido inteiro.
    const sobrou = resolvidos.some((x) => x.falado.split(' ').length > x.r.app!.nome.split(' ').length + 2);
    if (sobrou) return null;

    const entendido = this.descrever(intencao, resolvidos.map((x) => x.r.app!.nome));
    const chamada = chamadaDoComando(intencao)!;
    const op = OPERACAO_DA_FERRAMENTA[chamada.nome];

    // Pré-checagem: responde na hora, com o motivo exato, em vez de pesquisar.
    const motivo = await this.gateway.indisponibilidade(user.empresaId, user.id);
    if (motivo) {
      return { acao: 'responder', resposta: `Entendi: **${entendido}**. Mas não consigo agir no computador agora: ${motivo}` };
    }
    const categoria = OPERACOES[op].categoria;
    if (!c.politica.permissoes[categoria]) {
      return {
        acao: 'responder',
        resposta: `Entendi: **${entendido}**. Essa ação está desligada: libere "${categoria}" em Configurações > Organização > Ambiente local.`,
      };
    }
    const naoAutorizado = resolvidos.find((x) => !c.autorizados.some((a) => a.id === x.r.app!.id));
    if (naoAutorizado) {
      return {
        acao: 'responder',
        resposta:
          `Entendi: **${entendido}**. Encontrei **${naoAutorizado.r.app!.nome}** neste computador, mas ele ainda não está autorizado. ` +
          'Autorize em Configurações > Organização > Ambiente local > Aplicativos autorizados (e confirme no ícone do Oracle na bandeja).',
      };
    }
    return { acao: 'executar', texto: melhor.texto, entendido, chamada };
  }

  private descrever(i: Intencao, nomes: string[]): string {
    switch (i.tipo) {
      case 'app':
        return `${VERBO[i.operacao]} ${nomes[0]}`;
      case 'janelas':
        return `${VERBO[i.layout]} ${nomes.join(' e ')}`;
      case 'midia':
        return MIDIA[i.acao];
      case 'energia':
        return ENERGIA[i.acao];
      case 'url':
        return `abrir ${i.rotulo}`;
      default:
        return 'executar o comando';
    }
  }
}
