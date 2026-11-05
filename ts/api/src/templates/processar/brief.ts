import { proporcaoDe } from './arquetipo';
import {
  ARQUETIPOS,
  LIMITE_ELEMENTOS,
  LIMITE_SLIDES,
  type Arquetipo,
  type ElementoTemplate,
  type SlideTemplate,
  type TemplateEstrutura,
  type TipoElemento,
} from './tipos';

/**
 * Converte a estrutura de um template no bloco de prompt que orienta plano,
 * ajuste e escrita dos slides.
 *
 * Cada arquétipo do template é traduzido para um tipo+variante que os
 * renderizadores (build-pptx.ts / build-html.ts) sabem desenhar — pedir à IA
 * um layout que o arquivo final não entrega seria prometer o que não existe.
 */

interface Traducao {
  tipo: 'capa' | 'secao' | 'conteudo' | 'destaque' | 'comparacao';
  variante?: string;
  descricao: string;
}

function traduzir(s: SlideTemplate): Traducao {
  const imagem = s.elementos.find((e) => e.tipo === 'imagem');
  const titulo = s.elementos.find((e) => e.tipo === 'titulo');
  const centrado = titulo ? Math.abs(titulo.x + titulo.w / 2 - 0.5) < 0.08 : false;

  switch (s.arquetipo) {
    case 'capa':
      return { tipo: 'capa', descricao: 'capa de abertura' };
    case 'secao':
      return {
        tipo: 'secao',
        variante: centrado ? 'centralizado' : undefined,
        descricao: 'divisória de seção',
      };
    case 'encerramento':
      return { tipo: 'secao', variante: 'centralizado', descricao: 'encerramento' };
    case 'comparacao':
      return { tipo: 'comparacao', descricao: 'duas colunas lado a lado' };
    case 'imagem-texto': {
      const esquerda = imagem ? imagem.x + imagem.w / 2 < 0.5 : true;
      return {
        tipo: 'conteudo',
        variante: esquerda ? 'painel-esquerda' : 'painel-direita',
        descricao: `bloco visual à ${esquerda ? 'esquerda' : 'direita'} + texto`,
      };
    }
    case 'grade-cards':
      return { tipo: 'conteudo', variante: 'cards', descricao: 'grade de cards' };
    case 'indicadores':
      return { tipo: 'destaque', variante: 'cards', descricao: 'faixa de indicadores' };
    case 'grafico':
      return { tipo: 'destaque', descricao: 'dados/gráfico (vira indicadores)' };
    case 'tabela':
      return { tipo: 'comparacao', variante: 'cards', descricao: 'tabela (vira colunas)' };
    case 'citacao':
      return { tipo: 'conteudo', variante: 'declaracao', descricao: 'frase de impacto' };
    default:
      return { tipo: 'conteudo', descricao: 'título + tópicos' };
  }
}

const rotulo = (t: Traducao) => (t.variante ? `${t.tipo}/${t.variante}` : t.tipo);

export function templateBrief(
  estrutura: TemplateEstrutura | null | undefined,
  nome?: string,
): string {
  if (!estrutura || !estrutura.slides?.length) return '';

  const sequencia = estrutura.slides
    .slice(0, 30)
    .map((s) => {
      const t = traduzir(s);
      return `${s.indice}. ${t.descricao} → ${rotulo(t)}`;
    })
    .join('\n');

  const recorrentes = (estrutura.layoutsRecorrentes ?? [])
    .slice(0, 8)
    .map((l) => {
      const exemplo = estrutura.slides.find((s) => s.indice === l.slides[0]);
      const t = exemplo ? traduzir(exemplo) : null;
      return `- ${l.arquetipo} (${l.ocorrencias}x)${t ? ` → ${rotulo(t)}` : ''}`;
    })
    .join('\n');

  const caixasPorSlide =
    estrutura.slides.reduce(
      (s, sl) => s + sl.elementos.filter((e) => e.tipo === 'texto').length,
      0,
    ) / estrutura.slides.length;
  const densidade =
    caixasPorSlide <= 1.2
      ? 'enxuta (pouco texto por slide; prefira poucos tópicos curtos)'
      : caixasPorSlide <= 2.5
        ? 'moderada'
        : 'densa (vários blocos de texto por slide)';

  return (
    `## TEMPLATE ESTRUTURAL${nome ? ` — "${nome.slice(0, 80)}"` : ''}\n` +
    `O usuário escolheu uma apresentação de referência. Ela define a ESTRUTURA e a COMPOSIÇÃO, nunca a aparência nem o conteúdo.\n` +
    `- Use a sequência e os layouts abaixo como referência para organizar os slides.\n` +
    `- Você TEM liberdade para adaptar: não precisa repetir a quantidade nem a ordem exata do template — siga a necessidade do conteúdo.\n` +
    `- Cores, fontes, logotipo e tom visual vêm SEMPRE da identidade visual da marca. Ignore qualquer cor ou fonte do template.\n` +
    `- NÃO use o template como fonte de conteúdo: ele não tem informação sobre o tema.\n` +
    `- Para reproduzir a composição, preencha o campo "variante" do slide com a variante indicada (quando houver). Variantes possíveis: ` +
    `"painel-esquerda" e "painel-direita" (conteudo: bloco de cor da marca de um lado com uma frase-chave em "subtitulo", tópicos do outro), ` +
    `"cards" (conteudo: cada tópico vira um card; destaque: indicadores em cards; comparacao: colunas em cards), ` +
    `"declaracao" (conteudo: uma frase de impacto grande em "subtitulo", tópicos opcionais), ` +
    `"centralizado" (secao: texto centralizado).\n` +
    `- Proporção do template: ${estrutura.proporcao}. Densidade de texto: ${densidade}.\n\n` +
    `Sequência do template (slide → tipo/variante a usar):\n${sequencia}\n` +
    (recorrentes ? `\nLayouts recorrentes:\n${recorrentes}\n` : '') +
    `\n`
  );
}

// ------------------------------------------------------------------ validação

const TIPOS_ELEMENTO: TipoElemento[] = [
  'titulo',
  'subtitulo',
  'texto',
  'imagem',
  'grafico',
  'tabela',
  'forma',
];

const num01 = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
};

/**
 * Valida a estrutura que o cliente reenvia nas chamadas de IA (a cópia
 * guardada na criação). Descarta campos desconhecidos e impõe os mesmos
 * limites do processador — o que chega aqui vira texto de prompt.
 */
export function parseTemplateEstrutura(v: unknown): TemplateEstrutura | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.slides) || !o.slides.length) return null;

  const slides: SlideTemplate[] = o.slides.slice(0, LIMITE_SLIDES).map((s, i) => {
    const so = (s ?? {}) as Record<string, unknown>;
    const arquetipo = (ARQUETIPOS as readonly string[]).includes(String(so.arquetipo))
      ? (so.arquetipo as Arquetipo)
      : 'conteudo';
    const elementos: ElementoTemplate[] = (Array.isArray(so.elementos) ? so.elementos : [])
      .slice(0, LIMITE_ELEMENTOS)
      .map((e) => {
        const eo = (e ?? {}) as Record<string, unknown>;
        return {
          tipo: TIPOS_ELEMENTO.includes(eo.tipo as TipoElemento)
            ? (eo.tipo as TipoElemento)
            : 'forma',
          x: num01(eo.x),
          y: num01(eo.y),
          w: num01(eo.w),
          h: num01(eo.h),
        };
      });
    return { indice: Number(so.indice) || i + 1, arquetipo, elementos };
  });

  const largura = Number(o.largura) || 16;
  const altura = Number(o.altura) || 9;
  const layouts = Array.isArray(o.layoutsRecorrentes) ? o.layoutsRecorrentes : [];

  return {
    versaoFormato: 1,
    origem: o.origem === 'html' ? 'html' : 'pptx',
    largura,
    altura,
    proporcao: proporcaoDe(largura, altura),
    totalSlides: Number(o.totalSlides) || slides.length,
    slides,
    layoutsRecorrentes: layouts.slice(0, 20).map((l) => {
      const lo = (l ?? {}) as Record<string, unknown>;
      return {
        arquetipo: (ARQUETIPOS as readonly string[]).includes(String(lo.arquetipo))
          ? (lo.arquetipo as Arquetipo)
          : 'conteudo',
        ocorrencias: Number(lo.ocorrencias) || 0,
        slides: (Array.isArray(lo.slides) ? lo.slides : [])
          .slice(0, LIMITE_SLIDES)
          .map(Number)
          .filter(Number.isFinite),
      };
    }),
    geometriaAproximada: !!o.geometriaAproximada,
    avisos: [],
  };
}
