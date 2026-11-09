// ----------------------------------------------------------------------
// Repositório › Adicionar › Notas Autoadesivas (Windows).
//
// 1) A pessoa escolhe plum.sqlite (+ plum.sqlite-wal) da pasta do app;
// 2) revisa as notas (busca, seleção, o que já está no Repositório);
// 3) importa: cada nota vira um .md em "Notas Autoadesivas/" (ver importacao.ts).
// Tudo no navegador, sem IA: o banco não sai do computador.
// ----------------------------------------------------------------------

import { useMemo, useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

import { Badge, Button, Spinner } from "@/components/ui";
import { Checkbox, Input } from "@/components/ui/Form";
import type { ColorType } from "@/constants/app";
import { memoriaVaultSupported } from "@/utils/memoriaVault";
import { pastaContextoSalva, pastaEhCopia } from "../memoria-inventario";
import { COR_HEX, PASTA_STICKY, lerNotasAutoadesivas, type NotaAutoadesiva } from "./conversor";
import {
  PASTA_NOTAS_AUTOADESIVAS,
  importarNotas,
  indiceNotasAutoadesivas,
  montarPlanoNotas,
  situacaoDaNota,
  type ItemNota,
  type NotaNoRepositorio,
  type StatusImportacao,
} from "./importacao";

const STATUS: Record<StatusImportacao, { rotulo: string; cor: ColorType }> = {
  pendente: { rotulo: "Na fila", cor: "neutral" },
  importando: { rotulo: "Gravando…", cor: "info" },
  importada: { rotulo: "Importada", cor: "success" },
  atualizada: { rotulo: "Atualizada", cor: "success" },
  falha: { rotulo: "Falhou", cor: "error" },
};

function dataCurta(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ImportarNotasAutoadesivas({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  return (
    <Transition show={aberto}>
      <Dialog onClose={() => undefined} className="relative z-60">
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
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-2 sm:p-4">
          <TransitionChild
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="dark:bg-dark-750 flex h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
              {/* Conteúdo só existe aberto: cada abertura começa do zero. */}
              <Conteudo onClose={onClose} />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

type Fase = "arquivo" | "revisar" | "importando" | "concluido";

function Conteudo({ onClose }: { onClose: () => void }) {
  const [fase, setFase] = useState<Fase>("arquivo");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [semWal, setSemWal] = useState(false);
  /** Pasta do Repositório: não escolhida, ou só uma cópia de leitura. */
  const [semPasta, setSemPasta] = useState<"sem" | "copia" | null>(null);
  const [notas, setNotas] = useState<NotaAutoadesiva[]>([]);
  const [indice, setIndice] = useState<Map<string, NotaNoRepositorio>>(new Map());
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [pasta, setPasta] = useState(PASTA_NOTAS_AUTOADESIVAS);
  const [itens, setItens] = useState<ItemNota[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const ler = async (lista: FileList | null) => {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    setErro("");
    setLendo(true);
    try {
      const [lidas, idx, handle] = await Promise.all([
        lerNotasAutoadesivas(arquivos),
        indiceNotasAutoadesivas(),
        pastaContextoSalva(),
      ]);
      if (!lidas.length) throw new Error("Nenhuma nota com texto foi encontrada neste banco.");
      setSemPasta(!handle ? "sem" : pastaEhCopia(handle) ? "copia" : null);
      setSemWal(!arquivos.some((f) => /\.sqlite-wal$/i.test(f.name)));
      setNotas(lidas);
      setIndice(idx);
      // Já marcadas: as novas e as que mudaram desde a última importação.
      setSelecao(new Set(lidas.filter((n) => situacaoDaNota(n, idx) !== "existe").map((n) => n.id)));
      setFase("revisar");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? notas.filter((n) => n.texto.toLowerCase().includes(q)) : notas;
  }, [notas, busca]);

  const todosMarcados = visiveis.length > 0 && visiveis.every((n) => selecao.has(n.id));
  const alternarTodos = () =>
    setSelecao((s) => {
      const novo = new Set(s);
      for (const n of visiveis) {
        if (todosMarcados) novo.delete(n.id);
        else novo.add(n.id);
      }
      return novo;
    });
  const alternar = (id: string) =>
    setSelecao((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const importar = async () => {
    const plano = montarPlanoNotas(
      notas.filter((n) => selecao.has(n.id)),
      indice,
      pasta.trim() || PASTA_NOTAS_AUTOADESIVAS,
    );
    setItens(plano);
    setFase("importando");
    const fim = await importarNotas(plano, setItens);
    setFase("concluido");
    const ok = fim.filter((i) => i.status === "importada" || i.status === "atualizada").length;
    const falhas = fim.filter((i) => i.status === "falha").length;
    if (ok) toast.success(`${ok} ${ok === 1 ? "nota adicionada" : "notas adicionadas"} ao Repositório.`);
    if (falhas) toast.error(`${falhas} ${falhas === 1 ? "nota não foi gravada" : "notas não foram gravadas"}.`);
  };

  const copiarCaminho = () => {
    void navigator.clipboard
      ?.writeText(PASTA_STICKY)
      .then(() => toast.success("Caminho copiado. Cole na barra de endereço da janela de arquivos."));
  };

  const cabecalho = (
    <div className="dark:border-dark-500 flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <DialogTitle as="h3" className="dark:text-dark-50 text-base font-semibold text-gray-800">
          Importar Notas Autoadesivas
        </DialogTitle>
        <p className="dark:text-dark-300 text-xs text-gray-500">
          Do app Notas Autoadesivas do Windows para o Repositório, como notas .md. Sem IA e sem tokens.
        </p>
      </div>
      <Button
        variant="flat"
        isIcon
        className="size-8 rounded-full"
        onClick={onClose}
        disabled={fase === "importando"}
        aria-label="Fechar"
      >
        <XMarkIcon className="size-5" />
      </Button>
    </div>
  );

  // ------------------------------------------------------------ arquivo
  if (fase === "arquivo") {
    return (
      <>
        {cabecalho}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <ol className="dark:text-dark-200 list-decimal space-y-3 pl-5 text-sm text-gray-700">
            <li>
              <b>Feche o app Notas Autoadesivas</b> (assim as últimas edições ficam gravadas no banco).
            </li>
            <li>
              Clique em <b>Escolher arquivos</b> e, na janela que abrir, cole este caminho na barra de
              endereço:
              <div className="dark:bg-dark-800 dark:border-dark-500 mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <code className="dark:text-dark-100 min-w-0 flex-1 truncate text-xs text-gray-700" title={PASTA_STICKY}>
                  {PASTA_STICKY}
                </code>
                <Button variant="flat" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={copiarCaminho}>
                  <ClipboardDocumentIcon className="size-4" /> Copiar
                </Button>
              </div>
            </li>
            <li>
              Selecione <b>plum.sqlite</b> e também <b>plum.sqlite-wal</b>, se existir (segure Ctrl para
              marcar os dois). O banco é lido aqui no navegador e não é enviado para lugar nenhum.
            </li>
          </ol>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".sqlite,.sqlite-wal,.sqlite-shm"
            className="hidden"
            onChange={(e) => void ler(e.target.files)}
          />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              color="primary"
              className="gap-1.5 rounded-lg"
              disabled={lendo}
              onClick={() => inputRef.current?.click()}
            >
              {lendo && <Spinner color="primary" className="size-4" />}
              {lendo ? "Lendo as notas…" : "Escolher arquivos"}
            </Button>
            {!memoriaVaultSupported() && (
              <span className="text-warning text-xs-plus">
                Este navegador não grava na pasta do Repositório. Use Chrome ou Edge.
              </span>
            )}
          </div>
          {erro && (
            <p className="text-error mt-3 flex items-start gap-1.5 text-sm">
              <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
              {erro}
            </p>
          )}
        </div>
      </>
    );
  }

  // ------------------------------------------------------------ revisar
  if (fase === "revisar") {
    const marcadas = selecao.size;
    return (
      <>
        {cabecalho}
        <div className="dark:border-dark-500 flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:px-6">
          {semPasta && (
            <p className="text-error flex items-start gap-1.5 text-xs">
              <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
              {semPasta === "sem"
                ? "Nenhuma pasta do Repositório está conectada neste navegador. Feche esta janela, clique em “Selecionar pasta” no Repositório e importe de novo."
                : "A pasta do Repositório está aberta só para leitura neste navegador. Use o Chrome ou o Edge e selecione a pasta de novo."}
            </p>
          )}
          {semWal && (
            <p className="text-warning flex items-start gap-1.5 text-xs">
              <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
              Só o plum.sqlite foi escolhido. Se faltar alguma nota recente, feche o app Notas Autoadesivas e
              escolha também o plum.sqlite-wal.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar em ${notas.length} notas`}
              prefix={<MagnifyingGlassIcon className="size-4.5" />}
              classNames={{ root: "flex-1" }}
            />
            <Input
              label="Pasta no Repositório"
              value={pasta}
              onChange={(e) => setPasta(e.target.value)}
              classNames={{ root: "sm:w-56" }}
            />
          </div>
          <label className="dark:text-dark-200 flex items-center gap-2 text-xs text-gray-600">
            <Checkbox checked={todosMarcados} onChange={alternarTodos} aria-label="Selecionar todas" />
            Selecionar {busca ? "as encontradas" : "todas"} ({visiveis.length})
          </label>
        </div>

        <ul className="dark:divide-dark-600 flex-1 divide-y divide-gray-100 overflow-y-auto">
          {visiveis.map((n) => {
            const sit = situacaoDaNota(n, indice);
            return (
              <li key={n.id}>
                <label className="dark:hover:bg-dark-700 flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-gray-50 sm:px-6">
                  <Checkbox
                    checked={selecao.has(n.id)}
                    onChange={() => alternar(n.id)}
                    aria-label={`Selecionar ${n.titulo}`}
                    className="mt-0.5"
                  />
                  <span
                    className="mt-1 size-3 shrink-0 rounded-sm ring-1 ring-black/10"
                    style={{ background: COR_HEX[n.cor] ?? COR_HEX.Amarela }}
                    title={`Nota ${n.cor.toLowerCase()}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="dark:text-dark-50 truncate text-sm font-medium text-gray-800">{n.titulo}</span>
                      {sit === "existe" && (
                        <Badge variant="soft" color="success" className="shrink-0 rounded-full text-[11px]">
                          No Repositório
                        </Badge>
                      )}
                      {sit === "atualizada" && (
                        <Badge variant="soft" color="info" className="shrink-0 rounded-full text-[11px]">
                          Mudou desde a importação
                        </Badge>
                      )}
                    </span>
                    <span className="dark:text-dark-300 line-clamp-1 text-xs text-gray-500">
                      {n.texto.split("\n").slice(1).join(" ").trim() || " "}
                    </span>
                  </span>
                  <span className="dark:text-dark-300 shrink-0 text-[11px] text-gray-400">
                    {dataCurta(n.atualizadoEm)}
                  </span>
                </label>
              </li>
            );
          })}
          {!visiveis.length && (
            <li className="dark:text-dark-300 px-6 py-10 text-center text-sm text-gray-500">
              Nenhuma nota encontrada.
            </li>
          )}
        </ul>

        <div className="dark:border-dark-500 flex items-center justify-between gap-2 border-t border-gray-200 p-4 sm:px-6">
          <Button variant="outlined" className="rounded-lg" onClick={() => setFase("arquivo")}>
            Voltar
          </Button>
          <Button
            color="primary"
            className="rounded-lg"
            disabled={!marcadas || !memoriaVaultSupported() || !!semPasta}
            onClick={() => void importar()}
          >
            Importar {marcadas} {marcadas === 1 ? "nota" : "notas"}
          </Button>
        </div>
      </>
    );
  }

  // ------------------------------------------------- importando / concluído
  const feitas = itens.filter((i) => i.status !== "pendente" && i.status !== "importando").length;
  const ok = itens.filter((i) => i.status === "importada" || i.status === "atualizada").length;
  const falhas = itens.filter((i) => i.status === "falha");
  return (
    <>
      {cabecalho}
      <div className="dark:border-dark-500 border-b border-gray-200 px-4 py-3 sm:px-6">
        {fase === "importando" ? (
          <div className="flex items-center gap-3">
            <Spinner color="primary" className="size-4" />
            <span className="dark:text-dark-200 text-sm text-gray-700">
              Gravando {feitas} de {itens.length}…
            </span>
          </div>
        ) : (
          <p className="dark:text-dark-100 flex items-center gap-2 text-sm text-gray-800">
            <CheckCircleIcon className="text-success size-5" />
            {ok} {ok === 1 ? "nota adicionada" : "notas adicionadas"} em “{pasta.trim() || PASTA_NOTAS_AUTOADESIVAS}”
            {falhas.length ? ` · ${falhas.length} com falha` : ""}.{ok ? " Já disponíveis para a IA." : ""}
          </p>
        )}
        <div className="dark:bg-dark-500 mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className="bg-primary-500 h-full transition-all"
            style={{ width: `${itens.length ? Math.round((feitas / itens.length) * 100) : 0}%` }}
          />
        </div>
      </div>
      <ul className="dark:divide-dark-600 flex-1 divide-y divide-gray-100 overflow-y-auto">
        {itens.map((i) => (
          <li key={i.nota.id} className="flex items-center gap-3 px-4 py-2 sm:px-6">
            <span className="min-w-0 flex-1">
              <span className="dark:text-dark-100 block truncate text-sm text-gray-800">{i.nota.titulo}</span>
              <span className="dark:text-dark-300 block truncate text-[11px] text-gray-500">
                {i.erro ?? i.destino}
              </span>
            </span>
            <Badge variant="soft" color={STATUS[i.status].cor} className="shrink-0 rounded-full text-[11px]">
              {STATUS[i.status].rotulo}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="dark:border-dark-500 flex justify-end gap-2 border-t border-gray-200 p-4 sm:px-6">
        {fase === "concluido" && falhas.length > 0 && (
          <Button
            variant="outlined"
            className="rounded-lg"
            onClick={() => {
              setFase("importando");
              void importarNotas(itens, setItens).then(() => setFase("concluido"));
            }}
          >
            Tentar de novo
          </Button>
        )}
        <Button color="primary" className="rounded-lg" disabled={fase === "importando"} onClick={onClose}>
          Concluir
        </Button>
      </div>
    </>
  );
}
