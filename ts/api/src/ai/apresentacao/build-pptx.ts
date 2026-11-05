// Monta o .pptx (16:9) a partir do roteiro editado. Determinístico (sem IA),
// usando pptxgenjs. Portado, em espírito, do beculture/Confi (lib/apresentacao.js).
//
// Cores, fontes e logo saem do design system da marca escolhida no AI Studio;
// sem design system, cai na paleta beculture (âmbar sobre grafite).
import PptxGenJS from 'pptxgenjs';
import type { Roteiro } from './prompts';
import { designTheme, type DesignSystemDto } from '../design/design';

export async function buildPptx(
  roteiro: Roteiro,
  design?: DesignSystemDto | null,
): Promise<Buffer> {
  const tema = designTheme(design);
  const COR = tema.pptx;
  const FT = tema.fonteTitulo; // fonte dos títulos
  const FC = tema.fonteCorpo; // fonte do corpo

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'W16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'W16x9';
  pptx.title = roteiro.titulo;

  // ---- Capa ----
  const capa = pptx.addSlide();
  capa.background = { color: COR.fundoCapa };
  capa.addShape('rect', { x: 0, y: 6.9, w: 13.333, h: 0.6, fill: { color: COR.destaque } });
  // Logo da marca (versão para fundos escuros), quando o design system tem uma.
  if (tema.logo) {
    capa.addImage({
      data: tema.logo,
      x: 0.8,
      y: 0.8,
      w: 2.2,
      h: 0.8,
      sizing: { type: 'contain', w: 2.2, h: 0.8 },
    });
  }
  capa.addText(roteiro.titulo, {
    x: 0.8,
    y: 2.6,
    w: 11.7,
    h: 1.8,
    fontSize: 40,
    bold: true,
    color: COR.titulo,
    fontFace: FT,
    align: 'left',
  });
  if (roteiro.subtitulo) {
    capa.addText(roteiro.subtitulo, {
      x: 0.82,
      y: 4.4,
      w: 11.7,
      h: 1,
      fontSize: 20,
      color: COR.destaque,
      fontFace: FC,
      align: 'left',
    });
  }

  // ---- Slides ----
  // O `tipo` do slide escolhe o layout. Ele vem do plano aprovado pelo usuário,
  // e por isso o catálogo de tipos do prompt e os casos daqui têm que andar
  // juntos: planejar um layout que este switch não desenha seria prometer o que
  // o arquivo não entrega. Slide sem `tipo` (roteiro anterior aos layouts) cai
  // no `default`, que é o layout de sempre.
  // ---- Variantes de composição (templates de apresentação) ----
  // Só a COMPOSIÇÃO muda: cores e fontes continuam saindo do tema da marca.
  // Toda caixa de texto nova usa `fit: 'shrink'` para não transbordar.
  type Slide = ReturnType<typeof pptx.addSlide>;
  const W = 13.333;

  const numerar = (slide: Slide, i: number) =>
    slide.addText(`${i + 1}`, {
      x: 12.4,
      y: 6.9,
      w: 0.7,
      h: 0.4,
      fontSize: 12,
      color: COR.suave,
      align: 'right',
      fontFace: FC,
    });

  const topicos = (itens: string[], fontSize: number) =>
    itens.map((b) => ({
      text: b,
      options: {
        bullet: { characterCode: '2022' },
        color: COR.texto,
        fontSize,
        paraSpaceAfter: 8,
      },
    }));

  const cabecalhoPadrao = (slide: Slide, titulo: string) => {
    slide.background = { color: COR.fundo };
    slide.addShape('rect', { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: COR.destaque } });
    slide.addText(titulo, {
      x: 0.7,
      y: 0.5,
      w: 12,
      h: 1,
      fontSize: 28,
      bold: true,
      color: COR.titulo,
      fontFace: FT,
      fit: 'shrink',
    });
  };

  /** Grade de cards na área útil abaixo do título. */
  const grade = (n: number) => {
    const cols = n <= 3 ? n : n === 4 ? 2 : 3;
    const linhas = Math.ceil(n / cols);
    const gap = 0.3;
    const x0 = 0.9;
    const y0 = 1.85;
    const w = (11.6 - gap * (cols - 1)) / cols;
    const h = (5.0 - gap * (linhas - 1)) / linhas;
    return Array.from({ length: n }, (_, k) => ({
      x: x0 + (k % cols) * (w + gap),
      y: y0 + Math.floor(k / cols) * (h + gap),
      w,
      h,
    }));
  };

  const card = (slide: Slide, c: { x: number; y: number; w: number; h: number }) => {
    slide.addShape('roundRect', {
      ...c,
      rectRadius: 0.12,
      fill: { color: COR.fundoCapa },
      line: { color: COR.suave, width: 0.5, transparency: 60 },
    });
    slide.addShape('rect', { x: c.x + 0.25, y: c.y + 0.22, w: 0.6, h: 0.07, fill: { color: COR.destaque } });
  };

  function desenharVariante(
    slide: Slide,
    s: NonNullable<Roteiro['slides']>[number],
    titulo: string,
    i: number,
  ): boolean {
    const tipo = s.tipo ?? 'conteudo';
    const v = s.variante;
    if (!v) return false;
    const bullets = (s.bullets ?? []).filter(Boolean);

    if ((v === 'painel-esquerda' || v === 'painel-direita') && tipo === 'conteudo') {
      const esquerda = v === 'painel-esquerda';
      const pw = 5.2;
      const px = esquerda ? 0 : W - pw;
      slide.background = { color: COR.fundo };
      slide.addShape('rect', { x: px, y: 0, w: pw, h: 7.5, fill: { color: COR.destaque } });
      if (s.subtitulo) {
        slide.addText(s.subtitulo, {
          x: px + 0.6,
          y: 1.2,
          w: pw - 1.2,
          h: 5.1,
          fontSize: 28,
          bold: true,
          color: COR.fundoCapa,
          fontFace: FT,
          valign: 'middle',
          fit: 'shrink',
        });
      }
      const tx = esquerda ? pw + 0.7 : 0.8;
      const tw = W - pw - 1.5;
      slide.addText(titulo, {
        x: tx,
        y: 0.7,
        w: tw,
        h: 1.2,
        fontSize: 26,
        bold: true,
        color: COR.titulo,
        fontFace: FT,
        fit: 'shrink',
      });
      if (bullets.length) {
        slide.addText(topicos(bullets, 17), {
          x: tx,
          y: 2.1,
          w: tw,
          h: 4.5,
          fontFace: FC,
          valign: 'top',
          fit: 'shrink',
        });
      }
    } else if (v === 'declaracao' && tipo === 'conteudo' && s.subtitulo) {
      slide.background = { color: COR.fundo };
      slide.addShape('rect', { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: COR.destaque } });
      slide.addText(titulo, {
        x: 0.9,
        y: 0.6,
        w: 11.6,
        h: 0.7,
        fontSize: 18,
        bold: true,
        color: COR.suave,
        fontFace: FT,
        fit: 'shrink',
      });
      slide.addText(s.subtitulo, {
        x: 1.2,
        y: 1.6,
        w: 10.9,
        h: 3.0,
        fontSize: 36,
        bold: true,
        color: COR.titulo,
        fontFace: FT,
        align: 'center',
        valign: 'middle',
        fit: 'shrink',
      });
      const apoio = bullets.slice(0, 3);
      if (apoio.length) {
        const w = (10.9 - 0.3 * (apoio.length - 1)) / apoio.length;
        apoio.forEach((b, k) => {
          slide.addText(b, {
            x: 1.2 + k * (w + 0.3),
            y: 5.0,
            w,
            h: 1.5,
            fontSize: 14,
            color: COR.texto,
            fontFace: FC,
            align: 'center',
            valign: 'top',
            fit: 'shrink',
          });
        });
      }
    } else if (v === 'cards' && tipo === 'conteudo' && bullets.length >= 2) {
      cabecalhoPadrao(slide, titulo);
      const itens = bullets.slice(0, 6);
      grade(itens.length).forEach((c, k) => {
        card(slide, c);
        slide.addText(itens[k], {
          x: c.x + 0.25,
          y: c.y + 0.45,
          w: c.w - 0.5,
          h: c.h - 0.65,
          fontSize: 16,
          color: COR.texto,
          fontFace: FC,
          valign: 'top',
          fit: 'shrink',
        });
      });
    } else if (v === 'cards' && tipo === 'destaque' && s.destaques?.length) {
      cabecalhoPadrao(slide, titulo);
      const itens = s.destaques.slice(0, 3);
      grade(itens.length).forEach((c, k) => {
        const altura = Math.min(c.h, 3.4);
        const caixa = { ...c, y: c.y + 0.4, h: altura };
        card(slide, caixa);
        slide.addText(itens[k].valor, {
          x: caixa.x + 0.25,
          y: caixa.y + 0.5,
          w: caixa.w - 0.5,
          h: 1.3,
          fontSize: 48,
          bold: true,
          color: COR.destaque,
          fontFace: FT,
          fit: 'shrink',
        });
        slide.addText(itens[k].rotulo, {
          x: caixa.x + 0.25,
          y: caixa.y + 1.85,
          w: caixa.w - 0.5,
          h: altura - 2.05,
          fontSize: 15,
          color: COR.texto,
          fontFace: FC,
          valign: 'top',
          fit: 'shrink',
        });
      });
    } else if (v === 'cards' && tipo === 'comparacao' && s.colunas?.length) {
      cabecalhoPadrao(slide, titulo);
      const colunas = s.colunas.slice(0, 2);
      grade(colunas.length).forEach((c, k) => {
        card(slide, c);
        slide.addText(colunas[k].titulo, {
          x: c.x + 0.25,
          y: c.y + 0.4,
          w: c.w - 0.5,
          h: 0.6,
          fontSize: 20,
          bold: true,
          color: COR.destaque,
          fontFace: FT,
          fit: 'shrink',
        });
        const itens = (colunas[k].itens ?? []).filter(Boolean);
        if (itens.length) {
          slide.addText(topicos(itens, 15), {
            x: c.x + 0.25,
            y: c.y + 1.1,
            w: c.w - 0.5,
            h: c.h - 1.3,
            fontFace: FC,
            valign: 'top',
            fit: 'shrink',
          });
        }
      });
    } else {
      return false;
    }

    if (s.notas) slide.addNotes(s.notas);
    numerar(slide, i);
    return true;
  }

  const slides = roteiro.slides ?? [];
  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    const titulo = s.titulo || `Slide ${i + 1}`;

    if (s.tipo === 'secao') {
      // Transição: o destaque toma a tela e o texto fica curto.
      // Variante "centralizado" (template): mesmo desenho, texto ao centro.
      const centro = s.variante === 'centralizado';
      slide.background = { color: COR.destaque };
      slide.addText(titulo, {
        x: 0.9,
        y: 3,
        w: 11.5,
        h: 1.6,
        fontSize: 40,
        bold: true,
        color: COR.fundoCapa,
        fontFace: FT,
        ...(centro ? { align: 'center' as const } : {}),
      });
      if (s.subtitulo) {
        slide.addText(s.subtitulo, {
          x: 0.92,
          y: 4.5,
          w: 11.5,
          h: 0.8,
          fontSize: 18,
          color: COR.fundoCapa,
          fontFace: FC,
          ...(centro ? { align: 'center' as const } : {}),
        });
      }
      if (s.notas) slide.addNotes(s.notas);
      return;
    }

    // Composições vindas de um template (variante). Sem variante — ou numa
    // combinação tipo/variante que não se aplica — segue o desenho de sempre.
    if (desenharVariante(slide, s, titulo, i)) return;

    slide.background = { color: COR.fundo };
    slide.addShape('rect', { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: COR.destaque } });
    slide.addText(titulo, {
      x: 0.7,
      y: 0.5,
      w: 12,
      h: 1,
      fontSize: 28,
      bold: true,
      color: COR.titulo,
      fontFace: FT,
    });

    if (s.tipo === 'destaque' && s.destaques?.length) {
      // Até 3 números lado a lado, divididos igualmente na largura útil.
      const itens = s.destaques.slice(0, 3);
      const larguraUtil = 11.6;
      const col = larguraUtil / itens.length;
      itens.forEach((d, k) => {
        const x = 0.9 + k * col;
        slide.addText(d.valor, {
          x,
          y: 2.4,
          w: col - 0.4,
          h: 1.6,
          fontSize: 54,
          bold: true,
          color: COR.destaque,
          fontFace: FT,
          align: 'left',
        });
        slide.addText(d.rotulo, {
          x,
          y: 4.1,
          w: col - 0.4,
          h: 1.4,
          fontSize: 16,
          color: COR.texto,
          fontFace: FC,
          valign: 'top',
        });
      });
    } else if (s.tipo === 'comparacao' && s.colunas?.length) {
      const colunas = s.colunas.slice(0, 2);
      const larguraUtil = 11.6;
      const col = larguraUtil / colunas.length;
      colunas.forEach((c, k) => {
        const x = 0.9 + k * col;
        slide.addText(c.titulo, {
          x,
          y: 1.9,
          w: col - 0.5,
          h: 0.6,
          fontSize: 20,
          bold: true,
          color: COR.destaque,
          fontFace: FT,
        });
        const itens = (c.itens ?? []).filter(Boolean);
        if (itens.length) {
          slide.addText(
            itens.map((t) => ({
              text: t,
              options: {
                bullet: { characterCode: '2022' },
                color: COR.texto,
                fontSize: 16,
                paraSpaceAfter: 8,
              },
            })),
            { x, y: 2.7, w: col - 0.5, h: 4.1, fontFace: FC, valign: 'top' },
          );
        }
      });
    } else {
      const bullets = (s.bullets ?? []).filter(Boolean);
      if (bullets.length) {
        slide.addText(
          bullets.map((b) => ({
            text: b,
            options: { bullet: { characterCode: '2022' }, color: COR.texto, fontSize: 18, paraSpaceAfter: 10 },
          })),
          { x: 0.9, y: 1.8, w: 11.6, h: 5, fontFace: FC, valign: 'top' },
        );
      }
    }

    if (s.notas) slide.addNotes(s.notas);
    slide.addText(`${i + 1}`, {
      x: 12.4,
      y: 6.9,
      w: 0.7,
      h: 0.4,
      fontSize: 12,
      color: COR.suave,
      align: 'right',
      fontFace: FC,
    });
  });

  // pptxgenjs devolve Buffer com outputType nodebuffer.
  const out = (await pptx.write({ outputType: 'nodebuffer' })) as unknown;
  return out as Buffer;
}
