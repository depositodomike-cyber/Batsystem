import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AiService } from '@/ai/ai.service';
import { BriefingFontesService, type FontesBriefing, type Janela } from './briefing-fontes.service';
import { systemBriefing } from './briefing.prompts';
import { visiveisPara } from '@/conectores/titular';
import {
  NIVEIS,
  type BriefingDados,
  type DocRef,
  type Insight,
  type ItemAgenda,
  type ItemComunicacao,
  type ItemNoticia,
  type ItemProjeto,
  type Nivel,
  type OperacoesCliente,
  type Periodo,
  type SegmentoRoteiro,
} from './briefing.tipos';

const MAX_TOKENS = 5000;
const MAX_AMANHA = 6;
const SECOES: SegmentoRoteiro['secao'][] = [
  'abertura',
  'clima',
  'agenda',
  'comunicacoes',
  'projetos',
  'noticias',
  'insights',
  'encerramento',
];

/** Recorta o JSON da resposta (cercas ```json, preâmbulo) — mesmo padrão de apresentacao.controller. */
function extrairJson(raw: string): Record<string, unknown> | null {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const a = txt.indexOf('{');
  const b = txt.lastIndexOf('}');
  if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
  try {
    const v: unknown = JSON.parse(txt);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
const nivel = (v: unknown, padrao: Nivel = 'informativo'): Nivel =>
  NIVEIS.includes(v as Nivel) ? (v as Nivel) : padrao;
const ORDEM_NIVEL: Record<Nivel, number> = { atencao: 0, importante: 1, oportunidade: 2, informativo: 3 };

export interface GerarParams {
  empresaId: string;
  usuarioId: string;
  repositorioId: string | null;
  data: string;
  periodo: Periodo;
  fuso: string;
  janela: Janela;
  operacoes: OperacoesCliente;
}

/**
 * Inteligência do Resumo Matinal: uma única chamada ao modelo com os dados já
 * agregados (e identificados por ids curtos). A saída é validada contra a
 * entrada — ref desconhecido é descartado, e todo fato exibido (horário,
 * remetente, link, fonte, data) vem da fonte, não do texto do modelo.
 */
@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly fontesSvc: BriefingFontesService,
  ) {}

  /**
   * Retrato da configuração que alimenta o briefing: conectores autorizados,
   * chaves/modelos de IA e Perfil. Se mudar depois de o briefing do dia ser
   * gerado (ex.: conectou o Gmail, trocou a chave), o guardado fica obsoleto.
   */
  private async assinaturaConfig(empresaId: string, usuarioId: string): Promise<string> {
    const [conectores, credenciais, conexoes, perfil] = await Promise.all([
      // Só as conexões que este usuário vê (da organização + as pessoais dele):
      // conectar o Gmail de outra pessoa não invalida o seu briefing.
      this.prisma.empresaConector.findMany({
        where: visiveisPara(empresaId, usuarioId),
        select: { connectorId: true, criadoEm: true },
      }),
      this.prisma.aiCredential.findMany({ where: { empresaId }, select: { id: true, atualizadoEm: true } }),
      this.prisma.aiConnection.findMany({ where: { empresaId }, select: { id: true, atualizadoEm: true } }),
      this.prisma.perfilPessoal.findUnique({ where: { usuarioId }, select: { atualizadoEm: true } }),
    ]);
    return createHash('sha1')
      .update(
        JSON.stringify({
          c: conectores.map((c) => `${c.connectorId}|${c.criadoEm.toISOString()}`).sort(),
          k: credenciais.map((c) => `${c.id}|${c.atualizadoEm.toISOString()}`).sort(),
          m: conexoes.map((c) => `${c.id}|${c.atualizadoEm.toISOString()}`).sort(),
          p: perfil?.atualizadoEm.toISOString() ?? '',
        }),
      )
      .digest('hex');
  }

  /** Briefing guardado do dia — ou null se a configuração mudou desde então (gera de novo). */
  async obter(empresaId: string, usuarioId: string, data: string, periodo: Periodo) {
    const row = await this.prisma.briefing.findUnique({
      where: { usuarioId_data_periodo: { usuarioId, data, periodo } },
    });
    if (!row) return null;
    const dados = row.dados as unknown as BriefingDados;
    if (dados.config !== (await this.assinaturaConfig(empresaId, usuarioId))) return null;
    return dados;
  }

  /** Barato, sem IA: há agenda/e-mail novos desde o briefing guardado? */
  async verificar(empresaId: string, usuarioId: string, data: string, periodo: Periodo, janela: Janela) {
    const row = await this.prisma.briefing.findUnique({
      where: { usuarioId_data_periodo: { usuarioId, data, periodo } },
      select: { assinatura: true },
    });
    if (!row) return { novidades: false, existe: false };
    const { assinatura, fontes } = await this.fontesSvc.conectores(empresaId, usuarioId, janela);
    // Agenda/Gmail com falha (ex.: cota do Google) não é novidade: a lista vazia
    // mudaria a assinatura sem nada ter mudado de fato.
    if (fontes.agenda?.status === 'erro' || fontes.email?.status === 'erro') {
      return { novidades: false, existe: true };
    }
    return { novidades: assinatura !== row.assinatura, existe: true };
  }

  async gerar(p: GerarParams): Promise<BriefingDados> {
    const config = await this.assinaturaConfig(p.empresaId, p.usuarioId);
    const f = await this.fontesSvc.coletar(
      p.empresaId,
      p.usuarioId,
      p.repositorioId,
      p.janela,
      p.fuso,
      p.periodo,
      p.operacoes,
    );
    const base = this.montarBase(f, p);
    const entrada = this.montarEntrada(f, base, p);

    let saida: Record<string, unknown> | null = null;
    try {
      const r = await this.ai.completar(
        p.empresaId,
        p.usuarioId,
        systemBriefing(p.periodo, f.idioma),
        entrada,
        MAX_TOKENS,
        'briefing',
      );
      saida = extrairJson(r.text);
      base.dados.fontes.ia = saida
        ? { status: 'ok', atualizadoEm: new Date().toISOString() }
        : { status: 'erro', mensagem: 'A IA respondeu em um formato inválido; mostrando os dados sem análise.' };
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      this.logger.warn(`briefing sem IA: ${motivo}`);
      base.dados.fontes.ia = {
        status: 'erro',
        mensagem: `IA indisponível (${motivo.slice(0, 160)}). Mostrando os dados sem análise.`,
      };
    }

    const dados = saida ? this.aplicarIa(base, saida, f) : this.semIa(base, f);
    dados.config = config;

    await this.prisma.briefing.upsert({
      where: { usuarioId_data_periodo: { usuarioId: p.usuarioId, data: p.data, periodo: p.periodo } },
      create: {
        empresaId: p.empresaId,
        usuarioId: p.usuarioId,
        data: p.data,
        periodo: p.periodo,
        dados: dados as unknown as Prisma.InputJsonValue,
        assinatura: f.assinatura,
      },
      update: {
        dados: dados as unknown as Prisma.InputJsonValue,
        assinatura: f.assinatura,
        geradoEm: new Date(),
      },
    });
    return dados;
  }

  // ------------------------------------------------------------ montagem

  private montarBase(f: FontesBriefing, p: GerarParams) {
    const agora = Date.now();
    const fimHoje = new Date(p.janela.inicio).getTime() + 24 * 3600_000;

    const agenda: ItemAgenda[] = f.eventos.map((e, i) => ({
      ref: `ev${i + 1}`,
      evento: {
        id: e.id,
        titulo: e.titulo,
        inicio: e.inicio,
        fim: e.fim,
        diaInteiro: e.diaInteiro,
        ...(e.local ? { local: e.local } : {}),
        ...(e.link ? { link: e.link } : {}),
        ...(e.reuniaoUrl ? { reuniaoUrl: e.reuniaoUrl } : {}),
        ...(e.participantes?.length ? { participantes: e.participantes.length } : {}),
      },
      dia: new Date(e.inicio).getTime() < fimHoje ? 'hoje' : 'amanha',
      passado: new Date(e.fim).getTime() < agora,
      conflito: false,
      nivel: 'informativo',
      docs: [],
    }));
    // Conflito = sobreposição real entre compromissos com horário.
    for (const a of agenda) {
      if (a.evento.diaInteiro) continue;
      for (const b of agenda) {
        if (a === b || b.evento.diaInteiro) continue;
        if (new Date(a.evento.inicio) < new Date(b.evento.fim) && new Date(b.evento.inicio) < new Date(a.evento.fim)) {
          a.conflito = true;
        }
      }
    }

    const dados: BriefingDados = {
      versao: 1,
      periodo: p.periodo,
      data: p.data,
      fuso: p.fuso,
      geradoEm: new Date().toISOString(),
      nome: f.nome,
      idioma: f.idioma,
      fontes: f.fontes,
      clima: f.clima,
      sintese: '',
      agenda,
      comunicacoes: [],
      projetos: [],
      noticias: [],
      insights: [],
      roteiro: [],
    };

    const refs = {
      email: new Map(f.emails.map((e, i) => [`em${i + 1}`, e])),
      noticia: new Map(f.noticias.map((n, i) => [`nt${i + 1}`, n])),
      tarefa: new Map((f.operacoes.tarefas ?? []).map((t, i) => [`tf${i + 1}`, t])),
      projeto: new Map((f.operacoes.projetos ?? []).map((t, i) => [`pj${i + 1}`, t])),
      objetivo: new Map<string, NonNullable<FontesBriefing['perfil']['objetivos']>['itens'][number]>(
        (f.perfil.objetivos?.itens ?? []).filter((o) => o.titulo).map((o, i) => [`ob${i + 1}`, o]),
      ),
      doc: new Map(f.docs.map((d) => [d.ref, d])),
      agenda: new Map(agenda.map((a) => [a.ref, a])),
    };
    return { dados, refs };
  }

  private montarEntrada(f: FontesBriefing, base: ReturnType<BriefingService['montarBase']>, p: GerarParams): string {
    const loc = f.idioma === 'en' ? 'en-US' : 'pt-BR';
    const hora = (iso: string) =>
      new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', timeZone: p.fuso });
    const dataHora = (iso: string) =>
      new Date(iso).toLocaleString(loc, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: p.fuso,
      });
    const agora = new Date().toLocaleString(loc, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: p.fuso,
    });
    const L: string[] = [];
    L.push(`AGORA: ${agora} (${p.fuso})`);
    L.push(`USUÁRIO: ${f.nome ?? '(nome não informado)'}`);
    if (f.clima) {
      const c = f.clima;
      L.push(
        `CLIMA (${c.cidade}, ${c.periodo}): ${c.condicao}, ${c.temperatura}°C agora` +
          (c.minima !== undefined && c.maxima !== undefined ? `, mín ${c.minima}° / máx ${c.maxima}°` : '') +
          (c.chanceChuva !== undefined ? `, chuva ${c.chanceChuva}%` : ''),
      );
    }
    const indisponiveis = Object.entries(f.fontes)
      .filter(([, v]) => v && v.status !== 'ok')
      .map(([k, v]) => `${k}: ${v?.status}`);
    if (indisponiveis.length) L.push(`FONTES INDISPONÍVEIS (não presuma nada delas): ${indisponiveis.join('; ')}`);

    L.push('\nAGENDA (hoje e amanhã):');
    if (!base.dados.agenda.length) L.push('(nenhum compromisso)');
    for (const a of base.dados.agenda) {
      const e = a.evento;
      L.push(
        `${a.ref} [${a.dia}${a.passado ? ', já passou' : ''}${a.conflito ? ', CONFLITO de horário' : ''}] ` +
          `${e.diaInteiro ? 'dia inteiro' : `${hora(e.inicio)}–${hora(e.fim)}`} · ${e.titulo}` +
          (e.local ? ` · local: ${e.local}` : '') +
          (e.participantes ? ` · ${e.participantes} participantes` : ''),
      );
    }

    L.push('\nE-MAILS (últimas 48h, caixa de entrada):');
    if (!f.emails.length) L.push('(nenhum)');
    f.emails.forEach((m, i) => {
      L.push(
        `em${i + 1} [${dataHora(m.data)}${m.naoLido ? ', não lido' : ''}] de ${m.remetenteNome || m.remetenteEmail} <${m.remetenteEmail}> · ` +
          `assunto: ${m.assunto} · ${(m.corpo || '').replace(/\s+/g, ' ').slice(0, 400)}`,
      );
    });

    L.push('\nTAREFAS (status real do quadro do usuário):');
    if (!f.operacoes.tarefas?.length) L.push('(nenhuma)');
    (f.operacoes.tarefas ?? []).forEach((t, i) => {
      L.push(
        `tf${i + 1} · ${t.titulo} · status: ${t.status || 'sem status'}` +
          (t.prioridade ? ` · prioridade ${t.prioridade}` : '') +
          (t.prazo ? ` · prazo ${t.prazo}` : '') +
          (t.projeto ? ` · projeto ${t.projeto}` : ''),
      );
    });
    L.push('\nPROJETOS:');
    if (!f.operacoes.projetos?.length) L.push('(nenhum)');
    (f.operacoes.projetos ?? []).forEach((pj, i) =>
      L.push(`pj${i + 1} · ${pj.nome}${pj.descricao ? ` · ${pj.descricao.slice(0, 160)}` : ''}`),
    );
    L.push('\nOBJETIVOS PESSOAIS:');
    const objetivos = [...base.refs.objetivo.entries()];
    if (!objetivos.length) L.push('(nenhum)');
    for (const [ref, o] of objetivos) {
      L.push(
        `${ref} · ${o.titulo}${o.status ? ` · status: ${o.status}` : ''}${o.horizonte ? ` · prazo: ${o.horizonte}` : ''}` +
          `${o.data ? ` · data: ${o.data}` : ''}${o.descricao ? ` · ${o.descricao.slice(0, 160)}` : ''}`,
      );
    }
    const interesses = (f.perfil.interesses?.itens ?? []).map((i) => `${i.nome} (${i.tipo})`);
    if (interesses.length) L.push(`\nINTERESSES: ${interesses.join(', ')}`);

    L.push('\nNOTÍCIAS (Google Notícias, últimas 48h):');
    if (!f.noticias.length) L.push('(nenhuma)');
    f.noticias.forEach((n, i) => L.push(`nt${i + 1} [${dataHora(n.publicadoEm)} · ${n.fonte} · tema: ${n.tema}] ${n.titulo}`));

    L.push('\nDOCUMENTOS DO REPOSITÓRIO (trechos):');
    if (!f.docs.length) L.push('(nenhum)');
    for (const d of f.docs) L.push(`${d.ref} · "${d.titulo}" (achado por: ${d.termo}) · ${d.trecho}`);

    return L.join('\n');
  }

  // ------------------------------------------------------------ saída

  private docsDe(v: unknown, refs: ReturnType<BriefingService['montarBase']>['refs']): DocRef[] {
    if (!Array.isArray(v)) return [];
    const out: DocRef[] = [];
    for (const r of v) {
      const d = typeof r === 'string' ? refs.doc.get(r) : undefined;
      if (d && !out.some((x) => x.path === d.path)) out.push({ path: d.path, titulo: d.titulo });
    }
    return out.slice(0, 3);
  }

  private aplicarIa(
    base: ReturnType<BriefingService['montarBase']>,
    s: Record<string, unknown>,
    f: FontesBriefing,
  ): BriefingDados {
    const { dados, refs } = base;
    dados.sintese = str(s.sintese, 300);

    // Agenda: todos os de hoje ficam (são fatos do dia); a IA anota.
    const anotados = new Set<string>();
    for (const a of arr(s.agenda)) {
      const item = refs.agenda.get(str(a.ref, 10));
      if (!item) continue;
      anotados.add(item.ref);
      item.nivel = nivel(a.nivel);
      const nota = str(a.nota, 300);
      const prep = str(a.preparacao, 300);
      if (nota) item.nota = nota;
      if (prep) item.preparacao = prep;
      item.docs = this.docsDe(a.docs, refs);
    }
    let amanha = 0;
    dados.agenda = dados.agenda.filter((a) => {
      if (a.dia === 'hoje') return true;
      if (anotados.has(a.ref)) return true;
      return ++amanha <= MAX_AMANHA;
    });

    const comunicacoes: ItemComunicacao[] = [];
    for (const c of arr(s.comunicacoes)) {
      const ref = str(c.ref, 10);
      const m = refs.email.get(ref);
      if (!m || comunicacoes.some((x) => x.ref === ref)) continue;
      comunicacoes.push({
        ref,
        email: {
          id: m.id,
          remetenteNome: m.remetenteNome,
          remetenteEmail: m.remetenteEmail,
          assunto: m.assunto,
          data: m.data,
          link: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(m.id)}`,
        },
        nivel: nivel(c.nivel),
        resumo: str(c.resumo, 300) || m.assunto,
        motivo: str(c.motivo, 300),
        exigeAcao: c.exigeAcao === true,
      });
    }
    dados.comunicacoes = comunicacoes.slice(0, 6);

    const projetos: ItemProjeto[] = [];
    for (const pj of arr(s.projetos)) {
      const ref = str(pj.ref, 10);
      if (projetos.some((x) => x.ref === ref)) continue;
      const t = refs.tarefa.get(ref);
      const p = refs.projeto.get(ref);
      const o = refs.objetivo.get(ref);
      if (!t && !p && !o) continue;
      const situacao = str(pj.situacao, 300);
      const prox = str(pj.proximoPasso, 300);
      projetos.push({
        ref,
        tipo: t ? 'tarefa' : p ? 'projeto' : 'objetivo',
        titulo: t?.titulo ?? p?.nome ?? o?.titulo ?? '',
        nivel: nivel(pj.nivel),
        situacao,
        ...(prox ? { proximoPasso: prox } : {}),
        ...(t?.prazo ? { prazo: t.prazo } : o?.data ? { prazo: o.data } : {}),
        docs: this.docsDe(pj.docs, refs),
      });
    }
    dados.projetos = projetos.slice(0, 6);

    const noticias: ItemNoticia[] = [];
    for (const n of arr(s.noticias)) {
      const ref = str(n.ref, 10);
      const bruta = refs.noticia.get(ref);
      if (!bruta || noticias.some((x) => x.ref === ref)) continue;
      noticias.push({
        ref,
        titulo: bruta.titulo,
        fonte: bruta.fonte,
        link: bruta.link,
        publicadoEm: bruta.publicadoEm,
        resumo: str(n.resumo, 400),
        porQue: str(n.porQue, 300),
        nivel: nivel(n.nivel),
      });
    }
    dados.noticias = noticias.slice(0, 4);

    const rotulo = (ref: string): string | null => {
      const d = refs.doc.get(ref);
      if (d) return d.titulo;
      const a = refs.agenda.get(ref);
      if (a) return a.evento.titulo;
      const m = refs.email.get(ref);
      if (m) return m.assunto;
      const nt = refs.noticia.get(ref);
      if (nt) return nt.titulo;
      return refs.tarefa.get(ref)?.titulo ?? refs.projeto.get(ref)?.nome ?? refs.objetivo.get(ref)?.titulo ?? null;
    };
    const insights: Insight[] = [];
    for (const i of arr(s.insights)) {
      const origens = (Array.isArray(i.origens) ? i.origens : [])
        .filter((r): r is string => typeof r === 'string')
        .map((r) => ({ ref: r, rotulo: rotulo(r) }))
        .filter((o): o is { ref: string; rotulo: string } => !!o.rotulo);
      // Insight sem origem identificável não entra.
      const titulo = str(i.titulo, 160);
      const texto = str(i.texto, 500);
      if (!origens.length || !titulo || !texto) continue;
      const tipo = ['oportunidade', 'atencao', 'recomendacao'].includes(i.tipo as string)
        ? (i.tipo as Insight['tipo'])
        : 'recomendacao';
      insights.push({ tipo, titulo, texto, origens: origens.slice(0, 4) });
    }
    dados.insights = insights.slice(0, 3);

    const refsValidas = new Set<string>([
      ...dados.agenda.map((a) => a.ref),
      ...dados.comunicacoes.map((c) => c.ref),
      ...dados.projetos.map((p) => p.ref),
      ...dados.noticias.map((n) => n.ref),
    ]);
    const roteiro: SegmentoRoteiro[] = [];
    for (const seg of arr(s.roteiro)) {
      const texto = str(seg.texto, 1200);
      if (!texto) continue;
      const secao = SECOES.includes(seg.secao as SegmentoRoteiro['secao'])
        ? (seg.secao as SegmentoRoteiro['secao'])
        : 'abertura';
      const r = (Array.isArray(seg.refs) ? seg.refs : []).filter(
        (x): x is string => typeof x === 'string' && refsValidas.has(x),
      );
      roteiro.push({ secao, refs: r, texto });
    }
    dados.roteiro = roteiro.length ? roteiro : this.roteiroPadrao(dados);

    const porNivel = <T extends { nivel: Nivel }>(xs: T[]) =>
      xs.sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel]);
    porNivel(dados.comunicacoes);
    porNivel(dados.projetos);
    void f;
    return dados;
  }

  /** IA fora do ar: só fatos, sem seleção inventada. */
  private semIa(base: ReturnType<BriefingService['montarBase']>, f: FontesBriefing): BriefingDados {
    const { dados } = base;
    let amanha = 0;
    dados.agenda = dados.agenda.filter((a) => a.dia === 'hoje' || ++amanha <= MAX_AMANHA);
    for (const a of dados.agenda) if (a.conflito) a.nivel = 'atencao';
    dados.noticias = f.noticias.slice(0, 3).map((n, i) => ({
      ref: `nt${i + 1}`,
      titulo: n.titulo,
      fonte: n.fonte,
      link: n.link,
      publicadoEm: n.publicadoEm,
      resumo: '',
      porQue: `Relacionada ao seu interesse em ${n.tema}.`,
      nivel: 'informativo' as const,
    }));
    dados.roteiro = this.roteiroPadrao(dados);
    return dados;
  }

  private roteiroPadrao(d: BriefingDados): SegmentoRoteiro[] {
    const en = d.idioma === 'en';
    const out: SegmentoRoteiro[] = [];
    const saud =
      d.periodo === 'noite' ? (en ? 'Good evening' : 'Boa noite') : en ? 'Good morning' : 'Bom dia';
    out.push({ secao: 'abertura', refs: [], texto: `${saud}${d.nome ? `, ${d.nome}` : ''}.` });
    if (d.clima) {
      out.push({
        secao: 'clima',
        refs: [],
        texto: en
          ? `In ${d.clima.cidade}, ${d.clima.condicao}, ${d.clima.temperatura} degrees.`
          : `Em ${d.clima.cidade}, ${d.clima.condicao}, ${d.clima.temperatura} graus.`,
      });
    }
    const hoje = d.agenda.filter((a) => a.dia === 'hoje' && !a.passado);
    if (hoje.length) {
      const hora = (iso: string) =>
        new Date(iso).toLocaleTimeString(en ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: d.fuso });
      const lista = hoje
        .slice(0, 3)
        .map((a) => `${a.evento.titulo}${a.evento.diaInteiro ? '' : (en ? ' at ' : ' às ') + hora(a.evento.inicio)}`)
        .join(', ');
      out.push({
        secao: 'agenda',
        refs: hoje.slice(0, 3).map((a) => a.ref),
        texto: en
          ? `You have ${hoje.length} upcoming commitment${hoje.length > 1 ? 's' : ''} today: ${lista}.`
          : `Você tem ${hoje.length} compromisso${hoje.length > 1 ? 's' : ''} pela frente hoje: ${lista}.`,
      });
    }
    if (d.noticias.length) {
      out.push({
        secao: 'noticias',
        refs: d.noticias.map((n) => n.ref),
        texto: en
          ? `I picked ${d.noticias.length} news stories for you; they are on the screen.`
          : `Separei ${d.noticias.length} notícias para você; estão na tela.`,
      });
    }
    out.push({
      secao: 'encerramento',
      refs: [],
      texto: en ? 'Do you want me to go deeper into any of these?' : 'Quer que eu aprofunde algum desses assuntos?',
    });
    return out;
  }
}
