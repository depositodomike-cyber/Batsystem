// Import Dependencies
import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import {
  AtSymbolIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { navigationIcons } from "@/app/navigation/icons";
import { Button, Spinner } from "@/components/ui";
import {
  fetchSquadDetailApi,
  type SquadDetail as SquadDetailData,
} from "@/services/api/squads";
import { useSquadsContext } from "@/app/contexts/squads/context";
import { useChatsContext } from "@/app/contexts/chats/context";
import { useDocumentsContext } from "@/app/contexts/documents/context";
import type { SquadDocument } from "@/app/contexts/documents/context";
import { useAssistente } from "@/app/contexts/assistente/context";
import { useAgentes } from "@/app/contexts/agentes/context";
import { DocumentPreviewModal } from "./SidePanel";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Perfil do AGENTE (o antigo "squad").
//
// Esta tela era o chat do squad. O chat passou a ser um só — o Assistente — e
// o agente participa das conversas dele. Aqui fica o que descreve o agente:
// descrição, Skills (as especializações), especialistas de referência e a
// @menção que o chama. "Conversar" insere a menção no campo do Assistente —
// as perguntas/ações pré-definidas saíram da experiência: o pedido é escrito
// em linguagem natural ("@Cultura analise…"). Os dados seguem no banco.
//
// As conversas feitas nesta tela antes da mudança (origem "squad") não foram
// migradas: continuam em /historico/:id, listadas em "Conversas anteriores".

export default function SquadDetail() {
  const { pathname } = useLocation();
  const { squadSlug } = useParams();
  const product = getCurrentProduct(pathname);
  const { getSquadBySlug, catalogLoading, isPinned, toggleSquad } =
    useSquadsContext();
  const squad = squadSlug ? getSquadBySlug(squadSlug) : undefined;
  const { chatsByProduct } = useChatsContext();
  const { documentsBySquad } = useDocumentsContext();
  const { inserirMencao } = useAssistente();
  const { porId } = useAgentes();

  // Detalhe carregado por agente; o id junto evita mostrar o anterior ao trocar.
  const [carregado, setCarregado] = useState<{
    id: string;
    detalhe: SquadDetailData | null;
  } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SquadDocument | null>(null);

  useEffect(() => {
    if (!squad) return;
    let cancelado = false;
    fetchSquadDetailApi(squad.id)
      .then((d) => {
        if (!cancelado) setCarregado({ id: squad.id, detalhe: d });
      })
      .catch(() => {
        if (!cancelado) setCarregado({ id: squad.id, detalhe: null });
      });
    return () => {
      cancelado = true;
    };
  }, [squad]);

  if (!squad) {
    // Catálogo ainda carregando: aguarda antes de decidir se o slug é válido.
    if (catalogLoading) {
      return (
        <Page title={product.name}>
          <div className="flex h-full items-center justify-center py-16">
            <Spinner color="primary" className="size-6" />
          </div>
        </Page>
      );
    }
    return <Navigate to={`/${product.code}/insights`} replace />;
  }

  const Icon = navigationIcons[squad.icon];
  const detail = carregado?.id === squad.id ? carregado.detalhe : undefined;
  const agente = porId(squad.id);
  const conversar = () => {
    if (agente) inserirMencao(agente);
  };

  // Conversas e documentos da tela antiga de squad (histórico local).
  const conversasAnteriores = chatsByProduct(product.code).filter(
    (c) => c.squadId === squad.id,
  );
  const documentosAnteriores = documentsBySquad(squad.id);

  // Skills = as especializações dos especialistas, sem repetir.
  const skills = detail
    ? [...new Set(detail.agents.map((a) => a.position).filter(Boolean))]
    : [];

  return (
    <Page title={`${squad.title} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="mx-auto max-w-4xl">
          {/* Cabeçalho */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 grid size-11 shrink-0 place-items-center rounded-lg">
                {Icon && <Icon className="size-5.5 stroke-[1.5]" />}
              </div>
              <div className="min-w-0">
                <p className="text-primary-600 dark:text-primary-400 text-tiny-plus font-semibold tracking-wider uppercase">
                  Agente
                </p>
                <h1 className="dark:text-dark-50 truncate text-xl font-semibold text-gray-800">
                  {squad.title}
                </h1>
                {agente && (
                  <p className="dark:text-dark-300 mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <AtSymbolIcon className="size-3.5" />
                    Mencione com <span className="font-mono">@{agente.mencao}</span> no Assistente
                  </p>
                )}
                {detail?.description && (
                  <p className="dark:text-dark-200 mt-1 max-w-2xl text-sm text-gray-600">
                    {detail.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Fixar só faz sentido com o grupo Agentes visível na sidebar. */}
              {!isFeatureTemporarilyDisabled("sidebarAgents") && (
                <Button
                  variant="outlined"
                  onClick={() => toggleSquad(squad.id)}
                  className="h-9 rounded-lg px-3 text-xs"
                >
                  {isPinned(squad.id) ? "Fixado no menu" : "Fixar no menu"}
                </Button>
              )}
              <Button
                color="primary"
                onClick={() => conversar()}
                className="h-9 gap-1.5 rounded-lg px-3 text-xs"
              >
                <ChatBubbleLeftRightIcon className="size-4" />
                Conversar com o agente
              </Button>
            </div>
          </div>

          {detail === undefined ? (
            <div className="flex justify-center py-16">
              <Spinner color="primary" className="size-6" />
            </div>
          ) : detail === null ? (
            <div className="dark:text-dark-300 py-16 text-center text-sm text-gray-500">
              Não foi possível carregar este agente. Tente novamente.
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-7">
              {/* Skills */}
              {skills.length > 0 && (
                <section>
                  <h3 className="dark:text-dark-300 text-tiny-plus mb-1 font-semibold tracking-wider text-gray-500 uppercase">
                    Skills
                  </h3>
                  <p className="dark:text-dark-400 mb-2 max-w-xl text-xs text-gray-400">
                    O que este agente sabe fazer. Ficam disponíveis quando ele
                    participa de uma conversa.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="dark:border-dark-500 dark:text-dark-200 rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Especialistas de referência (antes "Membros do squad") */}
              <section>
                <h3 className="dark:text-dark-300 text-tiny-plus mb-1 font-semibold tracking-wider text-gray-500 uppercase">
                  Especialistas de referência
                </h3>
                <p className="dark:text-dark-400 mb-2 max-w-xl text-xs text-gray-400">
                  Não são as pessoas reais. São decisões e orientações geradas
                  com base no perfil e no conteúdo publicado por elas.
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.agents.map((agent) => (
                    <span
                      key={agent.id}
                      className="dark:border-dark-500 dark:text-dark-200 rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700"
                    >
                      <span className="font-medium">{agent.reference}</span>
                      <span className="dark:text-dark-400 ml-1.5 text-gray-400">
                        · {agent.position}
                      </span>
                    </span>
                  ))}
                </div>
              </section>

              {/* Conversas/documentos da antiga tela de squad (não migrados). */}
              {(conversasAnteriores.length > 0 ||
                documentosAnteriores.length > 0) && (
                <CollapsibleSection
                  title="Conversas anteriores"
                  count={
                    conversasAnteriores.length + documentosAnteriores.length
                  }
                  defaultOpen={false}
                >
                  <p className="dark:text-dark-400 mb-2 max-w-xl text-xs text-gray-400">
                    Conversas e documentos criados antes de os agentes
                    passarem a funcionar dentro do Assistente.
                  </p>
                  <ul className="dark:divide-dark-600 dark:border-dark-600 dark:bg-dark-700 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {conversasAnteriores.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/${product.code}/historico/${c.id}`}
                          className="dark:hover:bg-dark-600 flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50"
                        >
                          <ChatBubbleLeftRightIcon className="dark:text-dark-300 size-4.5 shrink-0 text-gray-400" />
                          <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm text-gray-700">
                            {c.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {documentosAnteriores.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(d)}
                          className="dark:hover:bg-dark-600 flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-gray-50"
                        >
                          <DocumentTextIcon className="dark:text-dark-300 size-4.5 shrink-0 text-gray-400" />
                          <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm text-gray-700">
                            {d.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              )}
            </div>
          )}
        </div>
      </div>

      <DocumentPreviewModal
        document={previewDoc}
        close={() => setPreviewDoc(null)}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------

/**
 * Seção recolhível (maximizar/minimizar). O cabeçalho funciona como botão
 * de toggle e exibe um contador de itens.
 */
function CollapsibleSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "Minimizar" : "Maximizar"}
        className="dark:text-dark-300 dark:hover:text-dark-100 text-tiny-plus mb-2 flex w-full items-center gap-2 font-semibold tracking-wider text-gray-500 uppercase transition-colors hover:text-gray-700"
      >
        <ChevronDownIcon
          className={clsx(
            "size-4 shrink-0 stroke-[2] transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
        <span className="flex-1 text-start">{title}</span>
        <span className="dark:bg-dark-600 dark:text-dark-200 rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium tracking-normal text-gray-500 normal-case">
          {count}
        </span>
      </button>
      {open && children}
    </section>
  );
}
