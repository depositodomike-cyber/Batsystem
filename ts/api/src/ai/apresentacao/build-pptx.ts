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
  const slides = roteiro.slides ?? [];
  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    const titulo = s.titulo || `Slide ${i + 1}`;

    if (s.tipo === 'secao') {
      // Transição: o destaque toma a tela e o texto fica curto.
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
        });
      }
      if (s.notas) slide.addNotes(s.notas);
      return;
    }

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
