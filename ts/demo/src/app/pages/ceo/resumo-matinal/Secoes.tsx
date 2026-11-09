// ----------------------------------------------------------------------
// Peças visuais do Resumo Matinal. Editorial, não dashboard: cada item é uma
// linha com título, por que importa e as ações (abrir original, perguntar).
// ----------------------------------------------------------------------

import clsx from "clsx";
import type { ReactNode } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftEllipsisIcon,
  DocumentTextIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

import { Badge } from "@/components/ui";
import type { ColorType } from "@/constants/app";
import type { DocRef, Nivel } from "@/services/api/briefing";

const ROTULO_NIVEL: Record<"pt" | "en", Record<Nivel, string>> = {
  pt: { atencao: "Atenção", importante: "Importante", informativo: "Informativo", oportunidade: "Oportunidade" },
  en: { atencao: "Attention", importante: "Important", informativo: "Informative", oportunidade: "Opportunity" },
};
const COR_NIVEL: Record<Nivel, ColorType> = {
  atencao: "error",
  importante: "warning",
  informativo: "neutral",
  oportunidade: "success",
};

export function SeloNivel({ nivel, idioma }: { nivel: Nivel; idioma: "pt" | "en" }) {
  return (
    <Badge variant="soft" color={COR_NIVEL[nivel]} className="shrink-0 text-tiny">
      {ROTULO_NIVEL[idioma][nivel]}
    </Badge>
  );
}

export function Secao({
  titulo,
  icone,
  children,
  extra,
}: {
  titulo: string;
  icone: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-primary-600 dark:text-primary-400 [&>svg]:size-5">{icone}</span>
        <h3 className="dark:text-dark-50 text-base font-semibold text-gray-800">{titulo}</h3>
        {extra && <div className="ml-auto">{extra}</div>}
      </div>
      <div className="dark:border-dark-600 dark:bg-dark-700 dark:divide-dark-600 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
        {children}
      </div>
    </section>
  );
}

/** Uma linha do briefing; destacada enquanto o Oracle fala dela. */
export function Item({
  refId,
  ativo,
  children,
}: {
  refId: string;
  ativo: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-ref={refId}
      className={clsx(
        "px-4 py-3.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl sm:px-5",
        ativo && "bg-primary-500/[0.07] ring-primary-500/40 ring-1 ring-inset",
      )}
    >
      {children}
    </div>
  );
}

const acaoBase =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors";
const acaoCor =
  "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-50";

export function LinkExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={clsx(acaoBase, acaoCor)}>
      <ArrowTopRightOnSquareIcon className="size-3.5" />
      {children}
    </a>
  );
}

export function Acao({
  onClick,
  children,
  tipo = "perguntar",
}: {
  onClick: () => void;
  children: ReactNode;
  tipo?: "perguntar" | "criar";
}) {
  const Icone = tipo === "criar" ? PlusIcon : ChatBubbleLeftEllipsisIcon;
  return (
    <button type="button" onClick={onClick} className={clsx(acaoBase, acaoCor)}>
      <Icone className="size-3.5" />
      {children}
    </button>
  );
}

/** Documentos do Repositório relacionados; clicar pergunta ao Oracle sobre ele. */
export function Documentos({ docs, onAbrir }: { docs: DocRef[]; onAbrir: (d: DocRef) => void }) {
  if (!docs.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {docs.map((d) => (
        <button
          key={d.path}
          type="button"
          title={d.path}
          onClick={() => onAbrir(d)}
          className="border-primary-500/25 text-primary-600 dark:text-primary-400 bg-primary-500/5 hover:bg-primary-500/10 inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-0.5 text-tiny"
        >
          <DocumentTextIcon className="size-3 shrink-0" />
          <span className="truncate">{d.titulo}</span>
        </button>
      ))}
    </div>
  );
}

export function Meta({ children }: { children: ReactNode }) {
  return <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-500">{children}</p>;
}
