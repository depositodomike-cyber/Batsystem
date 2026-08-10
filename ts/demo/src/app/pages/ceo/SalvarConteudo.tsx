// Import Dependencies
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  XMarkIcon,
  CpuChipIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { Input, Select, Textarea } from "@/components/ui/Form";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";

// ----------------------------------------------------------------------
// Os dois destinos de qualquer conteúdo trazido por um conector (E-mail,
// Slack…): o Repositório da IA e um Grupo. Os modais moram aqui porque as páginas
// dos conectores só diferem no que colocam dentro de `ConteudoParaSalvar` —
// ver pages/ceo/Email.tsx e pages/ceo/Slack.tsx.
// ----------------------------------------------------------------------

export interface ConteudoParaSalvar {
  /** Id estável na origem (e-mail, mensagem, thread) — evita duplicata no grupo. */
  id: string;
  titulo: string;
  conteudo: string;
  /** De onde veio, gravado na memória. Ex.: "E-mail · Camila", "Slack · #produto". */
  origem: string;
  /** Linha de contexto exibida no topo do modal. */
  contexto: string;
}

export interface GrupoOpcao {
  id: string;
  title: string;
  /** Este conteúdo já está salvo neste grupo. */
  jaTem: boolean;
}

/** Tema = pasta do Repositório. Monte a lista com `usePastasMemoria`. */
interface TemaOpcao {
  id: string;
  label: string;
}

// ----------------------------------------------------------------------
// "Salvar no Repositório" — deixa escolher o tema (uma das pastas disponíveis na
// Memória) e revisar título/conteúdo antes de gravar. A revisão importa:
// conteúdo de conector vem com assinatura, citação e ruído que não deveriam
// entrar na memória da IA.
// ----------------------------------------------------------------------

export function SalvarNaMemoriaModal({
  item,
  temas,
  close,
  onConfirm,
}: {
  item: ConteudoParaSalvar | null;
  temas: TemaOpcao[];
  close: () => void;
  onConfirm: (tema: string, titulo: string, conteudo: string) => Promise<void>;
}) {
  const [tema, setTema] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const abertoRef = useRef(false);

  // Preenche os campos quando o modal abre — e só então, para não sobrescrever
  // o que o usuário já editou.
  useEffect(() => {
    if (item && !abertoRef.current) {
      abertoRef.current = true;
      setTema(temas[0]?.id ?? "");
      setTitulo(item.titulo);
      setConteudo(item.conteudo);
      setSalvando(false);
    }
    if (!item) abertoRef.current = false;
  }, [item, temas]);

  const podeSalvar = !!tema && !!titulo.trim() && !!conteudo.trim();

  const confirmar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      await onConfirm(tema, titulo.trim(), conteudo.trim());
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell
      show={!!item}
      close={close}
      icon={CpuChipIcon}
      title="Salvar no Repositório"
      description="O conteúdo vira um contexto da IA e passa a aparecer no grafo."
      footer={
        <>
          <Button variant="outlined" className="rounded-lg" onClick={close}>
            Cancelar
          </Button>
          <Button
            color="primary"
            className="gap-1.5 rounded-lg"
            onClick={confirmar}
            disabled={salvando || !podeSalvar}
          >
            {salvando && <Spinner className="size-4" />}
            {salvando ? "Gravando…" : "Gravar no Repositório"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">
          {item?.contexto}
        </p>
        <Select
          label="Tema"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          data={temas.map((t) => ({ label: t.label, value: t.id }))}
          description="Os temas são as pastas disponíveis no Repositório."
        />
        <Input
          label="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <Textarea
          component={MemoriaTextarea}
          label="Conteúdo"
          rows={8}
          value={conteudo}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setConteudo(e.target.value)
          }
          description="Edite antes de gravar — “[[” conecta o trecho a uma nota do Repositório."
        />
      </div>
    </ModalShell>
  );
}

// ----------------------------------------------------------------------
// "Salvar no Grupo" — escolhe o agrupamento que recebe uma cópia do conteúdo.
// Sem grupos criados, oferece o atalho para criar o primeiro.
// ----------------------------------------------------------------------

export function SalvarNoGrupoModal({
  item,
  grupos,
  close,
  onConfirm,
  onCriarGrupo,
}: {
  item: ConteudoParaSalvar | null;
  grupos: GrupoOpcao[];
  close: () => void;
  onConfirm: (projectId: string) => void;
  onCriarGrupo: () => void;
}) {
  const [grupoId, setGrupoId] = useState("");
  const abertoRef = useRef(false);

  useEffect(() => {
    if (item && !abertoRef.current) {
      abertoRef.current = true;
      setGrupoId(grupos.find((g) => !g.jaTem)?.id ?? "");
    }
    if (!item) abertoRef.current = false;
  }, [item, grupos]);

  const semGrupos = grupos.length === 0;

  return (
    <ModalShell
      show={!!item}
      close={close}
      icon={FolderIcon}
      title="Salvar no Grupo"
      description="O conteúdo é copiado para o grupo e aparece na página dele."
      footer={
        <>
          <Button variant="outlined" className="rounded-lg" onClick={close}>
            Cancelar
          </Button>
          {semGrupos ? (
            <Button color="primary" className="rounded-lg" onClick={onCriarGrupo}>
              Criar grupo
            </Button>
          ) : (
            <Button
              color="primary"
              className="rounded-lg"
              onClick={() => onConfirm(grupoId)}
              disabled={!grupoId}
            >
              Salvar no grupo
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="dark:border-dark-500 dark:bg-dark-800 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
            {item?.titulo}
          </p>
          <p className="dark:text-dark-300 mt-1 line-clamp-3 text-xs-plus whitespace-pre-line text-gray-500">
            {item?.conteudo}
          </p>
        </div>

        {semGrupos ? (
          <p className="dark:text-dark-300 text-sm text-gray-500">
            Nenhum grupo criado neste produto. Crie o primeiro para guardar
            e-mails, conversas e documentos no mesmo lugar.
          </p>
        ) : (
          <Select
            label="Grupo"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            data={grupos.map((g) => ({
              label: g.jaTem ? `${g.title} (já salvo)` : g.title,
              value: g.id,
              disabled: g.jaTem,
            }))}
          />
        )}
      </div>
    </ModalShell>
  );
}

// ----------------------------------------------------------------------
// Casca comum dos dois modais (mesma moldura da tela de Notas).
// ----------------------------------------------------------------------

function ModalShell({
  show,
  close,
  icon: Icon,
  title,
  description,
  children,
  footer,
}: {
  show: boolean;
  close: () => void;
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Transition show={show}>
      <Dialog onClose={close} className="relative z-60">
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="dark:bg-black/40 fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <TransitionChild
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="dark:bg-dark-750 my-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="dark:bg-primary-500/15 bg-primary-50 grid size-10 place-items-center rounded-xl">
                    <Icon className="text-primary-600 dark:text-primary-400 size-5.5" />
                  </span>
                  <div>
                    <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                      {title}
                    </DialogTitle>
                    <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                      {description}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={close}
                  variant="flat"
                  isIcon
                  className="size-8 shrink-0 rounded-full"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>

              <div className="mt-5">{children}</div>

              <div className="mt-6 flex justify-end gap-3">{footer}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
