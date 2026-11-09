// Peças de formulário do Perfil Pessoal — montadas só com componentes do
// Design System (Input, Textarea, Select, Tag, Button, Dialog, DatePicker).

import { useState, type KeyboardEvent } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { Button, Spinner, Tag } from "@/components/ui";
import { Input, Select, Textarea } from "@/components/ui/Form";
import { DatePicker } from "@/components/shared/form/Datepicker";

// ----------------------------------------------------------------------
// Lista de palavras (idiomas, habilidades, cursos…): digita + Enter.

export function ListaDePalavras({
  rotulo,
  valores,
  onChange,
  placeholder,
  descricao,
}: {
  rotulo: string;
  valores: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  descricao?: string;
}) {
  const [texto, setTexto] = useState("");
  const adicionar = () => {
    const novos = texto
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !valores.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (novos.length) onChange([...valores, ...novos]);
    setTexto("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionar();
    } else if (e.key === "Backspace" && !texto && valores.length) {
      onChange(valores.slice(0, -1));
    }
  };
  return (
    <div>
      <Input
        label={rotulo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={onKey}
        onBlur={adicionar}
        placeholder={placeholder ?? "Digite e pressione Enter"}
        description={descricao}
      />
      {valores.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {valores.map((v) => (
            <Tag
              key={v}
              component="span"
              variant="soft"
              color="primary"
              className="gap-1 rounded-full"
            >
              {v}
              <button
                type="button"
                aria-label={`Remover ${v}`}
                className="-mr-1 rounded-full p-0.5 hover:bg-black/10"
                onClick={() => onChange(valores.filter((x) => x !== v))}
              >
                <XMarkIcon className="size-3" />
              </button>
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Itens com detalhes (formações, interesses, objetivos, estilo de vida).

export type CampoItem = {
  chave: string;
  rotulo: string;
  tipo: "texto" | "textarea" | "select" | "data";
  opcoes?: { valor: string; rotulo: string }[];
  placeholder?: string;
  obrigatorio?: boolean;
};

type Item = { id: string } & Record<string, string>;

/** Tabela compacta de itens com Editar/Excluir por linha. */
export function ListaDeItens<T extends Item>({
  itens,
  resumo,
  onAdicionar,
  onEditar,
  onExcluir,
  rotuloAdicionar,
  vazio,
}: {
  itens: T[];
  resumo: (item: T) => { titulo: string; detalhe?: string };
  onAdicionar: () => void;
  onEditar: (item: T) => void;
  onExcluir: (item: T) => void;
  rotuloAdicionar: string;
  vazio: string;
}) {
  return (
    <div>
      {itens.length === 0 ? (
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">{vazio}</p>
      ) : (
        <ul className="dark:divide-dark-500 dark:border-dark-500 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {itens.map((item) => {
            const r = resumo(item);
            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                    {r.titulo}
                  </p>
                  {r.detalhe && (
                    <p className="dark:text-dark-300 text-xs-plus truncate text-gray-500">
                      {r.detalhe}
                    </p>
                  )}
                </div>
                <Button
                  variant="flat"
                  isIcon
                  className="size-8 shrink-0 rounded-lg"
                  aria-label={`Editar ${r.titulo}`}
                  onClick={() => onEditar(item)}
                >
                  <PencilSquareIcon className="size-4.5" />
                </Button>
                <Button
                  variant="flat"
                  isIcon
                  className="size-8 shrink-0 rounded-lg"
                  aria-label={`Excluir ${r.titulo}`}
                  onClick={() => onExcluir(item)}
                >
                  <TrashIcon className="size-4.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant="outlined"
        className="mt-3 gap-1.5 rounded-lg"
        onClick={onAdicionar}
      >
        <PlusIcon className="size-4.5" />
        {rotuloAdicionar}
      </Button>
    </div>
  );
}

/** Modal de criar/editar um item, a partir da lista de campos. */
export function ItemModal({
  aberto,
  titulo,
  campos,
  inicial,
  salvando,
  onClose,
  onSalvar,
}: {
  aberto: boolean;
  titulo: string;
  campos: CampoItem[];
  inicial: Record<string, string> | null;
  salvando: boolean;
  onClose: () => void;
  onSalvar: (valores: Record<string, string>) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [visto, setVisto] = useState<Record<string, string> | null>(null);
  if (aberto && inicial !== visto) {
    setVisto(inicial);
    setValores(inicial ?? {});
  }
  const set = (k: string, v: string) => setValores((x) => ({ ...x, [k]: v }));
  const podeSalvar =
    !salvando && campos.every((c) => !c.obrigatorio || (valores[c.chave] ?? "").trim());

  return (
    <Transition show={aberto}>
      <Dialog onClose={onClose} className="relative z-60">
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity dark:bg-black/40" />
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
            <DialogPanel className="dark:bg-dark-750 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                  {titulo}
                </DialogTitle>
                <Button
                  onClick={onClose}
                  variant="flat"
                  isIcon
                  className="size-8 shrink-0 rounded-lg"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>
              <div className="mt-5 space-y-4">
                {campos.map((c) => {
                  const v = valores[c.chave] ?? "";
                  if (c.tipo === "textarea")
                    return (
                      <Textarea
                        key={c.chave}
                        label={c.rotulo}
                        rows={3}
                        value={v}
                        placeholder={c.placeholder}
                        onChange={(e) => set(c.chave, e.target.value)}
                      />
                    );
                  if (c.tipo === "select")
                    return (
                      <Select
                        key={c.chave}
                        label={c.rotulo}
                        value={v}
                        onChange={(e) => set(c.chave, e.target.value)}
                        data={[
                          { label: "—", value: "" },
                          ...(c.opcoes ?? []).map((o) => ({ label: o.rotulo, value: o.valor })),
                        ]}
                      />
                    );
                  if (c.tipo === "data")
                    return (
                      <DatePicker
                        key={c.chave}
                        label={c.rotulo}
                        placeholder="Escolha uma data (opcional)"
                        value={v}
                        options={{ dateFormat: "Y-m-d", allowInput: true }}
                        onChange={(_: Date[], s: string) => set(c.chave, s)}
                      />
                    );
                  return (
                    <Input
                      key={c.chave}
                      label={c.rotulo}
                      value={v}
                      placeholder={c.placeholder}
                      onChange={(e) => set(c.chave, e.target.value)}
                    />
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outlined" className="rounded-lg" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="gap-1.5 rounded-lg"
                  disabled={!podeSalvar}
                  onClick={() => onSalvar(valores)}
                >
                  {salvando && <Spinner color="primary" className="size-4" />}
                  Salvar
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
