import { createHash } from 'node:crypto';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { AgendaApiService, type AgendaEvento } from '@/conectores/agenda-api.service';
import { EmailApiService, type EmailItem } from '@/conectores/email-api.service';
import { PerfilService } from '@/perfil/perfil.service';
import type { PerfilDados } from '@/perfil/perfil.tipos';
import { VaultService } from '@/vault/vault.service';
import { buscarClima } from './clima';
import { buscarNoticias, type NoticiaBruta } from './noticias-rss';
import type { Clima, FonteId, FonteInfo, OperacoesCliente, Periodo } from './briefing.tipos';

/** E-mails mais antigos que isso não entram no briefing. */
const EMAIL_JANELA_MS = 48 * 3600_000;
const MAX_TEMAS_NOTICIA = 4;
const MAX_CONSULTAS_REPOSITORIO = 6;

export interface Janela {
  /** Início do dia local (ISO). */
  inicio: string;
  /** Fim de amanhã, local (ISO). */
  fim: string;
}

export interface DocBruto {
  ref: string;
  path: string;
  titulo: string;
  trecho: string;
  /** Termo de busca que achou o documento. */
  termo: string;
}

export interface FontesBriefing {
  fontes: Partial<Record<FonteId, FonteInfo>>;
  perfil: PerfilDados;
  idioma: 'pt' | 'en';
  nome: string | null;
  clima: Clima | null;
  eventos: AgendaEvento[];
  emails: EmailItem[];
  noticias: NoticiaBruta[];
  docs: DocBruto[];
  operacoes: OperacoesCliente;
  assinatura: string;
}

function agoraIso() {
  return new Date().toISOString();
}

/** Erro de conector → status da fonte (não conectado ≠ falhou). */
function statusDoErro(err: unknown): FonteInfo {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof HttpException && /não foi autorizado|expirou|reautorizar/i.test(msg)) {
    return { status: 'desconectado', mensagem: msg };
  }
  return { status: 'erro', mensagem: msg.slice(0, 200) };
}

/**
 * Camada de agregação do Resumo Matinal: consulta as fontes que já existem
 * (conectores Google, Perfil, Repositório) e as externas (clima, notícias),
 * cada uma isolada — uma fonte fora do ar vira um aviso, não um erro geral.
 */
@Injectable()
export class BriefingFontesService {
  private readonly logger = new Logger(BriefingFontesService.name);

  constructor(
    private readonly agenda: AgendaApiService,
    private readonly email: EmailApiService,
    private readonly perfil: PerfilService,
    private readonly vault: VaultService,
  ) {}

  /**
   * Agenda + Gmail DESTE usuário (o que muda ao longo do dia) e a assinatura
   * deles. As conexões são pessoais: cada briefing lê só as do seu dono.
   */
  async conectores(empresaId: string, usuarioId: string, janela: Janela) {
    const fontes: Partial<Record<FonteId, FonteInfo>> = {};
    const [ev, em] = await Promise.allSettled([
      this.agenda.listUpcoming(empresaId, usuarioId, 'google-calendar', 60, janela),
      this.email.listInbox(empresaId, usuarioId, 'gmail', 30),
    ]);
    let eventos: AgendaEvento[] = [];
    let emails: EmailItem[] = [];
    if (ev.status === 'fulfilled') {
      eventos = ev.value.filter((e) => !e.cancelado);
      fontes.agenda = { status: 'ok', atualizadoEm: agoraIso() };
    } else fontes.agenda = statusDoErro(ev.reason);
    if (em.status === 'fulfilled') {
      const limite = Date.now() - EMAIL_JANELA_MS;
      emails = em.value.filter((e) => new Date(e.data).getTime() >= limite);
      fontes.email = { status: 'ok', atualizadoEm: agoraIso() };
    } else fontes.email = statusDoErro(em.reason);
    const assinatura = createHash('sha1')
      .update(
        JSON.stringify({
          a: eventos.map((e) => `${e.id}|${e.inicio}|${e.titulo}`).sort(),
          e: emails.map((e) => e.id).sort(),
        }),
      )
      .digest('hex');
    return { fontes, eventos, emails, assinatura };
  }

  async coletar(
    empresaId: string,
    usuarioId: string,
    repositorioId: string | null,
    janela: Janela,
    fuso: string,
    _periodo: Periodo,
    operacoes: OperacoesCliente,
  ): Promise<FontesBriefing> {
    const [conn, perfilRes] = await Promise.all([
      this.conectores(empresaId, usuarioId, janela),
      this.perfil.obter(empresaId, usuarioId).catch(() => null),
    ]);
    const fontes = { ...conn.fontes };
    const perfil: PerfilDados = perfilRes?.dados ?? {};
    fontes.perfil = perfilRes?.atualizadoEm
      ? { status: 'ok', atualizadoEm: perfilRes.atualizadoEm.toISOString() }
      : { status: 'sem-config', mensagem: 'Perfil Pessoal ainda não preenchido.' };

    const b = perfil.basico;
    const idiomaPerfil = (perfil.comunicacao?.idiomaResposta || b?.idiomaPrincipal || '').toLowerCase();
    const idioma: 'pt' | 'en' = /^(en|ingl)/.test(idiomaPerfil) ? 'en' : 'pt';
    const nome = (b?.nomePreferido || b?.nomeCompleto?.split(/\s+/)[0] || '').trim() || null;

    // ---- operações (vêm do navegador) ----
    const ops: OperacoesCliente = {
      tarefas: (operacoes.tarefas ?? []).slice(0, 40),
      projetos: (operacoes.projetos ?? []).slice(0, 20),
    };
    fontes.operacoes = { status: 'ok', atualizadoEm: agoraIso() };

    // ---- temas: interesses + objetivos ativos ----
    const objetivosAtivos = (perfil.objetivos?.itens ?? []).filter(
      (o) => o.titulo && !/conclu|abandon|cancel/i.test(o.status || ''),
    );
    const temas = [
      ...(perfil.interesses?.itens ?? [])
        .filter((i) => i.nome && i.tipo !== 'hobby')
        .map((i) => i.nome),
      ...objetivosAtivos.map((o) => o.titulo),
    ]
      .map((t) => t.trim())
      .filter((t, i, arr) => t && arr.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i)
      .slice(0, MAX_TEMAS_NOTICIA);

    // ---- termos do Repositório: eventos, projetos, objetivos ----
    const termos = [
      ...conn.eventos.map((e) => e.titulo),
      ...(ops.projetos ?? []).map((p) => p.nome),
      ...objetivosAtivos.map((o) => o.titulo),
    ]
      .map((t) => t.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim())
      .filter((t, i, arr) => t.length >= 4 && arr.indexOf(t) === i)
      .slice(0, MAX_CONSULTAS_REPOSITORIO);

    const cidade = b?.cidade?.trim();
    const [climaRes, noticiasRes, docsRes] = await Promise.allSettled([
      cidade ? buscarClima({ cidade, estado: b?.estado, pais: b?.pais }, idioma, fuso) : Promise.resolve(null),
      temas.length ? buscarNoticias(temas, idioma) : Promise.resolve({ noticias: [], falhas: 0 }),
      this.buscarDocs(empresaId, repositorioId, termos),
    ]);

    let clima: Clima | null = null;
    if (!cidade) fontes.clima = { status: 'sem-config', mensagem: 'Defina sua cidade no Perfil Pessoal.' };
    else if (climaRes.status === 'fulfilled' && climaRes.value) {
      clima = climaRes.value;
      fontes.clima = { status: 'ok', atualizadoEm: agoraIso() };
    } else {
      fontes.clima = {
        status: 'erro',
        mensagem: climaRes.status === 'rejected' ? 'Serviço de clima indisponível.' : `Cidade "${cidade}" não encontrada.`,
      };
    }

    let noticias: NoticiaBruta[] = [];
    if (!temas.length) {
      fontes.noticias = { status: 'sem-config', mensagem: 'Cadastre interesses no Perfil Pessoal para receber notícias.' };
    } else if (noticiasRes.status === 'fulfilled' && noticiasRes.value.falhas < temas.length) {
      noticias = noticiasRes.value.noticias;
      fontes.noticias = { status: 'ok', atualizadoEm: agoraIso() };
    } else {
      fontes.noticias = { status: 'erro', mensagem: 'Google Notícias indisponível no momento.' };
    }

    let docs: DocBruto[] = [];
    if (!repositorioId) fontes.repositorio = { status: 'sem-config', mensagem: 'Nenhum Repositório ativo.' };
    else if (docsRes.status === 'fulfilled') {
      docs = docsRes.value;
      fontes.repositorio = { status: 'ok', atualizadoEm: agoraIso() };
    } else fontes.repositorio = { status: 'erro', mensagem: 'Busca no Repositório falhou.' };

    return {
      fontes,
      perfil,
      idioma,
      nome,
      clima,
      eventos: conn.eventos,
      emails: conn.emails,
      noticias,
      docs,
      operacoes: ops,
      assinatura: conn.assinatura,
    };
  }

  /** Consultas pontuais ao índice do Repositório — nunca o Repositório inteiro. */
  private async buscarDocs(empresaId: string, repositorioId: string | null, termos: string[]): Promise<DocBruto[]> {
    if (!repositorioId || !termos.length) return [];
    const res = await Promise.all(
      termos.map((t) =>
        this.vault
          .search(empresaId, repositorioId, t, 2, { semFallback: true })
          .then((hits) => hits.map((h) => ({ ...h, termo: t })))
          .catch(() => []),
      ),
    );
    const vistos = new Set<string>();
    const docs: DocBruto[] = [];
    for (const h of res.flat()) {
      // Cópias do Perfil Pessoal no índice não são "documentos relacionados".
      if (vistos.has(h.path) || h.path.startsWith('Personal/Profile/')) continue;
      vistos.add(h.path);
      docs.push({
        ref: `d${docs.length + 1}`,
        path: h.path,
        titulo: h.titulo,
        trecho: (h.conteudo || '').replace(/\s+/g, ' ').slice(0, 280),
        termo: h.termo,
      });
    }
    return docs.slice(0, 10);
  }
}
