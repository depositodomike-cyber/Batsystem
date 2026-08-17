import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { agruparPorPeriodo } from "@/app/pages/ceo/conversas-periodo";
import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";
import { fetchConversasApi, type ConversaListItem } from "@/services/api/conversas";

export default function ConversasHistorico() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const { items } = useConversasContext();
  const repositorioId = useRepositorioAtivo()?.id ?? undefined;
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState<ConversaListItem[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const visiveis = busca ?? items;
  const grupos = useMemo(() => agruparPorPeriodo(visiveis), [visiveis]);

  useEffect(() => {
    setQ("");
    setBusca(null);
  }, [repositorioId]);

  const pesquisar = async (valor: string) => {
    setQ(valor);
    const termo = valor.trim();
    if (!termo) {
      setBusca(null);
      return;
    }
    setBuscando(true);
    try {
      setBusca(await fetchConversasApi({ origem: "prompt", q: termo, repositorioId }));
    } catch {
      setBusca([]);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <Page title={`Histórico de conversas · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <PageTitle
          help={{
            description: (
              <p>
                Conversas deste repositório. Busque por título ou conteúdo e
                abra qualquer uma direto, sem etapa intermediária.
              </p>
            ),
          }}
        >
          Histórico de conversas
        </PageTitle>

        <div className="relative mt-5 max-w-xl">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => void pesquisar(e.target.value)}
            placeholder="Pesquisar conversas…"
            className="form-input dark:border-dark-450 dark:bg-dark-700 w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm"
          />
        </div>

        {buscando && (
          <p className="dark:text-dark-300 mt-4 text-sm text-gray-400">
            Buscando…
          </p>
        )}

        {!buscando && visiveis.length === 0 && (
          <p className="dark:text-dark-300 mt-6 text-sm text-gray-500">
            {q.trim()
              ? "Nenhuma conversa encontrada."
              : "Nenhuma conversa ainda."}
          </p>
        )}

        <div className="mt-6 space-y-6">
          {grupos.map((g) => (
            <section key={g.periodo}>
              <h3 className="dark:text-dark-300 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
                {g.rotulo}
              </h3>
              <ul className="dark:divide-dark-500 dark:border-dark-500 mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/${product.code}/conversas/${c.id}`}
                      className="hover:bg-gray-50 dark:hover:bg-dark-600 block px-4 py-3"
                    >
                      <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
                        {c.title}
                      </p>
                      {c.preview && (
                        <p className="dark:text-dark-300 mt-0.5 truncate text-xs text-gray-400">
                          {c.preview}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Page>
  );
}
