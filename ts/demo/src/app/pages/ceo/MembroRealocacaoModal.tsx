// Import Dependencies
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { UsersIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Badge, Button } from "@/components/ui";
import {
  atualizarMembroApi,
  removerMembroApi,
  type Membro,
} from "@/services/api/membros";
import { mensagemErroMembro, rotuloCargo } from "./membros-status";
import { RotuloCampo } from "./RotuloCampo";
import {
  equipeDireta,
  gestoresElegiveis,
  montarHierarquia,
} from "./hierarquia-membros";

// ----------------------------------------------------------------------
// Realocação de liderados antes de um gestor sair da estrutura.
//
// Um ConfirmModal não serve aqui: a saída exige uma DECISÃO sobre para quem a
// equipe vai, e isso é um campo, não um sim/não. Mesmo motivo pelo qual
// RoleExclusaoModal existe ao lado do ConfirmModal — e a casca é a mesma.
//
// Só aparece para quem lidera alguém. Sem liderados, o fluxo antigo continua
// no ConfirmModal, sem etapa a mais.
//
// A realocação e a saída acontecem na mesma transação no backend, que também
// reconta os liderados e revalida a hierarquia na confirmação. A contagem
// mostrada aqui é para a decisão do operador, não a autoridade da operação.
// ----------------------------------------------------------------------

/** Quantos liderados são listados por nome antes de virar "+N". */
const MAX_NOMES = 6;

/**
 * As duas formas de sair da estrutura sem que a equipe fique sem gestor.
 *
 * Houve uma terceira, `converter` — o colaborador que virava convidado —,
 * retirada da interface junto com o item de menu que a abria.
 */
export type ModoSaida = "excluir" | "desativar";

export function MembroRealocacaoModal({
  membro,
  modo,
  membros,
  onClose,
  onConcluido,
}: {
  /** Nulo = fechado. */
  membro: Membro | null;
  modo: ModoSaida;
  /** Lista completa da organização, para os liderados e os candidatos. */
  membros: Membro[];
  onClose: () => void;
  /**
   * `atualizado` é o membro DEPOIS da operação, ou nulo quando ele deixou de
   * existir (modo "excluir").
   *
   * Sem ele, o detalhe aberto sobre a mesma pessoa continuaria mostrando o
   * estado anterior — `carregar()` troca a lista, mas o membro selecionado é
   * estado separado e só é re-sincronizado à mão.
   */
  onConcluido: (
    membro: Membro,
    modo: ModoSaida,
    liderados: number,
    novaLideranca: Membro,
    atualizado: Membro | null,
  ) => void;
}) {
  const [novoGestorId, setNovoGestorId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const liderados = useMemo(
    () => (membro ? equipeDireta(membros, membro.id) : []),
    [membros, membro],
  );

  /**
   * Candidatos a nova liderança.
   *
   * `gestoresElegiveis` já é exatamente o conjunto que não cria ciclo: como
   * cada membro tem um gestor só, "criaria ciclo" é o mesmo que "está abaixo
   * deste membro", e a função remove justamente ele e todos os descendentes.
   * Nenhuma lógica de ciclo nova, aqui ou no backend.
   *
   * `foraDaArvore` sai porque, embora não crie ciclo novo, pendurar a equipe em
   * alguém preso num ciclo legado a tiraria do organograma junto.
   *
   * Não filtra por status de propósito: as regras de Gestor direto nunca
   * proibiram gestor inativo, e a interface já sinaliza isso com um selo.
   */
  const candidatos = useMemo(() => {
    if (!membro) return [];
    const { foraDaArvore } = montarHierarquia(membros);
    const soltos = new Set(foraDaArvore.map((m) => m.id));
    return (
      gestoresElegiveis(membros, membro.id)
        // Convidado não recebe liderados: a API recusa, e oferecer seria um 409
        // depois de o operador escolher.
        .filter((m) => m.tipo !== "convidado")
        .filter((m) => !soltos.has(m.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    );
  }, [membros, membro]);

  const semAlternativa = candidatos.length === 0;
  const novaLideranca = candidatos.find((m) => m.id === novoGestorId) ?? null;

  const confirmar = async () => {
    if (!membro || !novaLideranca) return;
    setErro(null);
    setSalvando(true);
    try {
      let atualizado: Membro | null = null;
      if (modo === "excluir") {
        await removerMembroApi(membro.id, novaLideranca.id);
      } else {
        atualizado = await atualizarMembroApi(membro.id, {
          status: "inativo",
          reatribuirLiderados: novaLideranca.id,
        });
      }
      onConcluido(membro, modo, liderados.length, novaLideranca, atualizado);
    } catch (err) {
      // Modal fica aberto: a operação não foi concluída e a estrutura está
      // intacta, então uma nova tentativa é o caminho natural.
      setErro(
        mensagemErroMembro(
          err,
          "Não foi possível realocar os liderados e concluir a operação. Tente novamente.",
        ),
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Transition
      appear
      show={!!membro}
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
        <div className="flex items-start gap-3">
          <UsersIcon className="text-warning mt-0.5 size-6 shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
              Realocar liderados
            </DialogTitle>
            <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
              {membro?.nome} é gestor direto de outros membros. Para{" "}
              {modo === "excluir" ? "excluir o cadastro" : "desativar o acesso"}
              , escolha quem passa a liderar essas pessoas — a nova liderança é
              aplicada antes de concluir.
            </p>
          </div>
        </div>

        <div className="dark:border-dark-600 mt-4 rounded-lg border border-gray-200 p-3">
          <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Liderados que serão realocados
          </p>
          <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-500">
            {liderados.length}{" "}
            {liderados.length === 1 ? "colaborador" : "colaboradores"}
          </p>
          <ul className="mt-3 space-y-2">
            {liderados.slice(0, MAX_NOMES).map((l) => (
              <li key={l.id} className="flex items-center gap-2.5">
                <Avatar
                  size={7}
                  name={l.nome}
                  initialColor="auto"
                  classNames={{ display: "text-tiny" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="dark:text-dark-100 text-xs-plus block truncate text-gray-800">
                    {l.nome}
                  </span>
                  {rotuloCargo(l) && (
                    <span className="dark:text-dark-300 block truncate text-xs text-gray-400">
                      {rotuloCargo(l)}
                    </span>
                  )}
                </span>
                {l.status === "inativo" && (
                  <Badge
                    color="neutral"
                    variant="soft"
                    className="rounded-full"
                  >
                    Inativo
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          {liderados.length > MAX_NOMES && (
            <p className="dark:text-dark-300 mt-2 text-xs text-gray-400">
              e outros {liderados.length - MAX_NOMES}
            </p>
          )}
          <p className="dark:text-dark-300 mt-3 text-xs text-gray-400">
            Só o gestor direto deles muda. A equipe de cada um continua como
            está, e área, cargo e role não são alterados.
          </p>
        </div>

        {semAlternativa ? (
          <div className="dark:border-dark-600 mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center">
            <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
              Não há uma nova liderança disponível
            </p>
            <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
              Todos os outros colaboradores respondem a esta pessoa. Cadastre
              alguém de fora da equipe dela, ou mude o gestor direto de um dos
              liderados, antes de continuar.
            </p>
          </div>
        ) : (
          <label className="mt-4 block text-sm">
            <RotuloCampo
              rotulo="Nova liderança"
              ajuda="Quem já responde a esta pessoa não aparece na lista, para não criar um ciclo na hierarquia."
            />
            <select
              value={novoGestorId}
              onChange={(e) => setNovoGestorId(e.target.value)}
              className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecionar membro</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.nome, rotuloCargo(c)].filter(Boolean).join(" · ")}
                  {c.status === "inativo" ? " · inativo" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {modo === "desativar" && (
          <p className="dark:text-dark-300 mt-3 text-xs text-gray-400">
            Reativar o acesso depois não devolve a equipe: os liderados
            permanecem com a nova liderança até serem alterados de novo.
          </p>
        )}

        {erro && <p className="text-error mt-3 text-sm">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            color="error"
            onClick={confirmar}
            disabled={salvando || novaLideranca == null}
          >
            {salvando
              ? "Concluindo…"
              : modo === "excluir"
                ? "Realocar e excluir"
                : "Realocar e desativar"}
          </Button>
        </div>
      </TransitionChild>
    </Transition>
  );
}
