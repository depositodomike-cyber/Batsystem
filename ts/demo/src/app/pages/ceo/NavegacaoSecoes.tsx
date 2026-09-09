// Import Dependencies
import clsx from "clsx";

// Local Imports
import { ScrollShadow } from "@/components/ui";
import { DISABLED_MENU_CLASS } from "@/app/data/temporarilyDisabledFeatures";
import {
  gruposVisiveis,
  secaoEstaDesabilitada,
  type SecaoId,
} from "./configuracoes-secoes";

// ----------------------------------------------------------------------
// Navegação lateral de Configurações, agrupada por rótulos de seção.
//
// Arquivo próprio não por reuso — o consumidor é um só — mas por tamanho: são
// ~50 linhas de apresentação pura saindo de uma página que passou de 700 ao
// absorver Administração. A superfície é estreita de propósito: `ativo` e
// `onSelecionar`, sem variante, sem orientação, sem render prop.
//
// Abaixo de `lg` cada GRUPO vira uma linha própria, com o rótulo em cima e as
// pílulas rolando ao lado. É o mesmo DOM e a mesma pílula do desktop — o que
// muda no breakpoint é só o eixo da lista de cada grupo. Antes, o eixo do menu
// inteiro girava; agora gira menos coisa.
//
// A alternativa era uma strip plana de dez pílulas sem rótulo, e ela some com a
// informação que este componente existe para dar. A outra era o rótulo inline
// na strip, e ali ele fica indistinguível de um item desabilitado: nesta tela já
// existe texto cinza não-clicável em linha (Aparência e Voz, opacas por flag), e
// no eixo horizontal nada desambigua os dois.
// ----------------------------------------------------------------------

export function NavegacaoSecoes({
  ativo,
  onSelecionar,
}: {
  ativo: SecaoId;
  onSelecionar: (secao: SecaoId) => void;
}) {
  const grupos = gruposVisiveis();

  return (
    <nav
      aria-label="Seções das configurações"
      className="min-w-0 lg:w-56 lg:shrink-0"
    >
      {/* `flex-col` em TODOS os breakpoints, e é a linha que não pode faltar:
          antes o cartão tinha um filho único, então a direção dele nunca
          importou (quem virava coluna era o `<ul>` interno). Com quatro grupos
          irmãos e sem isto, no desktop eles se distribuem lado a lado. */}
      {/* O padding vertical do cartão é maior que o horizontal (12px contra
          6px) de propósito: no eixo horizontal quem dá o respiro é o `px-3` de
          cada item, no vertical não havia nada e o primeiro rótulo encostava na
          borda de cima. Com `py-3` a folga do topo é a mesma do fim da lista. */}
      <div className="dark:border-dark-600 dark:bg-dark-700 flex flex-col rounded-xl border border-gray-200 bg-white px-1.5 py-3">
        {grupos.map((g) => {
          const idRotulo = `cfg-grupo-${g.id}`;
          return (
            // 20px entre grupos contra 4px entre itens: a fronteira precisa ser
            // lida à distância de um relance, e com dez itens no cartão a folga
            // é o que separa quatro listas de uma lista longa. Sem divisor —
            // rótulo mais régua codificaria a mesma coisa duas vezes.
            <div key={g.id} className="min-w-0 pt-5 first:pt-0">
              {/*
                `<p>`, e não um heading: `PageTitle` já é `h2` e o cartão do
                painel é `h3`. Um heading aqui colidiria de nível e injetaria
                quatro entradas no outline que não são seções de conteúdo — quem
                navega por headings cairia em "Geral" e não acharia nada.
                Mesma escolha de `ContextSection` na sidebar global.

                O `px-3` alinha o rótulo com o ÍCONE do item, não com o texto:
                alinhar com o texto faria recuo pendente e quebraria se o
                tamanho do ícone mudasse.

                12px em caixa alta contra 14px dos itens: o rótulo tem de ser
                legível de relance — é ele que diz onde cada seção mora —, mas
                não pode empatar com o item. Quem mantém a hierarquia nesse
                intervalo curto é a combinação caixa alta + `tracking-wider` +
                cinza, não o tamanho sozinho. Não clareie para `text-gray-400`:
                `gray-500` sobre branco dá 4.83:1, já no piso de AA.
              */}
              <p
                id={idRotulo}
                className="dark:text-dark-300 mb-2 px-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
              >
                {g.titulo}
              </p>

              {/*
                O `ScrollShadow` fica na LISTA, não no cartão. No cartão a
                máscara (`size/4` rem) apagava a borda e o fundo da direita
                quando a strip transbordava — e apagaria o rótulo junto. `size`
                menor pelo mesmo motivo: 24 dava 96px de máscara, calibrado para
                um cartão de largura total, não para uma linha de quatro itens.

                `aria-labelledby` no próprio `<ul>` em vez de `role="group"`:
                `role="list"` aceita nome acessível e o leitor anuncia "Geral,
                lista, 3 itens"; `role="group"` substituiria o papel de lista e
                perderia a contagem.
              */}
              <ScrollShadow
                component="ul"
                orientation="horizontal"
                size={8}
                aria-labelledby={idRotulo}
                className="hide-scrollbar flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible"
              >
                {g.itens.map((s) => {
                  const disabled = secaoEstaDesabilitada(s);
                  const isActive = !disabled && ativo === s.id;
                  return (
                    <li key={s.id} className="shrink-0 lg:shrink">
                      {disabled ? (
                        <div
                          aria-disabled="true"
                          className={clsx(
                            "dark:text-dark-200 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600",
                            DISABLED_MENU_CLASS,
                          )}
                        >
                          <s.icon className="size-4.5 shrink-0" />
                          {s.titulo}
                          {/* `aria-disabled` num `<div>` sem role é inerte:
                              hoje o estado indisponível não é anunciado por
                              nada, só pela opacidade. Uma linha resolve. */}
                          <span className="sr-only">(indisponível)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelecionar(s.id)}
                          // A seção vive na query string e o controle é um
                          // botão, então `"true"` e não `"page"`. Antes o item
                          // ativo era comunicado só por cor.
                          aria-current={isActive ? "true" : undefined}
                          className={clsx(
                            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary-600 dark:bg-primary-500 text-white"
                              : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-600 hover:bg-gray-100",
                          )}
                        >
                          <s.icon className="size-4.5 shrink-0" />
                          {s.titulo}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ScrollShadow>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
