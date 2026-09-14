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
import { Button, ScrollShadow } from "@/components/ui";
import { TOTAL_PERMISSOES } from "@/app/data/permissoes";
import {
  atualizarRoleApi,
  criarRoleApi,
  type Role,
} from "@/services/api/roles";
import { mensagemErroMembro } from "./membros-status";
import { MatrizPermissoes } from "./MatrizPermissoes";

// ----------------------------------------------------------------------
// Criar / editar role. `role` nulo é criação.
//
// Quem chama deve usar `key={role?.id ?? "nova"}` para o modal remontar limpo,
// mesma técnica dos outros formulários desta área.
//
// `as={Dialog}` (e não Transition > Dialog aninhados) é a forma do ConfirmModal
// compartilhado, e importa: na forma aninhada o clique que fecha o menu de ações
// da linha chega ao detector de clique-fora e fecha o modal na hora.
// ----------------------------------------------------------------------

export function RoleFormModal({
  open,
  role,
  onClose,
  onSalvo,
}: {
  open: boolean;
  /** Nulo = criar. Preenchido = editar. */
  role: Role | null;
  onClose: () => void;
  onSalvo: (role: Role, criada: boolean) => void;
}) {
  const editando = role != null;

  const [nome, setNome] = useState(role?.nome ?? "");
  const [descricao, setDescricao] = useState(role?.descricao ?? "");
  const [permissoes, setPermissoes] = useState<string[]>(
    role?.permissoes ?? [],
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Impacto: editar as permissões de uma role atinge todo mundo que a usa. O
  // aviso aparece assim que algo muda, antes de salvar — não depois.
  const permissoesMudaram =
    editando && JSON.stringify(permissoes) !== JSON.stringify(role.permissoes);
  const afetados = editando ? role.membros : 0;

  const salvar = async () => {
    setErro(null);

    if (nome.trim() === "") {
      setErro("Informe o nome da role.");
      return;
    }
    if (permissoes.length === 0) {
      setErro("Selecione ao menos uma permissão.");
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        const atualizada = await atualizarRoleApi(role.id, {
          nome: nome.trim(),
          descricao,
          permissoes,
        });
        onSalvo(atualizada, false);
      } else {
        const criada = await criarRoleApi({
          nome: nome.trim(),
          descricao,
          permissoes,
        });
        onSalvo(criada, true);
      }
    } catch (err) {
      setErro(
        mensagemErroMembro(err, "Não foi possível salvar. Tente novamente."),
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Transition
      appear
      show={open}
      as={Dialog}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
      onClose={() => {
        if (!salvando) onClose();
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
        className="dark:bg-dark-700 relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white"
      >
        <div className="shrink-0 px-5 pt-6 pb-4">
          <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
            {editando ? "Editar role" : "Nova role"}
          </DialogTitle>
          <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
            Defina o que os colaboradores com esta role podem visualizar e
            gerenciar na plataforma.
          </p>
        </div>

        <ScrollShadow className="min-h-0 flex-1 overflow-y-auto px-5">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                Nome
              </span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Gestor de conteúdo"
                maxLength={80}
                autoComplete="off"
                className="form-input dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                Descrição
                <span className="ml-1 font-normal text-gray-400">
                  (opcional)
                </span>
              </span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Pode criar e gerenciar conteúdos da organização, sem acesso às configurações administrativas."
                maxLength={500}
                rows={2}
                className="form-textarea dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="dark:bg-dark-500 my-5 h-px bg-gray-200" />

          <div className="flex items-baseline justify-between">
            <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
              Permissões
            </p>
            <p className="dark:text-dark-300 text-xs text-gray-400">
              {permissoes.length} de {TOTAL_PERMISSOES}
            </p>
          </div>
          <div className="mt-3 pb-5">
            <MatrizPermissoes
              selecionadas={permissoes}
              onChange={setPermissoes}
            />
          </div>
        </ScrollShadow>

        <div className="dark:border-dark-600 shrink-0 border-t border-gray-200 px-5 py-4">
          {permissoesMudaram && afetados > 0 && (
            <div className="mb-3 flex items-start gap-2">
              <ExclamationTriangleIcon className="text-warning mt-0.5 size-4.5 shrink-0" />
              <p className="dark:text-dark-200 text-xs-plus text-gray-600">
                Esta alteração afetará {afetados}{" "}
                {afetados === 1
                  ? "colaborador que usa"
                  : "colaboradores que usam"}{" "}
                a role <strong>{role.nome}</strong>.
              </p>
            </div>
          )}

          {erro && <p className="text-error mb-3 text-sm">{erro}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outlined" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button color="primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar" : "Criar role"}
            </Button>
          </div>
        </div>
      </TransitionChild>
    </Transition>
  );
}
