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
import type { EstruturaItem } from "@/services/api/estrutura";
import { mensagemErroMembro } from "./membros-status";

// ----------------------------------------------------------------------
// Desativar ou excluir uma Área/Cargo que tem colaboradores, com realocação
// OPCIONAL para outra da mesma espécie.
//
// Um modal próprio, e não o `ConfirmModal` compartilhado: aquele recebe
// `title` e `description` como string e não aceita filhos, e aqui a decisão é
// um CAMPO, não um sim/não. Mesmo raciocínio (e mesma casca) de
// `RoleExclusaoModal` e `MembroRealocacaoModal`.
//
// Um componente para as quatro combinações — área/cargo × desativar/excluir —
// porque a mecânica é uma só; o que muda é texto, e texto vem da `copy`, como
// em todo o resto de Estrutura. Quem sabe se é área ou cargo é a página, que
// entra com `onConfirmar` — mesma forma de `EstruturaFormModal`, que recebe
// `onCriar`/`onAtualizar` prontos.
//
// Os dois desfechos continuam sendo diferentes — desativar sem realocar
// PRESERVA o vínculo (a entidade só sai das escolhas novas); excluir sem
// realocar o DESFAZ, porque não há como apontar para algo que deixou de
// existir — mas o modal não explica mais isso: a descrição foi encurtada a
// pedido para a contagem mais a oferta de destino. Quem quiser reintroduzir
// o aviso mexe só na `copy`; a mecânica aqui não muda.
//
// O select NUNCA é obrigatório. É a diferença em relação à saída de um gestor,
// onde a hierarquia exige um sucessor: área e cargo não sustentam nada que
// quebre por ficar vazio. O botão principal muda de rótulo conforme a escolha,
// mas nunca fica desabilitado por falta dela.
// ----------------------------------------------------------------------

/** O que muda entre Área e Cargo — gênero, substantivo e desfechos. */
export interface CopyEstruturaRealocacao {
  desativarTitulo: string;
  excluirTitulo: string;
  /**
   * O parágrafo inteiro, e não "contagem" + "explicação" concatenadas.
   *
   * Recebe `n` porque o texto muda de número em três pontos ao mesmo tempo
   * ("1 colaborador está … realocá-LO" contra "4 colaboradores estão …
   * realocá-LOS"), e montar isso de dois pedaços independentes é exatamente
   * como nasce um "1 colaborador … realocá-los".
   */
  desativarTexto: (n: number) => string;
  excluirTexto: (n: number) => string;
  rotuloCampo: string;
  opcaoSemDestino: string;
  /** Quando não há nenhuma outra ativa para receber. */
  semDestinoDisponivel: string;
  acaoDesativar: string;
  acaoDesativarComDestino: string;
  acaoExcluir: string;
  acaoExcluirComDestino: string;
  sucessoDesativar: (nome: string) => string;
  sucessoDesativarComDestino: (nome: string, destino: string) => string;
  sucessoExcluir: (nome: string) => string;
  sucessoExcluirComDestino: (nome: string, destino: string) => string;
}

export type ModoEstrutura = "desativar" | "excluir";

export function EstruturaRealocacaoModal({
  item,
  modo,
  itens,
  copy,
  onConfirmar,
  onClose,
  onConcluido,
}: {
  /** Nulo = fechado. Mesma convenção dos outros modais desta área. */
  item: EstruturaItem | null;
  modo: ModoEstrutura;
  /** Todas as áreas (ou todos os cargos), para montar os destinos. */
  itens: EstruturaItem[];
  copy: CopyEstruturaRealocacao;
  /** A chamada de API, já ligada à espécie certa pela página. */
  onConfirmar: (item: EstruturaItem, destinoId: string | null) => Promise<void>;
  onClose: () => void;
  /** Recebe a mensagem de sucesso pronta — quem dá o toast é a página. */
  onConcluido: (mensagem: string) => void;
}) {
  // `""` é "não realocar", e é o estado inicial: realocar é a exceção, não o
  // caminho esperado. Sem efeito de reset — a página remonta com `key`.
  const [destino, setDestino] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const excluindo = modo === "excluir";
  const vinculados = item?.membros ?? 0;

  // Só ativos, da mesma espécie, sem a própria. A inativa fica de fora porque
  // receber colaboradores é exatamente o que uma entidade inativa não faz — e
  // a API recusa, então oferecê-la seria oferecer um erro.
  const destinos = item
    ? itens.filter((i) => i.id !== item.id && i.status === "ativo")
    : [];

  const nomeDestino = destinos.find((i) => i.id === destino)?.nome ?? null;

  const confirmar = async () => {
    if (!item) return;
    setErro(null);
    setSalvando(true);
    try {
      await onConfirmar(item, destino === "" ? null : destino);
      onConcluido(mensagemDeSucesso(copy, modo, item.nome, nomeDestino));
    } catch (err) {
      setErro(
        mensagemErroMembro(err, "Não foi possível concluir esta alteração."),
      );
    } finally {
      setSalvando(false);
    }
  };

  const acaoPrincipal = excluindo
    ? nomeDestino
      ? copy.acaoExcluirComDestino
      : copy.acaoExcluir
    : nomeDestino
      ? copy.acaoDesativarComDestino
      : copy.acaoDesativar;

  return (
    <Transition
      appear
      show={!!item}
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
        className="dark:bg-dark-700 relative w-full max-w-md rounded-lg bg-white px-5 py-6"
      >
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="text-warning mt-0.5 size-6 shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
              {excluindo ? copy.excluirTitulo : copy.desativarTitulo}
            </DialogTitle>
            <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
              {excluindo
                ? copy.excluirTexto(vinculados)
                : copy.desativarTexto(vinculados)}
            </p>
          </div>
        </div>

        {destinos.length > 0 ? (
          <label className="mt-4 block text-sm">
            <span className="dark:text-dark-200 mb-1 flex items-center gap-1.5 font-medium text-gray-600">
              {copy.rotuloCampo}
              <span className="font-normal text-gray-400">(opcional)</span>
            </span>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{copy.opcaoSemDestino}</option>
              {destinos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="dark:text-dark-300 text-xs-plus mt-4 text-gray-500">
            {copy.semDestinoDisponivel}
          </p>
        )}

        {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          {/* Nunca desabilitado por falta de destino: concluir sem realocar é
              um desfecho legítimo, e é o que o texto acima explica. */}
          <Button
            color={excluindo ? "error" : "warning"}
            onClick={confirmar}
            disabled={salvando}
          >
            {salvando ? "Aplicando…" : acaoPrincipal}
          </Button>
        </div>
      </TransitionChild>
    </Transition>
  );
}

function mensagemDeSucesso(
  copy: CopyEstruturaRealocacao,
  modo: ModoEstrutura,
  nome: string,
  destino: string | null,
): string {
  if (modo === "excluir") {
    return destino
      ? copy.sucessoExcluirComDestino(nome, destino)
      : copy.sucessoExcluir(nome);
  }
  return destino
    ? copy.sucessoDesativarComDestino(nome, destino)
    : copy.sucessoDesativar(nome);
}
