import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { VaultNotaHit } from '@/vault/vault.service';
import {
  normalizarCategoria,
  type CategoriaPerfil,
  type PerfilDados,
} from './perfil.tipos';

/**
 * Onde cada categoria mora no Repositório (arquivos gerados pelo cliente em
 * ts/demo/src/app/pages/ceo/perfil-pessoal/markdown.ts — mesmos caminhos e
 * títulos). Usado para citar a fonte quando a IA usa um trecho do perfil.
 */
export const PASTA_PERFIL = 'Personal/Profile';
export const ARQUIVOS_PERFIL: Record<
  CategoriaPerfil | 'overview',
  { arquivo: string; titulo: string }
> = {
  overview: { arquivo: 'overview', titulo: 'Perfil Pessoal — Visão geral' },
  basico: { arquivo: 'basic-information', titulo: 'Perfil Pessoal — Informações básicas' },
  formacao: { arquivo: 'education-and-skills', titulo: 'Perfil Pessoal — Formação e conhecimento' },
  interesses: { arquivo: 'interests-and-activities', titulo: 'Perfil Pessoal — Interesses e atividades' },
  comunicacao: { arquivo: 'communication-preferences', titulo: 'Perfil Pessoal — Preferências de comunicação' },
  objetivos: { arquivo: 'personal-goals', titulo: 'Perfil Pessoal — Objetivos pessoais' },
  estiloVida: { arquivo: 'lifestyle-and-preferences', titulo: 'Perfil Pessoal — Estilo de vida e preferências' },
};

/** Teto do bloco de preferências que entra em TODA chamada de IA. */
const PREFERENCIAS_MAX_CHARS = 900;
/** Teto dos fatos do perfil recuperados para uma pergunta. */
const TRECHOS_MAX_CHARS = 1200;
/** Cache curto do perfil: `comDiretrizes` roda em toda chamada de IA. */
const CACHE_MS = 30_000;

const STOPWORDS = new Set(
  'para pela pelo pelos pelas como mais menos sobre entre quando onde qual quais quem esse essa isso este esta isto aqui algo alguma algum muito pouco tambem ainda depois antes porque pois entao voce voces dele dela deles delas minha minhas meus meu seus suas nosso nossa fazer faz feito tenho temos pode posso deve devo seria sera favor obrigado'.split(
    ' ',
  ),
);

/** Pergunta sobre o próprio usuário ("para mim", "meu", "me recomende"…). */
const PESSOAL =
  /\b(eu|mim|me|meu|minha|meus|minhas|comigo|pra mim|para mim|recomend\w*|suger\w*|indic\w*|devo|deveria)\b/i;

/** Intenções que puxam categorias inteiras mesmo sem casar um termo. */
const INTENCOES: { re: RegExp; categorias: CategoriaPerfil[] }[] = [
  { re: /\b(curso|cursos|aprender|estudar|estudo|capacita\w*|certifica\w*|carreira|habilidade\w*|skill\w*)\b/i, categorias: ['formacao', 'objetivos', 'interesses'] },
  { re: /\b(livro\w*|filme\w*|s[eé]rie\w*|m[uú]sica\w*|podcast\w*|hobby|hobbies|lazer|atividade\w*|esporte\w*)\b/i, categorias: ['interesses', 'estiloVida'] },
  { re: /\b(viage\w*|viajar|destino\w*|restaurante\w*|comida\w*|receita\w*|dieta|compra\w*|presente\w*|roupa\w*|estilo)\b/i, categorias: ['estiloVida', 'interesses'] },
  { re: /\b(objetivo\w*|meta\w*|plano\w*|planej\w*|prioridade\w*|oportunidade\w*|futuro)\b/i, categorias: ['objetivos'] },
];

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function termos(s: string): Set<string> {
  return new Set(
    semAcento(s)
      .split(/[^a-z0-9+#.]+/)
      .map((t) => t.replace(/\.+$/, ''))
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

type Fato = { categoria: CategoriaPerfil; texto: string };

const HORIZONTE: Record<string, string> = { curto: 'curto prazo', medio: 'médio prazo', longo: 'longo prazo' };
const TIPO_INTERESSE: Record<string, string> = {
  interesse: 'tem interesse em',
  hobby: 'tem como hobby',
  atividade: 'pratica',
  assunto: 'acompanha o assunto',
  'quer-aprender': 'deseja aprender',
  'quer-experimentar': 'quer experimentar',
};

/** Cada informação do perfil como uma frase curta e independente. */
function fatosDoPerfil(d: PerfilDados): Fato[] {
  const f: Fato[] = [];
  const add = (categoria: CategoriaPerfil, texto: string) => {
    if (texto.trim()) f.push({ categoria, texto });
  };
  const b = d.basico;
  if (b) {
    const local = [b.cidade, b.estado, b.pais].filter(Boolean).join(', ');
    if (local) add('basico', `Mora em ${local}.`);
    if (b.nascimento) add('basico', `Nasceu em ${b.nascimento}.`);
    if (b.idiomaPrincipal) add('basico', `Idioma principal: ${b.idiomaPrincipal}.`);
    if (b.outrosIdiomas?.length) add('basico', `Fala também: ${b.outrosIdiomas.join(', ')}.`);
  }
  const fo = d.formacao;
  if (fo) {
    for (const x of fo.formacoes ?? []) {
      add('formacao', `Formação: ${[x.nivel, x.curso].filter(Boolean).join(' em ')}${x.instituicao ? ` (${x.instituicao}${x.ano ? `, ${x.ano}` : ''})` : ''}.`);
    }
    const listas: [string[] | undefined, string][] = [
      [fo.cursos, 'Cursos realizados'],
      [fo.certificacoes, 'Certificações'],
      [fo.areas, 'Áreas de conhecimento'],
      [fo.especialidades, 'Especialidades'],
      [fo.habilidadesTecnicas, 'Domina (habilidades técnicas)'],
      [fo.habilidadesComportamentais, 'Habilidades comportamentais'],
    ];
    for (const [lista, rotulo] of listas) {
      for (const item of lista ?? []) add('formacao', `${rotulo}: ${item}.`);
    }
  }
  for (const x of d.interesses?.itens ?? []) {
    add('interesses', `${TIPO_INTERESSE[x.tipo] ?? 'tem interesse em'} ${x.nome}${x.categoria ? ` (${x.categoria})` : ''}.`.replace(/^./, (c) => c.toUpperCase()));
  }
  for (const x of d.objetivos?.itens ?? []) {
    const extra = [x.categoria, HORIZONTE[x.horizonte], x.data && `até ${x.data}`, x.status && `status: ${x.status}`].filter(Boolean).join('; ');
    add('objetivos', `Objetivo: ${x.titulo}${extra ? ` (${extra})` : ''}${x.descricao ? ` — ${x.descricao}` : ''}.`);
  }
  for (const x of d.estiloVida?.itens ?? []) {
    add('estiloVida', `Preferência${x.categoria ? ` de ${x.categoria}` : ''}: ${x.texto}.`);
  }
  return f;
}

@Injectable()
export class PerfilService {
  private readonly logger = new Logger(PerfilService.name);
  private readonly cache = new Map<string, { em: number; dados: PerfilDados | null }>();

  constructor(private readonly prisma: PrismaService) {}

  /** Perfil do usuário (vazio se ainda não houver). Sempre por `usuarioId`. */
  async obter(empresaId: string, usuarioId: string): Promise<{ dados: PerfilDados; atualizadoEm: Date | null }> {
    const row = await this.prisma.perfilPessoal.findFirst({ where: { usuarioId, empresaId } });
    return { dados: (row?.dados ?? {}) as PerfilDados, atualizadoEm: row?.atualizadoEm ?? null };
  }

  /** Grava UMA categoria; as demais ficam como estão. */
  async salvarCategoria(
    empresaId: string,
    usuarioId: string,
    categoria: CategoriaPerfil,
    valor: unknown,
  ): Promise<{ dados: PerfilDados; atualizadoEm: Date }> {
    const atual = await this.obter(empresaId, usuarioId);
    const dados = { ...atual.dados, [categoria]: normalizarCategoria(categoria, valor) } as PerfilDados;
    const row = await this.prisma.perfilPessoal.upsert({
      where: { usuarioId },
      create: { empresaId, usuarioId, dados: dados as Prisma.InputJsonValue },
      update: { dados: dados as Prisma.InputJsonValue },
    });
    this.cache.delete(usuarioId);
    return { dados: row.dados as PerfilDados, atualizadoEm: row.atualizadoEm };
  }

  /** Exclusão definitiva do perfil. */
  async excluir(empresaId: string, usuarioId: string): Promise<void> {
    await this.prisma.perfilPessoal.deleteMany({ where: { usuarioId, empresaId } });
    this.cache.delete(usuarioId);
  }

  private async dadosEmCache(usuarioId: string): Promise<PerfilDados | null> {
    const c = this.cache.get(usuarioId);
    if (c && Date.now() - c.em < CACHE_MS) return c.dados;
    const row = await this.prisma.perfilPessoal.findUnique({ where: { usuarioId } });
    const dados = (row?.dados ?? null) as PerfilDados | null;
    this.cache.set(usuarioId, { em: Date.now(), dados });
    return dados;
  }

  /**
   * Bloco curto com as preferências de comunicação, para o fim do system de
   * toda chamada de IA (ver AiService.comDiretrizes). Vazio sem preferências.
   */
  async blocoPreferencias(usuarioId: string): Promise<string> {
    try {
      const d = await this.dadosEmCache(usuarioId);
      const c = d?.comunicacao;
      const nome = d?.basico?.nomePreferido;
      const linhas = [
        nome && `- Chame o usuário de "${nome}".`,
        c?.idiomaResposta && `- Responda em: ${c.idiomaResposta}.`,
        c?.tom && `- Tom: ${c.tom}.`,
        c?.detalhe && `- Nível de detalhe: ${c.detalhe}.`,
        c?.profundidade && `- Estilo: ${c.profundidade}.`,
        c?.apresentacao && `- Apresentação preferida: ${c.apresentacao}.`,
        c?.instrucoes && `- Outras instruções pessoais: ${c.instrucoes}`,
      ].filter(Boolean);
      if (!linhas.length) return '';
      const bloco = [
        '# Preferências de comunicação do usuário (Perfil Pessoal)',
        'Aplique ao responder, exceto quando as instruções do agente ou as diretrizes da organização disserem o contrário.',
        ...linhas,
      ].join('\n');
      return bloco.slice(0, PREFERENCIAS_MAX_CHARS);
    } catch (err) {
      this.logger.warn(`Falha ao carregar preferências do perfil: ${String(err)}`);
      return '';
    }
  }

  /**
   * Fatos do perfil relevantes para a pergunta — nunca o perfil inteiro.
   * Um fato entra quando divide um termo com a pergunta, ou quando a pergunta
   * é sobre o próprio usuário e tem uma intenção que puxa a categoria
   * (ex.: "que curso faz sentido para mim?" → formação, objetivos, interesses).
   * Volta no formato de nota do Repositório, um hit por arquivo do perfil.
   */
  async trechosRelevantes(usuarioId: string, pergunta: string): Promise<VaultNotaHit[]> {
    try {
      const d = await this.dadosEmCache(usuarioId);
      if (!d) return [];
      const fatos = fatosDoPerfil(d);
      if (!fatos.length) return [];

      const tq = termos(pergunta);
      const pessoal = PESSOAL.test(pergunta);
      const puxadas = new Set<CategoriaPerfil>(
        pessoal ? INTENCOES.filter((i) => i.re.test(pergunta)).flatMap((i) => i.categorias) : [],
      );

      const pontuados = fatos
        .map((f) => {
          let p = 0;
          for (const t of termos(f.texto)) if (tq.has(t)) p += 2;
          if (puxadas.has(f.categoria)) p += 1;
          return { ...f, p };
        })
        .filter((f) => f.p > 0)
        .sort((a, b) => b.p - a.p);
      if (!pontuados.length) return [];

      // Identidade mínima quando algo do perfil foi usado.
      const nome = d.basico?.nomePreferido || d.basico?.nomeCompleto;
      const porCategoria = new Map<CategoriaPerfil, string[]>();
      let total = nome ? nome.length + 30 : 0;
      for (const f of pontuados) {
        if (total + f.texto.length > TRECHOS_MAX_CHARS) break;
        total += f.texto.length + 3;
        const l = porCategoria.get(f.categoria) ?? [];
        l.push(`- ${f.texto}`);
        porCategoria.set(f.categoria, l);
      }

      const hits: VaultNotaHit[] = [];
      for (const [categoria, linhas] of porCategoria) {
        const { arquivo, titulo } = ARQUIVOS_PERFIL[categoria];
        hits.push({
          path: `${PASTA_PERFIL}/${arquivo}.md`,
          titulo,
          conteudo: [nome ? `Usuário: ${nome} (dono deste Oracle).` : '', ...linhas].filter(Boolean).join('\n'),
        } as VaultNotaHit);
      }
      return hits;
    } catch (err) {
      this.logger.warn(`Falha ao recuperar o perfil: ${String(err)}`);
      return [];
    }
  }
}
