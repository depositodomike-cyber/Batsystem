import type { Prisma, TemplateApresentacao } from '@prisma/client';
import type {
  LayoutRecorrente,
  SlideTemplate,
  TemplateEstrutura,
} from './processar';

/** Tudo menos o binário — nenhuma leitura de listagem/detalhe traz o arquivo. */
export const SELECT_SEM_ARQUIVO = {
  id: true,
  empresaId: true,
  nome: true,
  descricao: true,
  contexto: true,
  formato: true,
  arquivoNome: true,
  arquivoMime: true,
  arquivoTamanho: true,
  estrutura: true,
  ativo: true,
  versao: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.TemplateApresentacaoSelect;

type TemplateSemArquivo = Omit<TemplateApresentacao, 'arquivo'>;

/** Resumo para a tabela: o suficiente para a miniatura, sem a estrutura toda. */
export interface TemplatePrevia {
  proporcao: string;
  totalSlides: number;
  primeiro: SlideTemplate | null;
  layoutsRecorrentes: LayoutRecorrente[];
  geometriaAproximada: boolean;
}

export interface TemplatePublico {
  id: string;
  nome: string;
  descricao: string | null;
  contexto: string | null;
  formato: 'pptx' | 'html';
  arquivoNome: string;
  arquivoTamanho: number;
  ativo: boolean;
  versao: number;
  previa: TemplatePrevia;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TemplateCompleto extends TemplatePublico {
  estrutura: TemplateEstrutura;
}

export function toTemplatePublico(t: TemplateSemArquivo): TemplatePublico {
  const e = t.estrutura as unknown as TemplateEstrutura;
  return {
    id: t.id,
    nome: t.nome,
    descricao: t.descricao,
    contexto: t.contexto,
    formato: t.formato === 'html' ? 'html' : 'pptx',
    arquivoNome: t.arquivoNome,
    arquivoTamanho: t.arquivoTamanho,
    ativo: t.ativo,
    versao: t.versao,
    previa: {
      proporcao: e?.proporcao ?? '16:9',
      totalSlides: e?.totalSlides ?? 0,
      primeiro: e?.slides?.[0] ?? null,
      layoutsRecorrentes: e?.layoutsRecorrentes ?? [],
      geometriaAproximada: !!e?.geometriaAproximada,
    },
    criadoEm: t.criadoEm.toISOString(),
    atualizadoEm: t.atualizadoEm.toISOString(),
  };
}

export function toTemplateCompleto(t: TemplateSemArquivo): TemplateCompleto {
  return {
    ...toTemplatePublico(t),
    estrutura: t.estrutura as unknown as TemplateEstrutura,
  };
}
