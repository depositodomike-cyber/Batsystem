// Import Dependencies
import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { atualizarMembroApi, type Membro } from "@/services/api/membros";
import type { Role } from "@/services/api/roles";
import { mensagemErroMembro } from "./membros-status";
import { RotuloCampo } from "./RotuloCampo";

// ----------------------------------------------------------------------
// Converter um CONVIDADO de volta em membro da organização.
//
// Modal próprio, e não o formulário: a direção oposta (membro → convidado)
// mora no menu da lista porque pode exigir realocar liderados, e uma direção
// no menu com a outra no formulário seria uma assimetria que ninguém adivinha.
//
// Um campo só, obrigatório. A escolha da role existe porque a alternativa é a
// pessoa sair da conversão sem acesso nenhum e sem nada na tela dizendo isso.
//
// Esta exigência nasceu aqui e hoje é geral: todo membro precisa de ao menos
// uma role, e o formulário de membro cobra a mesma coisa. O que continua sendo
// só deste modal é a MENSAGEM — quem deixa de ser convidado está escolhendo a
// primeira role, não substituindo nenhuma.
//
// Área, cargo e gestor NÃO são coletados aqui. O item da spec pede só a role, e
// pedir o resto transformaria uma reclassificação num segundo cadastro — o
// rodapé aponta onde configurá-los.
// ----------------------------------------------------------------------

export function ConvidadoParaMembroModal({
  membro,
  roles,
  onClose,
  onConcluido,
}: {
  /** Nulo = fechado. Mesma convenção do modal de realocação. */
  membro: Membro | null;
  roles: Role[];
  onClose: () => void;
  onConcluido: (atualizado: Membro) => void;
}) {
  const [roleId, setRoleId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // `editavel` é o predicado único de "role que uma pessoa pode receber": ele
  // exclui a Owner (exclusiva do proprietário) e a Convidado (é dela que a
  // pessoa está saindo) numa expressão só.
  const disponiveis = roles
    .filter((r) => r.editavel)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const confirmar = async () => {
    if (!membro || roleId === "") return;
    setErro(null);
    setSalvando(true);
    try {
      const atualizado = await atualizarMembroApi(membro.id, {
        tipo: "membro",
        roleIds: [roleId],
      });
      onConcluido(atualizado);
    } catch (err) {
      // Modal fica aberto: nada mudou, então tentar de novo é o caminho.
      setErro(
        mensagemErroMembro(
          err,
          "Não foi possível converter em membro. Tente novamente.",
        ),
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Transition show={!!membro}>
      <Dialog
        open={true}
        onClose={() => {
          if (!salvando) onClose();
        }}
        className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
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
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
          className="scrollbar-sm dark:bg-dark-700 relative w-full max-w-md overflow-y-auto rounded-lg bg-white px-5 py-6 transition-transform duration-300"
        >
          <div className="flex items-start gap-3">
            <ArrowsRightLeftIcon className="text-primary-600 dark:text-primary-400 mt-0.5 size-6 shrink-0" />
            <div className="min-w-0">
              <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
                Converter em membro
              </DialogTitle>
              <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
                {membro?.nome} passa a fazer parte da organização e volta a
                poder ter área, cargo e gestores. Escolha o acesso inicial.
              </p>
            </div>
          </div>

          <label className="mt-4 block text-sm">
            <RotuloCampo
              rotulo="Role"
              ajuda="A role Convidado é removida. Área, cargo e gestor direto ficam em branco — configure-os depois em “Editar membro”."
            />
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {/* Sem opção vazia além do placeholder: é isso que sustenta a
                  exigência sem inventar uma regra geral de "mínimo 1 role". */}
              <option value="">Selecionar role</option>
              {disponiveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                  {r.tipo === "sistema" ? " · sistema" : ""}
                </option>
              ))}
            </select>
          </label>

          {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="outlined" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              color="primary"
              onClick={confirmar}
              disabled={salvando || roleId === ""}
            >
              {salvando ? "Convertendo…" : "Converter em membro"}
            </Button>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
