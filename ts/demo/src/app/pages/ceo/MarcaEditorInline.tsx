// Import Dependencies
import { useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import {
  ConfirmModal,
  type ModalState,
} from "@/components/shared/ConfirmModal";
import {
  DesignSystemForm,
  MENSAGENS_EXCLUIR_MARCA,
  useEditorMarca,
} from "./design-system";

// ----------------------------------------------------------------------
// Edição de uma marca DENTRO de Configurações — a tabela dá lugar a este
// formulário, em vez de abrir uma janela sobre ela.
//
// O formulário é o mesmo `DesignSystemForm` que a janela do AI Studio usa, e as
// ações são o mesmo `useEditorMarca`. O que é próprio daqui: o cabeçalho com a
// volta para a lista, o aviso de alteração pendente e o rodapé fixo — são oito
// seções, e um rodapé no fim do documento deixaria "Salvar" fora da tela.
// ----------------------------------------------------------------------

export function MarcaEditorInline({
  brandId,
  podeGerenciar,
  onVoltar,
}: {
  brandId: string;
  /** `false` deixa o formulário visível e o rodapé de ações fora. */
  podeGerenciar: boolean;
  onVoltar: () => void;
}) {
  const {
    ds,
    setDs,
    sujo,
    salvando,
    excluindo,
    erro,
    salvar,
    excluir,
    restaurar,
  } = useEditorMarca(brandId);

  const [confirmando, setConfirmando] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState<ModalState>("pending");

  const voltar = () => {
    if (
      sujo &&
      !window.confirm("Há alterações não salvas nesta marca. Sair mesmo assim?")
    ) {
      return;
    }
    onVoltar();
  };

  const salvarEVoltar = async () => {
    if (await salvar()) onVoltar();
  };

  const confirmarExclusao = async () => {
    if (await excluir()) {
      setEstadoConfirm("success");
      onVoltar();
    } else {
      setEstadoConfirm("error");
    }
  };

  const ocupado = salvando || excluindo;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          variant="flat"
          onClick={voltar}
          className="text-xs-plus h-8 gap-1.5 px-2.5"
        >
          <ArrowLeftIcon className="size-4" /> Marcas
        </Button>
        <h4 className="dark:text-dark-50 min-w-0 truncate text-base font-semibold text-gray-800">
          {ds.marca.nome || "Sem nome"}
        </h4>
        {sujo && (
          <span className="text-warning text-tiny-plus">
            alterações não salvas
          </span>
        )}
      </div>

      <DesignSystemForm value={ds} onChange={setDs} />

      {erro && (
        <p className="text-xs-plus dark:text-error-lighter border-error/30 bg-error/10 text-error mt-4 rounded-lg border px-3 py-2">
          {erro}
        </p>
      )}

      {podeGerenciar ? (
        // Margens negativas para o rodapé colar nas bordas do SectionCard
        // (p-5 sm:p-6) em vez de flutuar dentro do padding dele.
        <div className="dark:border-dark-600 dark:bg-dark-700/95 sticky bottom-0 -mx-5 mt-4 -mb-5 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
          <Button
            variant="flat"
            onClick={() => setConfirmando(true)}
            disabled={ocupado}
            className="gap-1.5 text-rose-600 dark:text-rose-400"
          >
            <TrashIcon className="size-4" /> Excluir marca
          </Button>
          <Button
            variant="outlined"
            onClick={restaurar}
            disabled={ocupado}
            className="gap-1.5"
          >
            <SparklesIcon className="size-4" /> Restaurar sugestões
          </Button>
          <Button
            color="primary"
            onClick={() => void salvarEVoltar()}
            disabled={ocupado}
            className="gap-1.5"
          >
            {salvando ? (
              <Spinner className="size-4" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            {salvando ? "Salvando…" : "Salvar identidade visual"}
          </Button>
        </div>
      ) : (
        <p className="dark:border-dark-600 dark:text-dark-300 mt-4 border-t border-gray-200 pt-3 text-sm text-gray-500">
          Você pode consultar esta identidade visual, mas a sua role não permite
          editá-la. Fale com um administrador da organização.
        </p>
      )}

      <ConfirmModal
        show={confirmando}
        onClose={() => {
          setConfirmando(false);
          setEstadoConfirm("pending");
        }}
        onOk={() => void confirmarExclusao()}
        confirmLoading={excluindo}
        state={estadoConfirm}
        messages={MENSAGENS_EXCLUIR_MARCA(ds.marca.nome)}
      />
    </>
  );
}
