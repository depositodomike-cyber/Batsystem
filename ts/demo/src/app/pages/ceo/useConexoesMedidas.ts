// Import Dependencies
import { useLayoutEffect, useState, type RefObject } from "react";

// Local Imports
import type { Membro } from "@/services/api/membros";
import { ancestrais } from "./hierarquia-membros";
import type { ConexaoIndireta } from "./membros-indiretos";

// ----------------------------------------------------------------------
// Posições dos cards do organograma, para desenhar as conexões indiretas.
//
// A árvore principal continua sendo CSS puro: os conectores pai→filho são
// pseudo-elementos e nenhum deles precisa de coordenada. Este arquivo existe
// porque uma aresta entre dois nós ARBITRÁRIOS não é expressável assim — não há
// adjacência no DOM entre um gestor indireto e quem ele acompanha.
//
// Então só a camada secundária mede. Recolher um nó continua sendo "deixar de
// renderizar os filhos"; o que mudou é que essa mudança de layout agora também
// dispara uma remedição — e as duas blindagens contra loop abaixo não são
// opcionais.
// ----------------------------------------------------------------------

/** Uma aresta já resolvida em coordenadas do espaço NÃO escalado da árvore. */
export interface ArestaMedida {
  /** Chave estável, derivada do par de membros DESENHADO (pós-elevação). */
  chave: string;
  /** Ids reais da relação, para o texto do tooltip e para a ênfase. */
  deId: string;
  paraId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Ponto de controle da Bézier, do lado da origem. */
  cx1: number;
  /** Ponto de controle do lado do destino. */
  cx2: number;
  /** Deslocamento vertical dos controles, para o caso quase horizontal. */
  cy: number;
}

/** Meio da borda lateral de um card, nos dois lados. */
interface Caixa {
  esq: number;
  dir: number;
  meioY: number;
  centroX: number;
}

/**
 * Barriga aplicada quando as duas pontas estão quase na mesma altura: sem ela
 * a curva vira um segmento horizontal que passa por trás dos cards entre as
 * duas e fica invisível. 24px cabe no vão de 48px que o `pt-12` reserva.
 */
const BARRIGA = 24;

/** Distância mínima e máxima da tangente horizontal dos pontos de controle. */
const TANGENTE_MIN = 24;
const TANGENTE_MAX = 120;

function pontosDeControle(a: Caixa, b: Caixa) {
  const dist = Math.abs(b.centroX - a.centroX);
  const d = Math.min(Math.max(dist * 0.4, TANGENTE_MIN), TANGENTE_MAX);
  const paraDireita = b.centroX >= a.centroX;
  return {
    x1: paraDireita ? a.dir : a.esq,
    x2: paraDireita ? b.esq : b.dir,
    cx1: paraDireita ? a.dir + d : a.esq - d,
    cx2: paraDireita ? b.esq - d : b.dir + d,
    // Quase mesma altura: desce os controles para a curva ter o que mostrar.
    cy: Math.abs(b.meioY - a.meioY) < 8 ? BARRIGA : 0,
  };
}

/**
 * Mede os cards visíveis e devolve as arestas prontas para desenhar.
 *
 * ## Espaço de coordenadas
 *
 * `getBoundingClientRect` de cada card, menos o da árvore, dividido por uma
 * escala **medida** — `rect.width / offsetWidth`, que é a razão entre a caixa
 * pintada e a caixa de layout, ou seja o produto de TODOS os transforms da
 * cadeia. Não use a `escala` da câmera: ela só conhece o `scale()` que ela
 * própria escreve, e qualquer transform de ancestral (transição de aba,
 * animação, zoom de página) a faria mentir, deslocando todas as linhas sem
 * erro nenhum.
 *
 * O resultado fica no espaço NÃO escalado da árvore, e isso tem duas
 * consequências que valem o método:
 *
 * - **Zoom não exige remedir**: as coordenadas são invariantes, e o `<svg>`
 *   dentro da camada escalada é transformado junto com os cards.
 * - **Rolagem não afeta nada**: viewport, arraste e rolagem da página deslocam
 *   os dois rects na mesma medida, e a subtração cancela. Importa porque o
 *   arraste muta `scrollLeft/scrollTop` direto no DOM, sem re-render.
 *
 * Descartar `offsetLeft/offsetTop` somados pela cadeia de `offsetParent` foi
 * deliberado: cada `<li>` do cotovelo e cada `<ul>` de filhos é `relative`,
 * então a cadeia tem ~2 elos por nível e cada `offsetLeft` vem arredondado
 * para inteiro — o erro acumula em nós profundos. O rect são duas leituras,
 * qualquer que seja a profundidade.
 *
 * ## Pontas fora do DOM
 *
 * Recolher desmonta os filhos, então um card pode não existir. A aresta então
 * é ELEVADA ao primeiro ancestral visível, que é o card representando aquela
 * subárvore na tela (e que já exibe a pílula `+N`). Duas arestas que elevem
 * para o mesmo par colapsam numa só, senão recolher um nó grande empilharia
 * curvas idênticas e a "menor ênfase" viraria uma linha grossa. Quando nenhum
 * ancestral está visível — alguém em ciclo, ou isolado, que o organograma
 * nunca desenha — a aresta é descartada e CONTADA, para a tela dizer quantas
 * ficaram de fora em vez de silenciá-las.
 *
 * Expandir automaticamente para revelar a ponta está fora de questão: o
 * conjunto de recolhidos é do usuário, e nem um refetch o desfaz.
 */
export function useConexoesMedidas(
  arvoreRef: RefObject<HTMLDivElement | null>,
  membros: Membro[],
  conexoes: ConexaoIndireta[],
  /** Falso quando a legenda desligou as linhas: não mede o que não desenha. */
  ativo: boolean,
): { arestas: ArestaMedida[]; ocultas: number } {
  // Recolher/expandir não precisa ser parâmetro: alternar o conjunto
  // re-renderiza o organograma, e o efeito abaixo roda depois de todo render.
  const [medido, setMedido] = useState<{
    arestas: ArestaMedida[];
    ocultas: number;
  }>({ arestas: [], ocultas: 0 });

  // Sem array de dependências: roda depois de TODO render, que é o único jeito
  // de cobrir os gatilhos reais sem enumerá-los (montagem, `membros`,
  // recolher/expandir, e qualquer coisa que mexa no layout da árvore). O que
  // torna isso seguro é o bail-out por chave, mais abaixo — sem ele, cada
  // medição agendaria a próxima.
  //
  // `useLayoutEffect` e não `useEffect`: medir depois do paint faria as linhas
  // aparecerem um quadro atrasadas, visível ao expandir um nó.
  useLayoutEffect(() => {
    const arvore = arvoreRef.current;
    if (!arvore) return;

    const medir = () => {
      if (!ativo || conexoes.length === 0) {
        setMedido((prev) =>
          prev.arestas.length === 0 && prev.ocultas === 0
            ? prev
            : { arestas: [], ocultas: 0 },
        );
        return;
      }

      const rectArvore = arvore.getBoundingClientRect();
      const escala = rectArvore.width / arvore.offsetWidth;
      // Painel oculto (display:none, largura zero) daria 0, Infinity ou NaN.
      // Mantém a medição anterior em vez de zerar: zerar produziria um piscar
      // de linhas sumindo e voltando na troca de aba.
      if (!(escala > 0) || !Number.isFinite(escala)) return;

      const caixas = new Map<string, Caixa>();
      for (const el of arvore.querySelectorAll<HTMLElement>(
        "[data-org-membro]",
      )) {
        const id = el.dataset.orgMembro;
        if (!id) continue;
        const r = el.getBoundingClientRect();
        const esq = (r.left - rectArvore.left) / escala;
        const dir = (r.right - rectArvore.left) / escala;
        caixas.set(id, {
          esq,
          dir,
          meioY: (r.top + r.height / 2 - rectArvore.top) / escala,
          centroX: (esq + dir) / 2,
        });
      }

      /** Sobe até o primeiro ancestral desenhado. */
      const visivel = (id: string): string | null => {
        if (caixas.has(id)) return id;
        for (const a of ancestrais(membros, id)) {
          if (caixas.has(a)) return a;
        }
        return null;
      };

      const arestas: ArestaMedida[] = [];
      const vistas = new Set<string>();
      let ocultas = 0;

      for (const c of conexoes) {
        const de = visivel(c.deId);
        const para = visivel(c.paraId);
        if (de == null || para == null) {
          ocultas++;
          continue;
        }
        // As duas pontas colapsaram no mesmo card: seria um laço de
        // comprimento zero.
        if (de === para) continue;
        const chave = `${de}>${para}`;
        if (vistas.has(chave)) continue;
        vistas.add(chave);

        const a = caixas.get(de)!;
        const b = caixas.get(para)!;
        const { x1, x2, cx1, cx2, cy } = pontosDeControle(a, b);
        arestas.push({
          chave,
          deId: c.deId,
          paraId: c.paraId,
          x1,
          y1: a.meioY,
          x2,
          y2: b.meioY,
          cx1,
          cx2,
          cy,
        });
      }

      // Bail-out. Coordenadas arredondadas a uma casa: em escala 0.75 ou 1.25
      // a divisão produz frações que oscilam no último bit, e sem o
      // arredondamento a comparação falharia sempre — o efeito sem deps
      // viraria um loop de render.
      const assina = (as: ArestaMedida[], oc: number) =>
        oc +
        "|" +
        as
          .map(
            (a) =>
              `${a.chave}:${a.x1.toFixed(1)},${a.y1.toFixed(1)},${a.x2.toFixed(
                1,
              )},${a.y2.toFixed(1)}`,
          )
          .join(";");

      setMedido((prev) =>
        assina(prev.arestas, prev.ocultas) === assina(arestas, ocultas)
          ? prev
          : { arestas, ocultas },
      );
    };

    medir();

    // Observer PRÓPRIO, e não o da câmera: aquele é privado do hook e existe
    // para dimensionar o sizer. Acoplar os dois faria a câmera devolver dado
    // que não é dela. Dois observers no mesmo elemento são baratos.
    //
    // Pega o que o render não pega: o `flex-wrap` da linha de topos ao
    // redimensionar a janela.
    const ro = new ResizeObserver(() => medir());
    ro.observe(arvore);

    // Fonte carregando muda a largura dos cards depois do primeiro layout.
    let vivo = true;
    void document.fonts?.ready.then(() => {
      if (vivo) medir();
    });

    return () => {
      vivo = false;
      ro.disconnect();
    };
  });

  return medido;
}
