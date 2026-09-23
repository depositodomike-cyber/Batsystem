// Import Dependencies
import { Link, useLocation } from "react-router";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useActiveDesignSystem, useDesignSystems } from "./useDesignSystem";

// ----------------------------------------------------------------------
// Barra de marca / design system — aparece em todas as ferramentas do AI
// Studio. Serve para UMA coisa: escolher qual marca a ação em curso vai usar. A
// escolha fica salva como a marca ativa deste navegador.
//
// Ela já criou e editou marca; não cria nem edita mais. Gerenciar guias de
// marca é responsabilidade de Configurações › Geral › Aparência › Guia de
// marca, e tirar a capacidade do componente — em vez de pedir a cada tela que
// não a use — é o que garante que ela não volte pela porta dos fundos numa tela
// nova.
// ----------------------------------------------------------------------

interface Props {
  className?: string;
  /**
   * Renderiza a barra como uma seção normal do formulário, sem borda, fundo nem
   * padding próprios, e com rótulo/campo no mesmo tamanho dos demais campos.
   *
   * Existe porque, dentro de um card de formulário, a barra padrão vira um card
   * dentro do card e ganha mais ênfase do que o campo principal da tela. O
   * default continua sendo o visual de sempre — as janelas do AI Studio que a
   * usam sobre o corpo do modal não mudam.
   */
  plain?: boolean;
}

export function DesignSystemBar({ className, plain = false }: Props) {
  const { brands, activeId, setActive, carregando, hidratado } =
    useDesignSystems();
  const ds = useActiveDesignSystem();
  const { pathname } = useLocation();

  // Computada aqui, e não recebida por prop: a barra só é montada sob
  // /:produto/…, e passá-la por prop obrigaria cada tela a repetir a expressão.
  const urlGuiaDeMarca = `/${getCurrentProduct(pathname).code}/configuracoes?secao=aparencia&aba=marca`;

  // Sem nenhuma marca na organização não há o que selecionar: o conteúdo sai no
  // estilo padrão da plataforma, e o campo dá lugar à explicação e ao caminho
  // para criar uma. Só depois de hidratar — piscar "nenhuma marca" e então
  // listar três é pior que meio segundo de esqueleto.
  const semMarcas = brands.length === 0;
  const vazioExplicado = hidratado && semMarcas;
  const esqueleto = !hidratado && semMarcas;

  return (
    <div
      className={clsx(
        "flex flex-wrap items-end gap-2",
        !plain &&
          "dark:border-dark-600 dark:bg-dark-800/40 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2",
        className,
      )}
    >
      <div className="min-w-[180px] flex-1">
        <label
          className={clsx(
            "mb-1 flex items-center gap-1.5 font-medium",
            plain
              ? "dark:text-dark-200 text-sm text-gray-600"
              : "dark:text-dark-300 text-tiny-plus tracking-wider text-gray-500 uppercase",
          )}
        >
          <span
            className="size-3 shrink-0 rounded-full border border-black/10"
            style={{ background: ds.cores.primaria }}
            title={`Cor primária ${ds.cores.primaria}`}
          />
          {plain ? "Marca · Design System" : "Marca · design system"}
        </label>

        {esqueleto ? (
          <div
            aria-hidden
            className="dark:bg-dark-600 h-9 w-full animate-pulse rounded-lg bg-gray-100"
          />
        ) : vazioExplicado ? (
          <div className="dark:border-dark-600 dark:bg-dark-800/40 rounded-lg border border-dashed border-gray-300 px-3 py-3">
            <p className="dark:text-dark-200 text-sm text-gray-600">
              Nenhuma identidade visual disponível nesta organização.
            </p>
            <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
              O conteúdo será gerado no estilo padrão da plataforma.
            </p>
            <Link
              to={urlGuiaDeMarca}
              className="text-primary-600 dark:text-primary-400 text-xs-plus mt-2 inline-flex items-center gap-1 font-medium"
            >
              Ir para Identidade visual
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        ) : (
          <select
            value={activeId}
            onChange={(e) => setActive(e.target.value)}
            aria-label="Marca / design system"
            className={clsx(
              "form-select dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white text-sm",
              plain
                ? "dark:border-dark-450 dark:hover:border-dark-400 focus:border-primary-500 text-gray-800 hover:border-gray-400 focus:ring-0"
                : "dark:border-dark-500 px-2.5 py-1.5",
            )}
          >
            {semMarcas ? (
              <option value="">
                {carregando ? "Carregando marcas…" : "Estilo padrão"}
              </option>
            ) : (
              brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))
            )}
          </select>
        )}
      </div>
    </div>
  );
}
