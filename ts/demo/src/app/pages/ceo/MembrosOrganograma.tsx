// Import Dependencies
import { useId, useMemo, useState } from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import type { Membro } from "@/services/api/membros";
import {
  contarDescendentes,
  raizesComEquipe,
  type NoHierarquia,
} from "./hierarquia-membros";
import { OrganogramaCard } from "./OrganogramaCard";
import {
  agruparPorCargo,
  grupoNaLegenda,
  type GrupoCargo,
} from "./organograma-cargos";
import { useCameraOrganograma } from "./useCameraOrganograma";
import { conexoesIndiretas } from "./membros-indiretos";
import { useConexoesMedidas } from "./useConexoesMedidas";

// ----------------------------------------------------------------------
// Organograma: desenho de cima para baixo derivado de `gestorId`.
//
// É só CONSULTA, como a árvore: arrastar move a CÂMERA, nunca re-parenteia
// ninguém (a hierarquia continua sendo editada no cadastro do membro).
//
// Topo aqui é quem tem gente abaixo. Uma raiz sem filhos não é topo de nada —
// é alguém ainda desconectado —, e quem está nessa situação fica fora do
// desenho; a tela informa quantos são em vez de silenciá-los.
//
// A ÁRVORE é CSS puro: os conectores pai→filho são pseudo-elementos, nenhuma
// coordenada é calculada, e recolher um nó é só deixar de renderizar os filhos
// — sem recalcular layout e sem ressincronizar caminhos. Não mexa nisso.
//
// Sobre ela há uma SEGUNDA camada, um `<svg>`, com as conexões de gestor
// indireto. Ela precisa medir, e a razão é estrutural: pseudo-elemento só
// alcança quem é adjacente no DOM, e um gestor indireto não é adjacente a quem
// ele acompanha. Sem medida, a única alternativa seria mover o card para
// debaixo dele — duplicando a pessoa no desenho, que é exatamente o que a
// separação entre as duas relações existe para evitar.
//
// As duas camadas compartilham o mesmo espaço de coordenadas e a mesma escala
// (o `<svg>` mora dentro da árvore), então o traço secundário escala junto com
// o principal e nunca fica mais pesado que ele. Ver `useConexoesMedidas`.
// ----------------------------------------------------------------------

/**
 * Cotovelo de um nó FILHO.
 *
 * A faixa de 48px que `pt-12` reserva acima do card é dividida em duas metades
 * de 24px: a barra horizontal fica na divisa (`top-6`), o tronco do gestor
 * ocupa a metade de cima (desenhado no `<ul>`, que começa nessa mesma linha) e
 * a queda até o card ocupa a de baixo.
 *
 * O respiro entre irmãos vem de `px-4` AQUI, e NÃO de `gap` no `<ul>`: a barra
 * horizontal tem a largura do `<li>`, então com `gap` ela ficaria interrompida
 * no vão entre dois irmãos — o que aparece como barra pontilhada ao afastar o
 * zoom.
 */
const COTOVELO = clsx(
  "relative flex flex-col items-center px-4 pt-12",
  // Barra horizontal. Nos extremos ela começa/termina no próprio centro, o que
  // impede a linha de passar do primeiro e do último card.
  "before:absolute before:start-0 before:end-0 before:top-6 before:h-px",
  "dark:before:bg-dark-500 before:bg-gray-200 before:content-['']",
  "first:before:start-1/2 last:before:end-1/2",
  // Filho único: a barra teria largura zero — escondida para não deixar
  // resíduo de subpixel. Tronco e queda formam uma única reta.
  "only:before:hidden",
  // Queda vertical, da barra até a borda de cima do card.
  "after:absolute after:top-6 after:left-1/2 after:h-6 after:w-px after:-translate-x-1/2",
  "dark:after:bg-dark-500 after:bg-gray-200 after:content-['']",
);

/**
 * Linha dos filhos. `items-start` alinha subárvores de profundidades
 * diferentes pelo topo. Nunca `flex-wrap` aqui: envolver quebraria a barra.
 */
const FILHOS = clsx(
  "relative flex items-start justify-center",
  // Tronco: sai do meio da borda inferior do card e desce 24px até a barra.
  // O `<ul>` não tem padding-top, então o seu topo coincide com o dos `<li>` e
  // estes 24px casam exatamente com o `top-6` do cotovelo.
  "before:absolute before:top-0 before:left-1/2 before:h-6 before:w-px",
  "dark:before:bg-dark-500 before:-translate-x-1/2 before:bg-gray-200 before:content-['']",
);

export function MembrosOrganograma({
  membros,
  raizes,
  membroSelecionadoId,
  onAbrirMembro,
}: {
  membros: Membro[];
  /** Floresta já montada pelo contêiner, para não remontar a cada render. */
  raizes: NoHierarquia[];
  /**
   * Membro aberto no detalhe, para dar ênfase às conexões dele.
   *
   * Id e não o objeto: a identidade do `Membro` troca a cada refetch, o que
   * invalidaria memos sem nada ter mudado — e o id impede alguém de ler daqui
   * campos que podem estar velhos.
   *
   * A seleção é a da PÁGINA, a mesma que abre o drawer; o organograma não tem
   * um conceito próprio. Ela é zerada ao fechar o drawer, então a ênfase vale
   * enquanto o detalhe está aberto — que é justamente quando alguém está
   * lendo a lista de gestores indiretos e quer achá-los no desenho.
   */
  membroSelecionadoId: string | null;
  onAbrirMembro: (membro: Membro) => void;
}) {
  const topos = useMemo(() => raizesComEquipe(raizes), [raizes]);
  const totais = useMemo(() => contarDescendentes(raizes), [raizes]);
  const grupos = useMemo(() => agruparPorCargo(membros), [membros]);

  // Conjunto de RECOLHIDOS (não de expandidos): um conjunto de expandidos
  // precisaria ser semeado com todos os ids, e então um membro novo sob um
  // gestor intocado ficaria escondido em silêncio. Nunca é resetado quando
  // `membros` muda — um refetch não pode desfazer a exploração do usuário.
  const [recolhidos, setRecolhidos] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const alternar = (id: string) =>
    setRecolhidos((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  // Legenda multi-seleção, tudo desligado no início: o desenho abre calmo.
  const [cargosAtivos, setCargosAtivos] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const alternarCargo = (id: string) =>
    setCargosAtivos((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  // Estado PRÓPRIO, fora de `cargosAtivos`: pôr o id do chip de conexões
  // naquele conjunto faria `temFiltro` ligar sozinho, e ligar as linhas
  // esmaeceria todos os cards. São dois eixos diferentes.
  const [mostrarIndiretas, setMostrarIndiretas] = useState(true);

  const camera = useCameraOrganograma();
  const temFiltro = cargosAtivos.size > 0;

  const conexoes = useMemo(() => conexoesIndiretas(membros), [membros]);
  const { arestas, ocultas } = useConexoesMedidas(
    camera.arvoreRef,
    membros,
    conexoes,
    mostrarIndiretas,
  );

  // Id único do marcador de seta. Um id fixo colidiria se dois organogramas
  // montassem na mesma página, e o navegador resolve `url(#id)` pelo primeiro
  // do documento — as setas de um deles sumiriam sem erro nenhum.
  const idSeta = useId().replace(/:/g, "");

  const porId = useMemo(
    () => new Map(membros.map((m) => [m.id, m])),
    [membros],
  );

  /** A ponta de uma aresta está sob o filtro de cargo ligado na legenda? */
  const pontaDestacada = (id: string) => {
    const m = porId.get(id);
    return m != null && cargosAtivos.has(grupoNaLegenda(m, grupos));
  };

  return (
    <div className="space-y-2">
      {/* MOLDURA — não rola. Hospeda overlays e a grade de fundo; um
          `absolute` dentro do contêiner de rolagem rolaria com o conteúdo. */}
      <div
        className={clsx(
          "dark:border-dark-600 dark:bg-dark-700 relative overflow-hidden rounded-xl border border-gray-200 bg-white",
          // Altura limitada pela viewport. Nada de h-screen/sticky/fixed: a
          // página de Administração rola no documento.
          "h-[38rem] max-h-[calc(100dvh-var(--header-h,65px)-13rem)] min-h-80",
          // Grade tênue na MOLDURA (não no conteúdo escalado): fica sempre
          // nítida em 32px em vez de virar ruído com o zoom afastado.
          "[background-image:linear-gradient(to_right,rgb(0_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.04)_1px,transparent_1px)]",
          "[background-size:32px_32px]",
          "dark:[background-image:linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]",
          camera.arrastando && "select-none",
        )}
      >
        {/* VIEWPORT — o contêiner de rolagem; é ele a câmera. */}
        <div
          ref={camera.viewportRef}
          onPointerDown={camera.iniciarArraste}
          className={clsx(
            "h-full w-full overflow-auto overscroll-x-contain",
            camera.arrastando ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          {/* SIZER — informa à rolagem o tamanho JÁ escalado, porque
              `transform` não altera layout. */}
          <div className="relative" style={camera.sizer}>
            {/* ÁRVORE — medida SEM escala (offsetWidth ignora transform). */}
            <div
              ref={camera.arvoreRef}
              className="absolute top-0 w-max origin-top-left p-12"
              style={{
                left: camera.offsetX,
                transform: `scale(${camera.escala})`,
              }}
            >
              {/* CONEXÕES INDIRETAS — primeiro filho de propósito.
                  Posicionado e sem `z-index`, o empate é resolvido por ordem
                  de documento: o traço pinta ATRÁS dos cards e dos conectores
                  principais, então passa por trás dos cards opacos nos
                  cruzamentos e por baixo das linhas sólidas. Introduzir um
                  `z-index` criaria um contexto de empilhamento e quebraria
                  esse equilíbrio de graça.

                  `absolute inset-0` é obrigatório: se o svg entrasse no fluxo,
                  mudaria o `offsetWidth` da árvore, o observer da câmera
                  dispararia, o render seguinte remediria — e o loop não teria
                  fim.

                  `aria-hidden`: caminho geométrico não é seguível por leitor
                  de tela. A informação chega pelo detalhe do membro, que lista
                  os gestores indiretos como campo próprio. */}
              {arestas.length > 0 && (
                <svg
                  aria-hidden
                  className="dark:text-dark-500 pointer-events-none absolute inset-0 overflow-visible text-gray-300"
                >
                  <defs>
                    <marker
                      id={`seta-${idSeta}`}
                      viewBox="0 0 8 8"
                      refX="7"
                      refY="4"
                      markerWidth="5"
                      markerHeight="5"
                      // Em unidade de traço, para acompanhar a espessura.
                      markerUnits="strokeWidth"
                      orient="auto-start-reverse"
                    >
                      <path d="M0,1 L7,4 L0,7 z" fill="currentColor" />
                    </marker>
                  </defs>
                  {arestas.map((a) => {
                    const incide =
                      membroSelecionadoId != null &&
                      (a.deId === membroSelecionadoId ||
                        a.paraId === membroSelecionadoId);
                    // Duas ênfases, dois donos, e `min` para não existir "qual
                    // roda primeiro": a seleção manda na aresta, o filtro de
                    // cargo manda no card. A regra do filtro é necessária
                    // porque com ele os cards não destacados caem para 35% —
                    // sem ela, as tracejadas seriam o elemento MAIS opaco.
                    const porSelecao =
                      membroSelecionadoId == null ? 0.45 : incide ? 0.9 : 0.12;
                    const porFiltro = !temFiltro
                      ? 1
                      : pontaDestacada(a.deId) || pontaDestacada(a.paraId)
                        ? 1
                        : 0.15;
                    const de = porId.get(a.deId)?.nome ?? "";
                    const para = porId.get(a.paraId)?.nome ?? "";
                    return (
                      <path
                        key={a.chave}
                        d={`M ${a.x1},${a.y1} C ${a.cx1},${a.y1 + a.cy} ${a.cx2},${a.y2 + a.cy} ${a.x2},${a.y2}`}
                        fill="none"
                        stroke="currentColor"
                        // Sem `vector-effect="non-scaling-stroke"`: as linhas
                        // principais são `h-px`/`w-px` dentro desta mesma
                        // árvore, então escalam. Com o traço fixo em px de
                        // tela, em zoom 30% a tracejada teria 1px contra 0,3px
                        // da sólida — a secundária ficaria MAIS pesada que a
                        // principal, invertendo a hierarquia visual.
                        strokeWidth={incide ? 1.6 : 1}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        opacity={Math.min(porSelecao, porFiltro)}
                        // Direção só na aresta em ênfase: em repouso, uma seta
                        // por linha somaria peso exatamente onde a relação
                        // secundária pede menos.
                        markerEnd={incide ? `url(#seta-${idSeta})` : undefined}
                        // O tooltip é nativo, via `<title>`, e o traço é a
                        // única coisa que recebe ponteiro. O `pointerdown`
                        // continua borbulhando até o viewport, então o arraste
                        // não quebra.
                        style={{ pointerEvents: "stroke" }}
                      >
                        <title>{`Gestor indireto — ${de} → ${para}`}</title>
                      </path>
                    );
                  })}
                </svg>
              )}

              {/* Só a linha dos topos pode envolver: topos não têm cotovelo. */}
              <ul className="flex flex-wrap items-start justify-center gap-x-4 gap-y-12">
                {topos.map((no) => (
                  <NoOrganograma
                    key={no.membro.id}
                    no={no}
                    ehTopo
                    totais={totais}
                    recolhidos={recolhidos}
                    onAlternar={alternar}
                    onAbrirMembro={onAbrirMembro}
                    grupos={grupos}
                    cargosAtivos={cargosAtivos}
                    temFiltro={temFiltro}
                    arrastou={camera.arrastou}
                  />
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Legenda (canto superior esquerdo). `max-w` no celular para não
            cobrir o desenho numa tela de 375px. */}
        {grupos.length > 0 && (
          <div className="absolute start-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1.5 sm:start-4 sm:top-4 sm:max-w-[calc(100%-9rem)]">
            {grupos.map((g) => {
              const ligado = cargosAtivos.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => alternarCargo(g.id)}
                  aria-pressed={ligado}
                  className={clsx(
                    "text-tiny flex items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm transition-colors",
                    ligado
                      ? "dark:bg-dark-700 dark:border-dark-500 dark:text-dark-100 border-gray-300 bg-white text-gray-700"
                      : "dark:bg-dark-800/70 dark:border-dark-600 dark:text-dark-300 border-gray-200 bg-white/70 text-gray-400",
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: g.cor,
                      opacity: ligado ? 1 : 0.35,
                    }}
                  />
                  {g.rotulo}
                  <span className="tabular-nums opacity-60">{g.total}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Legenda das conexões, e ao mesmo tempo o liga/desliga delas — um
            controle só, no idioma dos chips de cargo. Só existe quando há
            conexão: sem elas não há dúvida a esclarecer.

            A amostra é a própria linha tracejada, e não um ponto colorido: o
            que a legenda precisa nomear é o traço. */}
        {conexoes.length > 0 && (
          // Canto inferior ESQUERDO: o direito é onde o botão flutuante de
          // chat da aplicação pousa, e ali o chip fica parcialmente coberto.
          // Os outros três cantos já estão ocupados — legenda de cargos em
          // cima à esquerda, zoom em cima à direita.
          <div className="absolute start-2 bottom-2 z-10 sm:start-4 sm:bottom-4">
            <button
              type="button"
              onClick={() => setMostrarIndiretas((v) => !v)}
              aria-pressed={mostrarIndiretas}
              title={
                mostrarIndiretas
                  ? "Ocultar as conexões de gestor indireto"
                  : "Mostrar as conexões de gestor indireto"
              }
              className={clsx(
                "text-tiny flex items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm transition-colors",
                mostrarIndiretas
                  ? "dark:bg-dark-700 dark:border-dark-500 dark:text-dark-100 border-gray-300 bg-white text-gray-700"
                  : "dark:bg-dark-800/70 dark:border-dark-600 dark:text-dark-300 border-gray-200 bg-white/70 text-gray-400",
              )}
            >
              <svg
                aria-hidden
                width="16"
                height="8"
                className="shrink-0 overflow-visible"
                style={{ opacity: mostrarIndiretas ? 1 : 0.35 }}
              >
                <path
                  d="M0,4 L16,4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              </svg>
              Gestor indireto
              <span className="tabular-nums opacity-60">{conexoes.length}</span>
            </button>
          </div>
        )}

        {/* Zoom (canto superior direito). */}
        <div className="dark:border-dark-500 dark:bg-dark-700/90 absolute end-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white/90 p-0.5 shadow-sm backdrop-blur-sm sm:end-4 sm:top-4">
          <BotaoZoom
            aria-label="Afastar"
            disabled={!camera.podeAfastar}
            onClick={() => camera.mudarZoom(-1)}
          >
            <MinusIcon className="size-4" />
          </BotaoZoom>
          <button
            type="button"
            onClick={camera.redefinirZoom}
            aria-label="Redefinir zoom para 100%"
            className="dark:text-dark-200 dark:hover:bg-dark-600 text-tiny-plus min-w-12 rounded-md px-1 py-1 font-medium text-gray-600 tabular-nums transition-colors hover:bg-gray-100"
          >
            {camera.percentual}%
          </button>
          <BotaoZoom
            aria-label="Aproximar"
            disabled={!camera.podeAproximar}
            onClick={() => camera.mudarZoom(1)}
          >
            <PlusIcon className="size-4" />
          </BotaoZoom>
        </div>
      </div>

      <p className="dark:text-dark-400 text-tiny-plus text-gray-400">
        Arraste para navegar · Ctrl + roda para dar zoom · Clique num card para
        ver o detalhe
      </p>

      {/* Contar em vez de silenciar, como esta tela já faz com quem fica fora
          da árvore e com os isolados. Acontece quando as duas pontas de uma
          conexão estão fora do desenho — alguém em ciclo, ou sem vínculo
          nenhum, que o organograma nunca mostra. */}
      {mostrarIndiretas && ocultas > 0 && (
        <p className="dark:text-dark-400 text-tiny-plus text-gray-400">
          {ocultas}{" "}
          {ocultas === 1
            ? "conexão indireta não aparece"
            : "conexões indiretas não aparecem"}{" "}
          porque as pessoas envolvidas estão fora do desenho.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------

function BotaoZoom({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="dark:text-dark-200 dark:hover:bg-dark-600 grid size-7 place-items-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function NoOrganograma({
  no,
  ehTopo,
  totais,
  recolhidos,
  onAlternar,
  onAbrirMembro,
  grupos,
  cargosAtivos,
  temFiltro,
  arrastou,
}: {
  no: NoHierarquia;
  ehTopo: boolean;
  totais: Map<string, number>;
  recolhidos: ReadonlySet<string>;
  onAlternar: (id: string) => void;
  onAbrirMembro: (membro: Membro) => void;
  grupos: GrupoCargo[];
  cargosAtivos: ReadonlySet<string>;
  temFiltro: boolean;
  arrastou: React.RefObject<boolean>;
}) {
  const id = no.membro.id;
  const recolhido = recolhidos.has(id);
  const idFilhos = `org-filhos-${id}`;

  const idGrupo = grupoNaLegenda(no.membro, grupos);
  const grupo = grupos.find((g) => g.id === idGrupo);
  const destacado = temFiltro && cargosAtivos.has(idGrupo);

  return (
    <li className={ehTopo ? "flex flex-col items-center px-4" : COTOVELO}>
      <OrganogramaCard
        membro={no.membro}
        ehTopo={ehTopo}
        total={totais.get(id) ?? 0}
        recolhido={recolhido}
        onAlternar={() => onAlternar(id)}
        // Arrastar a partir de um card navega; só clique sem movimento abre o
        // detalhe. O ref é escrito pelo handler de arraste da câmera.
        onAbrir={() => {
          if (!arrastou.current) onAbrirMembro(no.membro);
        }}
        grupo={grupo}
        destacado={destacado}
        esmaecido={temFiltro && !destacado}
        idFilhos={idFilhos}
      />

      {no.filhos.length > 0 && !recolhido && (
        <ul id={idFilhos} className={FILHOS}>
          {no.filhos.map((filho) => (
            <NoOrganograma
              key={filho.membro.id}
              no={filho}
              ehTopo={false}
              totais={totais}
              recolhidos={recolhidos}
              onAlternar={onAlternar}
              onAbrirMembro={onAbrirMembro}
              grupos={grupos}
              cargosAtivos={cargosAtivos}
              temFiltro={temFiltro}
              arrastou={arrastou}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
