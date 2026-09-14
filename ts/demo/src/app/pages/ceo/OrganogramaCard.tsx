// Import Dependencies
import type { CSSProperties } from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Avatar, Badge } from "@/components/ui";
import type { Membro } from "@/services/api/membros";
import { rotuloArea, rotuloCargo, STATUS_MEMBRO } from "./membros-status";
import type { GrupoCargo } from "./organograma-cargos";

// ----------------------------------------------------------------------
// Card de uma pessoa no organograma.
//
// A raiz é uma `<div>`, e não um `<button>`: abrir o detalhe e recolher a
// subárvore são DUAS ações, e aninhar botão dentro de botão é HTML inválido —
// o toggle deixaria de receber o clique. Então o card tem um botão que ocupa a
// área de informação e outro, irmão, para o +/−.
// ----------------------------------------------------------------------

/** Largura fixa: colunas uniformes são o que faz o desenho ler como organograma. */
export const LARGURA_CARD = "w-56";

export function OrganogramaCard({
  membro,
  ehTopo,
  total,
  recolhido,
  onAlternar,
  onAbrir,
  grupo,
  destacado,
  esmaecido,
  idFilhos,
}: {
  membro: Membro;
  /** Topo do organograma — mesmo badge "Topo" da árvore. */
  ehTopo: boolean;
  /** Total de descendentes; 0 = sem equipe, e aí não há o que recolher. */
  total: number;
  recolhido: boolean;
  onAlternar: () => void;
  onAbrir: () => void;
  /** Grupo de cargo deste membro, para a cor do realce. */
  grupo: GrupoCargo | undefined;
  destacado: boolean;
  esmaecido: boolean;
  /** Id do `<ul>` dos filhos, para o aria-controls do toggle. */
  idFilhos: string;
}) {
  const status = STATUS_MEMBRO[membro.status];
  const cargo = rotuloCargo(membro);
  const area = rotuloArea(membro);
  const temEquipe = total > 0;

  return (
    <div
      // Âncora das conexões indiretas: é por este atributo que a camada
      // secundária encontra os cards para medir (ver useConexoesMedidas). Um
      // atributo no DOM, e não um `ref` por card, porque assim "está visível"
      // é exatamente "está no DOM" — automaticamente correto para subárvore
      // recolhida, para quem ficou fora da árvore e para os isolados, sem
      // nenhum estado espelhado que possa divergir.
      data-org-membro={membro.id}
      // Duas variáveis porque estilo inline não expressa `dark:`.
      style={
        grupo
          ? ({
              "--cargo": grupo.cor,
              "--cargo-dark": grupo.corDark,
            } as CSSProperties)
          : undefined
      }
      className={clsx(
        LARGURA_CARD,
        "dark:border-dark-600 dark:bg-dark-700 relative rounded-xl border border-gray-200 bg-white transition-opacity",
        // Membro sem acesso ativo fica atenuado, mas continua na estrutura —
        // mesma regra da árvore: desativar alguém não desfaz a hierarquia.
        membro.status === "inativo" && "opacity-60",
        destacado &&
          "dark:ring-offset-dark-700 ring-2 ring-[var(--cargo)] ring-offset-2 ring-offset-white dark:ring-[var(--cargo-dark)]",
        esmaecido && "opacity-35",
      )}
    >
      <button
        type="button"
        onClick={onAbrir}
        className="dark:hover:bg-dark-600 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-gray-50"
      >
        <Avatar
          size={9}
          name={membro.nome}
          initialColor="auto"
          classNames={{ display: "text-xs" }}
        />
        <span className="min-w-0 flex-1">
          <span className="dark:text-dark-100 block truncate text-sm font-medium text-gray-800">
            {membro.nome}
          </span>
          <span className="dark:text-dark-300 block truncate text-xs text-gray-400">
            {cargo || area || "Sem cargo nem área"}
          </span>
        </span>
      </button>

      <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
        {/* Ponto na cor do cargo: identifica o grupo mesmo com a legenda toda
            desligada, sem gastar espaço com mais um rótulo. */}
        {grupo && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-[var(--cargo)] dark:bg-[var(--cargo-dark)]"
          />
        )}
        <span className="dark:text-dark-300 text-tiny-plus min-w-0 flex-1 truncate text-gray-400">
          {area || (cargo ? "Sem área" : "")}
        </span>

        {ehTopo && (
          <Badge
            color="info"
            variant="soft"
            className="text-tiny shrink-0 rounded-full"
          >
            Topo
          </Badge>
        )}
        {/* Só INATIVO, e não todo status diferente de ativo.
            "Convite pendente" saiu daqui: é o estado de boa parte de uma
            organização em formação, e um selo repetido em metade dos cards
            vira ruído sem responder a pergunta que o organograma faz, que é
            quem responde a quem. Inativo fica porque diz que a pessoa NÃO tem
            acesso — informação que a posição na árvore não dá.
            A listagem de Colaboradores continua mostrando os três status, com filtro
            próprio; é lá que se pergunta "quem ainda não entrou?". */}
        {membro.status === "inativo" && (
          <Badge
            color={status.cor}
            variant="soft"
            className="text-tiny shrink-0 rounded-full"
          >
            {status.rotulo}
          </Badge>
        )}

        {/* Só quem tem gente abaixo ganha o controle — como no desenho de
            referência, folha não tem toggle. O total é sempre o da equipe
            inteira, aberta ou fechada: a pergunta que ele responde não depende
            do estado da tela. */}
        {temEquipe && (
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={!recolhido}
            aria-controls={idFilhos}
            aria-label={`${recolhido ? "Mostrar" : "Ocultar"} ${total} ${
              total === 1 ? "pessoa" : "pessoas"
            } abaixo de ${membro.nome}`}
            className="dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600 text-tiny-plus flex shrink-0 items-center gap-1 rounded-full border border-gray-200 px-1.5 py-0.5 font-medium text-gray-500 transition-colors hover:bg-gray-100"
          >
            <span className="tabular-nums">{total}</span>
            {recolhido ? (
              <PlusIcon className="size-3.5" />
            ) : (
              <MinusIcon className="size-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
