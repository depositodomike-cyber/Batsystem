// Import Dependencies
import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { removerRoleApi, type Role } from "@/services/api/roles";
import { mensagemErroMembro } from "./membros-status";

// ----------------------------------------------------------------------
// Exclusão de role personalizada.
//
// Um ConfirmModal não serviria aqui: quando a role tem membros, a exclusão
// exige uma DECISÃO sobre para onde eles vão, e isso é um campo, não um sim/não.
// Sem role em uso, o modal é só a confirmação.
//
// A reatribuição e a exclusão acontecem na mesma transação no backend, então
// não existe instante em que alguém aponte para uma role que já não existe.
//
// Com até duas roles por membro, a resolução SUBSTITUI a role excluída: quem
// tinha [A] fica [X], quem tinha [A, B] fica [B, X], e quem já tinha X só perde
// o vínculo com A. Nunca passa de duas.
// ----------------------------------------------------------------------

/** Valor do select que deixa os membros sem role nenhuma. */
const SEM_ROLE = "nenhuma";

export function RoleExclusaoModal({
  role,
  roles,
  onClose,
  onExcluida,
}: {
  /** Nulo = fechado. */
  role: Role | null;
  /** Todas as roles, para montar os destinos possíveis. */
  roles: Role[];
  onClose: () => void;
  onExcluida: (role: Role) => void;
}) {
  const [destino, setDestino] = useState(SEM_ROLE);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const emUso = role ? role.membros : 0;
  // Owner fora dos destinos: ela é exclusiva do responsável pela conta, e
  // escolhê-la aqui só renderia 403 do backend. Com duas roles por membro a
  // recusa fica mais importante — sem ela, a substituição ACRESCENTARIA Owner a
  // todo mundo que usava a role excluída.
  const destinos = role
    ? roles.filter((r) => r.id !== role.id && r.codigo !== "owner")
    : [];

  const excluir = async () => {
    if (!role) return;
    setErro(null);
    setExcluindo(true);
    try {
      // Só manda resolução quando há alguém para reatribuir; a API recusa a
      // exclusão sem isso justamente para a decisão nunca ser implícita.
      await removerRoleApi(role.id, emUso > 0 ? destino : undefined);
      onExcluida(role);
    } catch (err) {
      setErro(
        mensagemErroMembro(err, "Não foi possível excluir. Tente novamente."),
      );
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Transition
      appear
      show={!!role}
      as={Dialog}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
      onClose={() => {
        if (!excluindo) onClose();
      }}
    >
      <TransitionChild
        as="div"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="absolute inset-0 bg-gray-900/50 transition-opacity dark:bg-black/40"
      />

      <TransitionChild
        as={DialogPanel}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="dark:bg-dark-700 relative w-full max-w-md rounded-lg bg-white px-5 py-6"
      >
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="text-warning mt-0.5 size-6 shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
              Excluir a role {role?.nome}?
            </DialogTitle>
            <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
              {emUso > 0
                ? `${emUso} ${emUso === 1 ? "membro usa" : "membros usam"} esta role. Escolha por qual role ela será substituída antes de excluir.`
                : "Nenhum membro usa esta role. A exclusão não afeta ninguém."}
            </p>
          </div>
        </div>

        {emUso > 0 && (
          <label className="mt-4 block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Substituir por
            </span>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value={SEM_ROLE}>Nenhuma role</option>
              {/* Quem tinha esta role e mais uma continua com a outra: a
                  substituição troca só a role excluída. */}
              {destinos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={excluindo}>
            Cancelar
          </Button>
          <Button color="error" onClick={excluir} disabled={excluindo}>
            {excluindo ? "Excluindo…" : "Excluir role"}
          </Button>
        </div>
      </TransitionChild>
    </Transition>
  );
}
