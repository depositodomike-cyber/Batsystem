// Import Dependencies
import clsx from "clsx";

// Local Imports
import type {
  ElementoTemplate,
  SlideTemplate,
  TemplateEstrutura,
} from "@/services/api/templates";
import { ROTULO_ARQUETIPO } from "./useTemplates";

// ----------------------------------------------------------------------
// Prévia ESTRUTURAL de um template: cada slide vira um wireframe em SVG com as
// caixas extraídas (título, texto, imagem, gráfico, tabela) nas posições do
// arquivo. Não é uma imagem do slide — cores, fontes e texto do arquivo não
// são reproduzidos, porque o template só orienta a composição.
//
// Cores por classes do tema (fill-*/stroke-*), então funciona em claro e
// escuro sem nenhuma cor fixa.
// ----------------------------------------------------------------------

/** "16:9" → 16/9; "1.60:1" → 1.6; padrão 16:9. */
function razao(proporcao: string | undefined): number {
  if (proporcao === "A4") return 297 / 210;
  const m = proporcao?.match(/^([\d.]+):([\d.]+)$/);
  const r = m ? Number(m[1]) / Number(m[2]) : NaN;
  return Number.isFinite(r) && r > 0 ? r : 16 / 9;
}

const LARG = 160;

function Elemento({ e, alt }: { e: ElementoTemplate; alt: number }) {
  const x = e.x * LARG;
  const y = e.y * alt;
  const w = e.w * LARG;
  const h = e.h * alt;

  switch (e.tipo) {
    case "titulo":
      return (
        <rect
          x={x}
          y={y + h * 0.2}
          width={w * 0.85}
          height={Math.max(2.5, Math.min(h * 0.6, 7))}
          rx={1}
          className="fill-primary-500/80 dark:fill-primary-400/80"
        />
      );
    case "subtitulo":
      return (
        <rect
          x={x}
          y={y + h * 0.25}
          width={w * 0.7}
          height={Math.max(2, Math.min(h * 0.5, 4))}
          rx={1}
          className="dark:fill-dark-300 fill-gray-400"
        />
      );
    case "texto": {
      const linhas = Math.max(1, Math.min(6, Math.floor(h / 4.5)));
      const passo = h / linhas;
      return (
        <g className="dark:fill-dark-400 fill-gray-300">
          {Array.from({ length: linhas }, (_, k) => (
            <rect
              key={k}
              x={x}
              y={y + k * passo + passo * 0.3}
              width={w * (k === linhas - 1 && linhas > 1 ? 0.6 : 0.95)}
              height={Math.min(2, passo * 0.45)}
              rx={0.8}
            />
          ))}
        </g>
      );
    }
    case "imagem":
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={1.5}
            className="dark:fill-dark-500 dark:stroke-dark-400 fill-gray-100 stroke-gray-300"
            strokeWidth={0.6}
          />
          <path
            d={`M${x + w * 0.2} ${y + h * 0.75} L${x + w * 0.42} ${y + h * 0.45} L${x + w * 0.58} ${y + h * 0.62} L${x + w * 0.7} ${y + h * 0.5} L${x + w * 0.85} ${y + h * 0.75} Z`}
            className="dark:fill-dark-400 fill-gray-300"
          />
        </g>
      );
    case "grafico": {
      const barras = [0.45, 0.7, 0.55, 0.9];
      const bw = (w * 0.7) / barras.length;
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={1.5}
            className="dark:stroke-dark-400 fill-none stroke-gray-300"
            strokeWidth={0.6}
          />
          {barras.map((b, k) => (
            <rect
              key={k}
              x={x + w * 0.15 + k * bw}
              y={y + h * (0.9 - b * 0.75)}
              width={bw * 0.7}
              height={h * b * 0.75}
              className="fill-primary-500/50 dark:fill-primary-400/50"
            />
          ))}
        </g>
      );
    }
    case "tabela": {
      const linhas = 4;
      return (
        <g
          className="dark:stroke-dark-400 fill-none stroke-gray-300"
          strokeWidth={0.6}
        >
          <rect x={x} y={y} width={w} height={h} rx={1} />
          {Array.from({ length: linhas - 1 }, (_, k) => (
            <line
              key={`l${k}`}
              x1={x}
              x2={x + w}
              y1={y + ((k + 1) * h) / linhas}
              y2={y + ((k + 1) * h) / linhas}
            />
          ))}
          <line x1={x + w / 2} x2={x + w / 2} y1={y} y2={y + h} />
        </g>
      );
    }
    default:
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={1.5}
          className="dark:stroke-dark-500 fill-none stroke-gray-300"
          strokeWidth={0.5}
          strokeDasharray="2 1.5"
        />
      );
  }
}

/** Um slide em wireframe, no tamanho do contêiner (largura 100%). */
export function SlideWireframe({
  slide,
  proporcao,
  className,
}: {
  slide: SlideTemplate | null;
  proporcao?: string;
  className?: string;
}) {
  const alt = LARG / razao(proporcao);
  return (
    <svg
      viewBox={`0 0 ${LARG} ${alt}`}
      role="img"
      aria-label={
        slide
          ? `Estrutura do slide ${slide.indice}: ${ROTULO_ARQUETIPO[slide.arquetipo]}`
          : "Sem prévia"
      }
      className={clsx(
        "dark:border-dark-500 dark:bg-dark-800 block w-full rounded-md border border-gray-200 bg-white",
        className,
      )}
    >
      {slide?.elementos.map((e, k) => <Elemento key={k} e={e} alt={alt} />)}
    </svg>
  );
}

/** Grade de miniaturas de todos os slides analisados. */
export function TemplatePreviaGrade({
  estrutura,
}: {
  estrutura: TemplateEstrutura;
}) {
  const ocultos = estrutura.totalSlides - estrutura.slides.length;
  return (
    <div>
      <div className="dark:text-dark-300 text-xs-plus flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500">
        <span>
          {estrutura.totalSlides}{" "}
          {estrutura.totalSlides === 1 ? "slide" : "slides"}
        </span>
        <span aria-hidden>·</span>
        <span>Proporção {estrutura.proporcao}</span>
        {estrutura.layoutsRecorrentes.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>
              Layouts:{" "}
              {estrutura.layoutsRecorrentes
                .slice(0, 5)
                .map(
                  (l) =>
                    `${ROTULO_ARQUETIPO[l.arquetipo]}${l.ocorrencias > 1 ? ` (${l.ocorrencias})` : ""}`,
                )
                .join(", ")}
            </span>
          </>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {estrutura.slides.map((s) => (
          <li key={s.indice} className="min-w-0">
            <SlideWireframe slide={s} proporcao={estrutura.proporcao} />
            <p className="dark:text-dark-300 mt-1 truncate text-xs text-gray-500">
              <span className="tabular-nums">{s.indice}.</span>{" "}
              {ROTULO_ARQUETIPO[s.arquetipo]}
            </p>
          </li>
        ))}
      </ul>

      <p className="dark:text-dark-300 mt-3 text-xs text-gray-400">
        Prévia estrutural: mostra a composição dos slides. Cores, fontes e
        textos do arquivo não são reproduzidos — na geração, a aparência vem da
        identidade visual.
        {estrutura.geometriaAproximada &&
          " Em arquivos HTML, as posições são aproximadas a partir do código."}
        {ocultos > 0 && ` ${ocultos} slide(s) além do limite não foram analisados.`}
      </p>

      {estrutura.avisos.length > 0 && (
        <ul className="dark:text-dark-300 mt-2 list-disc space-y-0.5 ps-5 text-xs text-gray-500">
          {estrutura.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
