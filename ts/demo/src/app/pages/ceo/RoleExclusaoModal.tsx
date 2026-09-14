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
//
// "Não substituir por nenhuma" só é oferecido quando ninguém ficaria sem role:
// todo membro precisa de ao menos uma, então a opção vale para quem tem uma
// segunda role e desaparece quando alguém depende só desta. A API recusa do
// mesmo jeito, dentro da transação da exclusão — aqui a opção sai de vista para
// a recusa não chegar como surpresa depois do clique.
// ----------------------------------------------------------------------

/**
 * Valor do select que tira esta role sem pôr outra no lugar.
 *
 * Só aparece quando todo mundo que a perde continua com outra role — ver
 * `membrosQueFicariamSemRole`.
 */
const SEM_ROLE = "nenhuma";

export function RoleExclusaoModal({
  role,
  roles,
  membrosQueFicariamSemRole,
  onClose,
  onExcluida,
}: {
  /** Nulo = fechado. */
  role: Role | null;
  /** Todas as roles, para montar os destinos possíveis. */
  roles: Role[];
  /**
   * Quantos membros têm ESTA como única role.
   *
   * Vem calculado de fora porque quem tem a lista de membros é a página; a
   * `Role` só carrega a contagem total de portadores, e daquela contagem não
   * se deduz quantos deles têm uma segunda role.
   */
  membrosQueFicariamSemRole: number;
  onClose: () => void;
  onExcluida: (role: Role) => void;
}) {
  const podeDeixarSemRole = membrosQueFicariamSemRole === 0;
  // Sem "Nenhuma role" na lista, o estado inicial não pode ser `SEM_ROLE`: um
  // select cujo `value` não casa com nenhuma `<option>` exibe a primeira, e a
  // tela mostraria uma substituição que o clique não faria. A string vazia é o
  // "ainda não escolhi", e trava o botão.
  //
  // Um `useState` com valor inicial basta porque a página remonta este modal a
  // cada role (`key={roleExcluindo?.id}`).
  const [destino, setDestino] = useState(podeDeixarSemRole ? SEM_ROLE : "");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const emUso = role ? role.membros : 0;
  // Owner fora dos destinos: ela é exclusiva do responsável pela conta, e
  // escolhê-la aqui só renderia 403 do backend. Com duas roles por membro a
  // recusa fica mais importante — sem ela, a substituição ACRESCENTARIA Owner a
  // todo mundo que usava a role excluída.
  const destinos = role
    ? roles.filter((r) => r.id !== role.id && r.editavel)
    : [];

  // Sem destino possível e com alguém dependendo só desta role, não há
  // exclusão que respeite a regra: o caminho é criar ou atribuir outra role
  // antes. O botão trava em vez de mandar uma requisição que a API recusaria.
  const semSaida = emUso > 0 && !podeDeixarSemRole && destinos.length === 0;
  const faltaEscolher = emUso > 0 && destino === "";

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
                ? `${emUso} ${emUso === 1 ? "colaborador usa" : "colaboradores usam"} esta role. Escolha por qual role ela será substituída antes de excluir.`
                : "Nenhum colaborador usa esta role. A exclusão não afeta ninguém."}
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
              {/* Visível para escolher, e não desabilitada: sem ela o
                  operador ficaria com um select em que a única saída é uma role
                  qualquer, sem entender por que "nenhuma" não está lá. O
                  parágrafo abaixo do campo é quem explica. */}
              {faltaEscolher && <option value="">Selecione uma role</option>}
              {podeDeixarSemRole && (
                <option value={SEM_ROLE}>Nenhuma role</option>
              )}
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

        {/* A explicação de por que "Nenhuma role" não está no select. Fica
            VISÍVEL, e não num ícone de ajuda: não descreve o campo, destrava o
            fluxo — é a regra que restringe as opções que sobraram. */}
        {emUso > 0 && !podeDeixarSemRole && (
          <p className="dark:text-dark-300 text-xs-plus mt-2 text-gray-500">
            {membrosQueFicariamSemRole === 1
              ? "1 colaborador tem esta como única role"
              : `${membrosQueFicariamSemRole} colaboradores têm esta como única role`}
            , e todo colaborador precisa de ao menos uma
            {semSaida
              ? ". Crie ou atribua outra role antes de excluir esta."
              : " — por isso não há a opção de deixar sem role."}
          </p>
        )}

        {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            color="error"
            onClick={excluir}
            disabled={excluindo || semSaida || faltaEscolher}
          >
            {excluindo ? "Excluindo…" : "Excluir role"}
          </Button>
        </div>
      </TransitionChild>
    </Transition>
  );
}
