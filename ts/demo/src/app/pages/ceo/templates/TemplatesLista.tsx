// Import Dependencies
import { useMemo, useState } from "react";
import { Menu, MenuButton, MenuItems, Transition } from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  PlusIcon,
  RectangleGroupIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import {
  Badge,
  Button,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import type { TemplateApresentacao } from "@/services/api/templates";
import { EstadoVazio, ItemAcao } from "../MarcasLista";
import { SlideWireframe } from "./TemplatePrevia";
import { ROTULO_FORMATO } from "./useTemplates";

// ----------------------------------------------------------------------
// Tabela de templates — Configurações › Geral › Aparência › Templates.
//
// Componente de apresentação, mesmo molde de `MarcasLista`: busca + contagem +
// CTA, cascata carregando → erro → vazio → tabela, kebab por linha. Quem busca,
// grava e confirma é `AbaTemplates` (AparenciaSection).
// ----------------------------------------------------------------------

export function TemplatesLista({
  templates,
  carregando,
  erro,
  podeGerenciar,
  onRecarregar,
  onCriar,
  onVisualizar,
  onEditar,
  onAlternarAtivo,
  onExcluir,
}: {
  templates: TemplateApresentacao[];
  carregando: boolean;
  erro: string | null;
  /** `false` esconde o CTA e as ações de escrita. */
  podeGerenciar: boolean;
  onRecarregar: () => void;
  onCriar: () => void;
  onVisualizar: (t: TemplateApresentacao) => void;
  onEditar: (t: TemplateApresentacao) => void;
  onAlternarAtivo: (t: TemplateApresentacao) => void;
  onExcluir: (t: TemplateApresentacao) => void;
}) {
  const [query, setQuery] = useState("");

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.nome.toLowerCase().includes(q));
  }, [templates, query]);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar template…"
            aria-label="Buscar templates"
            className="form-input dark:border-dark-450 dark:bg-dark-900 dark:text-dark-100 dark:placeholder:text-dark-300 h-9 w-full rounded-lg border border-gray-300 bg-white ps-9 pe-9 text-sm placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="dark:text-dark-300 dark:hover:text-dark-100 absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:text-gray-700"
            >
              <XMarkIcon className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className="dark:text-dark-300 text-xs-plus text-gray-500">
            {templates.length} {templates.length === 1 ? "template" : "templates"}
          </p>
          {podeGerenciar && (
            <Button
              onClick={onCriar}
              color="primary"
              className="h-9 shrink-0 gap-1.5 rounded-lg px-3"
            >
              <PlusIcon className="size-4.5 stroke-[1.5]" />
              Adicionar template
            </Button>
          )}
        </div>
      </div>

      {carregando && templates.length === 0 ? (
        <div className="mt-8 grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      ) : erro && templates.length === 0 ? (
        <EstadoVazio
          icon={RectangleGroupIcon}
          titulo="Não foi possível carregar os templates"
          hint={erro}
          acao={{ rotulo: "Tentar de novo", onClick: onRecarregar }}
        />
      ) : filtrados.length === 0 ? (
        templates.length === 0 ? (
          <EstadoVazio
            icon={RectangleGroupIcon}
            titulo="Você ainda não possui templates cadastrados."
            hint="Adicione uma apresentação de referência para orientar a IA na criação de novos conteúdos."
            acao={
              podeGerenciar
                ? { rotulo: "+ Adicionar template", onClick: onCriar }
                : undefined
            }
          />
        ) : (
          <EstadoVazio
            icon={MagnifyingGlassIcon}
            titulo="Nenhum template encontrado"
            hint="Ajuste a busca para ver mais resultados."
            acao={{ rotulo: "Limpar busca", onClick: () => setQuery("") }}
          />
        )
      ) : (
        <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <Table hoverable className="w-full min-w-2xl text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {["Template", "Formato", "Estrutura", "Atualizado em", "Status"].map(
                  (titulo) => (
                    <Th
                      key={titulo}
                      className="dark:text-dark-200 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                    >
                      {titulo}
                    </Th>
                  ),
                )}
                <Th className="w-12 py-3">
                  <span className="sr-only">Ações</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {filtrados.map((t) => (
                <Tr
                  key={t.id}
                  className="dark:border-dark-600 cursor-pointer border-b border-gray-100 last:border-0"
                  onClick={() => (podeGerenciar ? onEditar(t) : onVisualizar(t))}
                >
                  {/* whitespace-normal: o nome quebra linha em vez de empurrar
                      a tabela para a rolagem horizontal. */}
                  <Td className="py-3 whitespace-normal">
                    <div className="min-w-40">
                      <span className="dark:text-dark-100 line-clamp-2 block text-sm font-medium text-gray-800">
                        {t.nome}
                      </span>
                      {t.descricao && (
                        <span className="dark:text-dark-300 line-clamp-1 block max-w-md text-xs text-gray-400">
                          {t.descricao}
                        </span>
                      )}
                    </div>
                  </Td>

                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                    {ROTULO_FORMATO[t.formato]}
                  </Td>

                  <Td className="py-3">
                    <div
                      className="w-16"
                      title={`${t.previa.totalSlides} ${t.previa.totalSlides === 1 ? "slide" : "slides"} · ${t.previa.proporcao}`}
                    >
                      <SlideWireframe
                        slide={t.previa.primeiro}
                        proporcao={t.previa.proporcao}
                      />
                      <span className="dark:text-dark-300 mt-0.5 block text-center text-[10px] text-gray-400 tabular-nums">
                        {t.previa.totalSlides}{" "}
                        {t.previa.totalSlides === 1 ? "slide" : "slides"}
                      </span>
                    </div>
                  </Td>

                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600 tabular-nums">
                    {formatarData(t.atualizadoEm)}
                  </Td>

                  <Td className="py-3">
                    <Badge
                      color={t.ativo ? "success" : "neutral"}
                      variant="soft"
                      className="rounded-full"
                    >
                      {t.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </Td>

                  <Td className="py-3">
                    {/* stopPropagation: a linha inteira abre o template. */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <TemplateMenu
                        template={t}
                        podeGerenciar={podeGerenciar}
                        onVisualizar={() => onVisualizar(t)}
                        onEditar={() => onEditar(t)}
                        onAlternarAtivo={() => onAlternarAtivo(t)}
                        onExcluir={() => onExcluir(t)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function formatarData(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TemplateMenu({
  template,
  podeGerenciar,
  onVisualizar,
  onEditar,
  onAlternarAtivo,
  onExcluir,
}: {
  template: TemplateApresentacao;
  podeGerenciar: boolean;
  onVisualizar: () => void;
  onEditar: () => void;
  onAlternarAtivo: () => void;
  onExcluir: () => void;
}) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações de ${template.nome}`}
        className="dark:text-dark-300 dark:hover:bg-dark-500 dark:hover:text-dark-100 grid size-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <EllipsisVerticalIcon className="size-5" />
      </MenuButton>
      <Transition
        as={MenuItems}
        anchor={{ to: "bottom end", gap: 4 }}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
        className="dark:bg-dark-750 dark:border-dark-500 z-100 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
      >
        <ItemAcao icon={EyeIcon} onClick={onVisualizar}>
          Visualizar
        </ItemAcao>
        {podeGerenciar && (
          <>
            <ItemAcao icon={PencilSquareIcon} onClick={onEditar}>
              Editar
            </ItemAcao>
            <ItemAcao
              icon={template.ativo ? NoSymbolIcon : PlayCircleIcon}
              onClick={onAlternarAtivo}
            >
              {template.ativo ? "Desativar" : "Ativar"}
            </ItemAcao>
            <ItemAcao icon={TrashIcon} onClick={onExcluir} destrutivo>
              Excluir
            </ItemAcao>
          </>
        )}
      </Transition>
    </Menu>
  );
}
