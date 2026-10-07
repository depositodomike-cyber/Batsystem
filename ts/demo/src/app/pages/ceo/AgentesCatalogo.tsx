// Import Dependencies
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ChatBubbleLeftRightIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button, Spinner } from "@/components/ui";
import { getCurrentProduct, squadPath } from "@/app/navigation/ceoOs";
import { navigationIcons } from "@/app/navigation/icons";
import { useSquadsContext } from "@/app/contexts/squads/context";
import { useAssistente } from "@/app/contexts/assistente/context";
import { useAgentes } from "@/app/contexts/agentes/context";
import {
  fetchSquadCatalogApi,
  type SquadCatalogItem,
} from "@/services/api/squads";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Agentes → "Gerenciar agentes": o catálogo completo.
//
// Cada card leva ao perfil do agente (SquadDetail), fixa/desafixa no sidebar e
// abre uma conversa com ele no Assistente. Não é um lugar de conversa — o chat
// é sempre o Assistente.

export default function AgentesCatalogo() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const { catalog, catalogLoading, isPinned, toggleSquad } = useSquadsContext();
  const { inserirMencao } = useAssistente();
  const { porId } = useAgentes();
  const [busca, setBusca] = useState("");
  const podeFixar = !isFeatureTemporarilyDisabled("sidebarAgents");

  // O catálogo do contexto não traz a descrição; ela vem do mesmo GET /squads.
  const [descricoes, setDescricoes] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelado = false;
    fetchSquadCatalogApi()
      .then((itens: SquadCatalogItem[]) => {
        if (cancelado) return;
        setDescricoes(
          Object.fromEntries(itens.map((i) => [i.id, i.description ?? ""])),
        );
      })
      .catch(() => {
        // Sem descrição os cards continuam úteis (título, ícone, ações).
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const q = busca.trim().toLowerCase();
  const visiveis = q
    ? catalog.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (descricoes[s.id] ?? "").toLowerCase().includes(q),
      )
    : catalog;

  return (
    <Page title={`Agentes · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex flex-col gap-1">
          <PageTitle
            help={{
              description: (
                <p>
                  Agentes são especialistas que participam das suas conversas
                  no Assistente. Selecione um agente para trazer a
                  especialização dele para a conversa.
                </p>
              ),
            }}
          >
            Agentes
          </PageTitle>
          <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
            Especialistas que podem participar das suas conversas no
            Assistente.
          </p>
        </div>

        <div className="relative mt-5 w-full lg:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar agentes…"
            className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 focus:border-primary-500 h-10 w-full rounded-lg border border-gray-300 bg-white pr-9 pl-10 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="size-4.5" />
            </button>
          )}
        </div>

        {catalogLoading ? (
          <div className="flex justify-center py-16">
            <Spinner color="primary" className="size-6" />
          </div>
        ) : visiveis.length === 0 ? (
          <p className="dark:text-dark-300 py-16 text-center text-sm text-gray-500">
            Nenhum agente encontrado.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((squad) => {
              const Icon = navigationIcons[squad.icon];
              const fixado = isPinned(squad.id);
              return (
                <div
                  key={squad.id}
                  className="dark:border-dark-600 dark:bg-dark-700 flex flex-col rounded-2xl border border-gray-200 bg-white p-5"
                >
                  <Link
                    to={squadPath(squad)}
                    className="group flex min-w-0 items-start gap-3"
                  >
                    <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 grid size-10 shrink-0 place-items-center rounded-lg">
                      {Icon && <Icon className="size-5 stroke-[1.5]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="dark:text-dark-50 group-hover:text-primary-600 dark:group-hover:text-primary-400 block truncate text-sm font-semibold text-gray-800">
                        {squad.title}
                      </span>
                      {descricoes[squad.id] && (
                        <span className="dark:text-dark-300 mt-1 line-clamp-3 block text-xs text-gray-500">
                          {descricoes[squad.id]}
                        </span>
                      )}
                    </span>
                  </Link>

                  <div className="mt-4 flex items-center justify-end gap-2 pt-1">
                    {/* Fixar só faz sentido com o grupo Agentes visível na sidebar. */}
                    {podeFixar && (
                      <Button
                        variant="outlined"
                        onClick={() => toggleSquad(squad.id)}
                        className="mr-auto h-8 gap-1 rounded-lg px-2.5 text-xs"
                      >
                        {fixado && <CheckIcon className="size-3.5" />}
                        {fixado ? "Fixado" : "Fixar"}
                      </Button>
                    )}
                    <Button
                      color="primary"
                      onClick={() => {
                        // Insere a @menção no campo do Assistente (sem enviar).
                        const agente = porId(squad.id);
                        if (agente) inserirMencao(agente);
                      }}
                      className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                    >
                      <ChatBubbleLeftRightIcon className="size-4" />
                      Conversar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}
