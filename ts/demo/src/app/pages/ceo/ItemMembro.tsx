// Import Dependencies
import clsx from "clsx";

// Local Imports
import { Avatar, Badge } from "@/components/ui";
import type { Membro } from "@/services/api/membros";
import { rotuloArea, rotuloCargo, STATUS_MEMBRO } from "./membros-status";

// ----------------------------------------------------------------------
// Linha de um membro na hierarquia.
//
// Extraída de MembrosHierarquia.tsx (sem alteração) porque tem dois
// consumidores: a árvore indentada e o card de "Fora da estrutura" do
// contêiner. O organograma NÃO a usa — lá o card precisa de dois botões
// irmãos (abrir e recolher), e isto é um `<button>` inteiro.
// ----------------------------------------------------------------------

export function ItemMembro({
  membro,
  onAbrir,
  nivel = 0,
}: {
  membro: Membro;
  onAbrir: (membro: Membro) => void;
  nivel?: number;
}) {
  const status = STATUS_MEMBRO[membro.status];
  const cargo = rotuloCargo(membro);
  const area = rotuloArea(membro);

  return (
    <button
      type="button"
      onClick={() => onAbrir(membro)}
      className={clsx(
        "dark:hover:bg-dark-600 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50",
        // Membro sem acesso ativo fica atenuado, mas continua na estrutura:
        // desativar alguém não desfaz a hierarquia.
        membro.status === "inativo" && "opacity-60",
      )}
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
          {[cargo, area].filter(Boolean).join(" · ") || "Sem cargo nem área"}
        </span>
      </span>
      {nivel === 0 && (
        <Badge color="info" variant="soft" className="shrink-0 rounded-full">
          Topo
        </Badge>
      )}
      {membro.status !== "ativo" && (
        <Badge
          color={status.cor}
          variant="soft"
          className="hidden shrink-0 rounded-full sm:inline-flex"
        >
          {status.rotulo}
        </Badge>
      )}
    </button>
  );
}
