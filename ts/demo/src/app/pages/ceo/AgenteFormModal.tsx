// Import Dependencies
import { useState } from "react";
import {
  CloseButton,
  Dialog,
  DialogPanel,
  DialogTitle,
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";

// Local Imports
import { Avatar, Button, ScrollShadow } from "@/components/ui";
import { AgenteAvatar } from "@/components/shared/AgenteAvatar";
import { ICONES_AGENTE } from "@/components/shared/iconesAgente";
import {
  atualizarAgenteApi,
  criarAgenteApi,
  mencaoDe,
  type AgentePessoal,
} from "@/services/api/agentes";

// ----------------------------------------------------------------------
// Criar / editar agente personalizado. `agente` nulo é criação.
//
// Mesmo casco do RoleFormModal (`as={Dialog}`, cabeçalho, ScrollShadow,
// rodapé com erro + Cancelar/Salvar). Quem chama usa `key={agente?.id ?? "novo"}`
// para o modal remontar limpo.
//
// A menção nasce do nome ("Revisor de UX" → @RevisorDeUX) e acompanha o nome
// até a pessoa editá-la à mão. A unicidade é validada no servidor (409).
// ----------------------------------------------------------------------

function mensagemDeErro(e: unknown, padrao: string): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m) && typeof m[0] === "string") return m[0];
  }
  return padrao;
}

const CAMPO =
  "form-input dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

/**
 * Escolha do avatar do agente, num popover: as iniciais do nome ou um dos
 * avatares ilustrados (pessoas) de `ICONES_AGENTE`.
 *
 * A grade só aparece quando pedida, e o campo fechado mostra o que está
 * escolhido — mesmo peso visual dos inputs ao redor.
 *
 * O popover é o mesmo par `Popover`/`PopoverPanel` ancorado do catálogo de
 * squads na sidebar. A diferença é o `z-110`: este vive dentro de um `Dialog`
 * em `z-100`, e o painel é portalado para fora do modal.
 */
function SeletorDeIcone({
  icone,
  nome,
  onEscolher,
}: {
  icone: string | null;
  nome: string;
  onEscolher: (icone: string | null) => void;
}) {
  const selecionado = ICONES_AGENTE.find((i) => i.chave === icone);
  const rotuloAtual = selecionado?.rotulo ?? "Iniciais do nome";

  return (
    <Popover className="relative">
      <PopoverButton
        className={clsx(
          CAMPO,
          "flex cursor-pointer items-center gap-2 text-left outline-hidden",
          "dark:hover:bg-dark-600 hover:bg-gray-50",
        )}
      >
        <AgenteAvatar
          titulo={nome.trim() || "Agente"}
          icone={icone}
          tamanho="md"
        />
        <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-gray-800">
          {rotuloAtual}
        </span>
        <ChevronDownIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
      </PopoverButton>

      {/* Sem animação de abrir/fechar, ao contrário dos outros popovers da
          casa. Lá o painel é multi-escolha e não fecha ao clicar; aqui
          escolher fecha, e tanto o `<Transition>` em volta quanto a prop
          `transition` deixavam o painel preso montado depois do estado já
          ter fechado (botão em `aria-expanded="false"`, painel com
          `data-closed` e `data-enter` ao mesmo tempo). Aparecer e sumir
          direto é o comportamento correto; a animação não vale o defeito. */}
      <PopoverPanel
        anchor={{ to: "bottom start", gap: 6 }}
        className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-110 w-(--button-width) min-w-72 rounded-lg border bg-white p-2 outline-hidden dark:shadow-none"
      >
        {/* `CloseButton` em vez de `button`: escolher já fecha o popover. */}
        <div
          role="radiogroup"
          aria-label="Ícone do agente"
          className="grid grid-cols-6 gap-1.5"
        >
          <CloseButton
            type="button"
            role="radio"
            aria-checked={icone === null}
            aria-label="Iniciais do nome"
            title="Iniciais do nome"
            onClick={() => onEscolher(null)}
            className={clsx(
              "grid aspect-square cursor-pointer place-items-center rounded-lg border p-1 transition-colors",
              icone === null
                ? "border-primary-500 bg-primary-600/10 dark:bg-primary-400/10"
                : "dark:border-dark-450 dark:hover:bg-dark-600 border-gray-200 hover:bg-gray-50",
            )}
          >
            <Avatar
              size={8}
              name={nome.trim() || "Agente"}
              initialColor="auto"
              classNames={{ display: "text-[10px] font-semibold" }}
            />
          </CloseButton>
          {ICONES_AGENTE.map(({ chave, rotulo, Icone }) => (
            <CloseButton
              key={chave}
              type="button"
              role="radio"
              aria-checked={icone === chave}
              aria-label={rotulo}
              title={rotulo}
              onClick={() => onEscolher(chave)}
              className={clsx(
                "grid aspect-square cursor-pointer place-items-center rounded-lg border p-1 transition-colors",
                icone === chave
                  ? "border-primary-500 bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                  : "dark:border-dark-450 dark:text-dark-200 dark:hover:bg-dark-600 border-gray-200 text-gray-500 hover:bg-gray-50",
              )}
            >
              <Icone className="size-8 rounded-full" />
            </CloseButton>
          ))}
        </div>
      </PopoverPanel>
    </Popover>
  );
}

export function AgenteFormModal({
  open,
  agente,
  onClose,
  onSalvo,
}: {
  open: boolean;
  /** Nulo = criar. Preenchido = editar. */
  agente: AgentePessoal | null;
  onClose: () => void;
  onSalvo: (agente: AgentePessoal, criado: boolean) => void;
}) {
  const editando = agente != null;

  const [nome, setNome] = useState(agente?.titulo ?? "");
  const [mencao, setMencao] = useState(agente?.mencao ?? "");
  // Editando, a menção já é "do usuário"; criando, segue o nome até ser tocada.
  const [mencaoManual, setMencaoManual] = useState(editando);
  const [descricao, setDescricao] = useState(agente?.descricao ?? "");
  const [instrucoes, setInstrucoes] = useState(agente?.instrucoes ?? "");
  // Ícone do avatar no chat; null = iniciais do nome.
  const [icone, setIcone] = useState<string | null>(agente?.icone ?? null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mencaoFinal = (mencaoManual ? mencao : mencaoDe(nome)).replace(
    /^@/,
    "",
  );

  const salvar = async () => {
    setErro(null);
    if (nome.trim() === "") {
      setErro("Informe o nome do agente.");
      return;
    }
    if (!/^[\p{L}\p{N}]{2,40}$/u.test(mencaoFinal)) {
      setErro("A menção deve ter de 2 a 40 letras ou números, sem espaços.");
      return;
    }

    setSalvando(true);
    try {
      const dados = {
        nome: nome.trim(),
        mencao: mencaoFinal,
        descricao: descricao.trim(),
        instrucoes: instrucoes.trim(),
        icone,
      };
      if (editando) {
        onSalvo(await atualizarAgenteApi(agente.id, dados), false);
      } else {
        onSalvo(await criarAgenteApi(dados), true);
      }
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar. Tente novamente."));
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
            {editando ? "Editar agente" : "Criar agente"}
          </DialogTitle>
          <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
            Crie um especialista para ajudar em tarefas específicas. Você pode
            chamá-lo com uma @menção nas conversas com o Assistente. Este
            agente é visível apenas para você.
          </p>
        </div>

        <ScrollShadow className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                Nome
              </span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Revisor de UX"
                maxLength={80}
                autoComplete="off"
                className={CAMPO}
              />
            </label>

            {/* Ícone do avatar: o que aparece na bolinha do agente no chat. */}
            <div className="text-sm">
              <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                Ícone
              </span>
              <SeletorDeIcone icone={icone} nome={nome} onEscolher={setIcone} />
            </div>

            <label className="block text-sm">
              <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                Menção
              </span>
              <div className="relative">
                <span className="dark:text-dark-300 pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-400">
                  @
                </span>
                <input
                  type="text"
                  value={mencaoFinal}
                  onChange={(e) => {
                    setMencaoManual(true);
                    setMencao(e.target.value.replace(/\s+/g, ""));
                  }}
                  placeholder="RevisorDeUX"
                  maxLength={41}
                  autoComplete="off"
                  className={`${CAMPO} pl-7`}
                />
              </div>
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
                placeholder="Especialista em análise de interfaces e experiência do usuário."
                maxLength={500}
                rows={2}
                className="form-textarea dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                Instruções
              </span>
              <textarea
                value={instrucoes}
                onChange={(e) => setInstrucoes(e.target.value)}
                placeholder="Analise interfaces considerando usabilidade, acessibilidade, hierarquia visual, consistência e clareza."
                maxLength={8000}
                rows={5}
                className="form-textarea dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="dark:text-dark-300 mt-1 block text-xs text-gray-400">
                Defina como o agente deve analisar e responder. As alterações
                valem apenas para as próximas respostas.
              </span>
            </label>
          </div>
        </ScrollShadow>

        <div className="dark:border-dark-600 shrink-0 border-t border-gray-200 px-5 py-4">
          {erro && <p className="text-error mb-3 text-sm">{erro}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outlined" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button color="primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar" : "Criar agente"}
            </Button>
          </div>
        </div>
      </TransitionChild>
    </Transition>
  );
}
