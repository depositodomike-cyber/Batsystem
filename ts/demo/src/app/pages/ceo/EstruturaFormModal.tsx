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
import type {
  AtualizarEstruturaInput,
  CriarEstruturaInput,
  EstruturaItem,
  EstruturaStatus,
} from "@/services/api/estrutura";
import { mensagemErroMembro } from "./membros-status";
import { RotuloCampo } from "./RotuloCampo";

// ----------------------------------------------------------------------
// Criar / editar uma Área ou um Cargo. `item` nulo é criação.
//
// Um componente só para as duas entidades, parametrizado pela cópia: os campos
// são idênticos e só o gênero muda. Quem chama deve usar
// `key={item?.id ?? "novo"}` para o modal remontar limpo, mesma técnica dos
// outros formulários desta área.
//
// `as={Dialog}` (e não Transition > Dialog aninhados) é a forma do ConfirmModal
// compartilhado, e importa: na forma aninhada o clique que fecha o menu de
// ações da linha chega ao detector de clique-fora e fecha o modal na hora.
// ----------------------------------------------------------------------

/** Tudo que muda entre Área e Cargo. */
export interface CopyEstruturaForm {
  /** "Nova área" / "Novo cargo" */
  tituloCriar: string;
  /** "Editar área" / "Editar cargo" */
  tituloEditar: string;
  /** Frase sob o título. */
  descricaoModal: string;
  placeholderNome: string;
  placeholderDescricao: string;
  /** "Criar área" / "Criar cargo" */
  acaoCriar: string;
  statusRotulo: Record<EstruturaStatus, string>;
  /** Aviso mostrado ao desativar algo com membros. */
  avisoDesativar: (membros: number) => string;
}

export function EstruturaFormModal({
  open,
  item,
  copy,
  onClose,
  onCriar,
  onAtualizar,
  onSalvo,
}: {
  open: boolean;
  /** Nulo = criar. Preenchido = editar. */
  item: EstruturaItem | null;
  copy: CopyEstruturaForm;
  onClose: () => void;
  onCriar: (input: CriarEstruturaInput) => Promise<EstruturaItem>;
  onAtualizar: (
    id: string,
    input: AtualizarEstruturaInput,
  ) => Promise<EstruturaItem>;
  onSalvo: (item: EstruturaItem, criado: boolean) => void;
}) {
  const editando = item != null;

  const [nome, setNome] = useState(item?.nome ?? "");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [status, setStatus] = useState<EstruturaStatus>(
    item?.status ?? "ativo",
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Impacto: desativar algo que tem gente vinculada não desfaz vínculo nenhum,
  // mas tira a opção dos cadastros novos. O aviso aparece antes de salvar.
  const vaiDesativar =
    editando && status === "inativo" && item.status !== "inativo";
  const afetados = editando ? item.membros : 0;

  const salvar = async () => {
    setErro(null);

    if (nome.trim() === "") {
      setErro("Informe o nome.");
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        const atualizado = await onAtualizar(item.id, {
          nome: nome.trim(),
          descricao,
          status,
        });
        onSalvo(atualizado, false);
      } else {
        const criado = await onCriar({ nome: nome.trim(), descricao });
        onSalvo(criado, true);
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
        className="scrollbar-sm dark:bg-dark-700 relative w-full max-w-md overflow-y-auto rounded-lg bg-white px-5 py-6"
      >
        <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
          {editando ? copy.tituloEditar : copy.tituloCriar}
        </DialogTitle>
        <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
          {copy.descricaoModal}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
              Nome
            </span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={copy.placeholderNome}
              maxLength={80}
              autoComplete="off"
              className="form-input dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <RotuloCampo
              rotulo="Descrição"
              opcional
              ajuda="Apenas informativa: não afeta permissões, hierarquia nem acesso a dados."
            />
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={copy.placeholderDescricao}
              maxLength={500}
              rows={2}
              className="form-textarea dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          {/* Status só na edição: tudo nasce ativo, como o membro nasce sempre
              como convite pendente. */}
          {editando && (
            <label className="block text-sm">
              <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EstruturaStatus)}
                className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {(["ativo", "inativo"] as EstruturaStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {copy.statusRotulo[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {vaiDesativar && afetados > 0 && (
          <div className="mt-4 flex items-start gap-2">
            <ExclamationTriangleIcon className="text-warning mt-0.5 size-4.5 shrink-0" />
            <p className="dark:text-dark-200 text-xs-plus text-gray-600">
              {copy.avisoDesativar(afetados)}
            </p>
          </div>
        )}

        {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button color="primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar" : copy.acaoCriar}
          </Button>
        </div>
      </TransitionChild>
    </Transition>
  );
}
