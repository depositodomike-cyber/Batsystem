// ----------------------------------------------------------------------
// Explorador do Google Drive → Repositório.
//
// Navega pelas pastas da conta conectada (somente leitura), busca, seleciona
// arquivos e pastas (pasta = importar todo o conteúdo, com subpastas), revisa
// e importa pelo pipeline existente (ver importacao.ts). Nada muda no Drive.
// ----------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  PresentationChartBarIcon,
  TableCellsIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { toast } from "sonner";

import { Badge, Button, Spinner } from "@/components/ui";
import { Checkbox, Input, Select } from "@/components/ui/Form";
import {
  contaDriveApi,
  ehNaoConectado,
  listarArquivosDriveApi,
  mensagemDoErro,
  pastaDriveApi,
  type DriveArquivo,
} from "@/services/api/googleConectores";
import { memoriaVaultSupported } from "@/utils/memoriaVault";
import { usePastasMemoria } from "../usePastasMemoria";
import {
  PASTA_DRIVE,
  executarImportacao,
  indiceDoRepositorio,
  montarPlano,
  situacaoNoRepositorio,
  type IndiceDrive,
  type ItemImportacao,
  type StatusItem,
} from "./importacao";

type Raiz = "root" | "compartilhados";
type Fase = "explorar" | "revisar" | "importando" | "concluido";
type Pasta = { id: string; nome: string };

const ROTULO_RAIZ: Record<Raiz, string> = { root: "Meu Drive", compartilhados: "Compartilhados comigo" };

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function IconeTipo({ a }: { a: DriveArquivo }) {
  const cls = "size-5 shrink-0";
  if (a.pasta) return <FolderIcon className={clsx(cls, "text-amber-500")} />;
  if (a.tipoRotulo === "Planilha" || a.tipoRotulo === "CSV")
    return <TableCellsIcon className={clsx(cls, "text-emerald-500")} />;
  if (a.tipoRotulo === "Apresentação") return <PresentationChartBarIcon className={clsx(cls, "text-orange-500")} />;
  if (a.tipoRotulo === "PDF") return <DocumentIcon className={clsx(cls, "text-red-500")} />;
  if (a.importavel) return <DocumentTextIcon className={clsx(cls, "text-sky-500")} />;
  return <DocumentIcon className={clsx(cls, "dark:text-dark-300 text-gray-400")} />;
}

const STATUS: Record<StatusItem, { rotulo: string; cor: "neutral" | "success" | "warning" | "error" | "info" }> = {
  pendente: { rotulo: "Na fila", cor: "neutral" },
  importando: { rotulo: "Importando…", cor: "info" },
  importado: { rotulo: "Importado", cor: "success" },
  atualizado: { rotulo: "Atualizado", cor: "success" },
  existe: { rotulo: "Já no Repositório", cor: "neutral" },
  "nao-suportado": { rotulo: "Não suportado", cor: "warning" },
  falha: { rotulo: "Falhou", cor: "error" },
};

export function ImportarDoDrive({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
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
            <DialogPanel className="dark:bg-dark-750 flex h-[88vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
              {/* Conteúdo só existe aberto: cada abertura começa do zero. */}
              <Explorador modo="modal" onClose={onClose} />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

/**
 * Corpo do explorador. `modal`: dentro do Dialog (Repositório › Adicionar,
 * Conectores). `pagina`: Painel › Google Drive, sem fechar — "Concluir" volta
 * à navegação.
 */
export function Explorador({
  modo = "modal",
  onClose,
}: {
  modo?: "modal" | "pagina";
  onClose?: () => void;
}) {
  const naPagina = modo === "pagina";
  // DialogTitle só existe dentro de um Dialog; na página o título é um h3.
  const Titulo = naPagina ? "h3" : DialogTitle;
  const fechar = () => onClose?.();
  const { temas } = usePastasMemoria();
  const [conta, setConta] = useState<string | null>(null);
  const [raiz, setRaiz] = useState<Raiz>("root");
  const [trilha, setTrilha] = useState<Pasta[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [res, setRes] = useState<{
    chave: string;
    itens: DriveArquivo[];
    proxima: string | null;
    erro: string | null;
    naoConectado: boolean;
  } | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [indice, setIndice] = useState<IndiceDrive>(new Map());
  const [selecao, setSelecao] = useState<Map<string, DriveArquivo>>(new Map());
  const [destino, setDestino] = useState(PASTA_DRIVE);
  const [fase, setFase] = useState<Fase>("explorar");
  const [plano, setPlano] = useState<ItemImportacao[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [preparando, setPreparando] = useState(false);

  const pastaAtual = trilha.at(-1)?.id ?? raiz;
  const chave = `${raiz}|${pastaAtual}|${buscaAtiva ?? ""}|${versao}`;
  const carregando = res?.chave !== chave;

  // Conta e índice de duplicados: uma vez por abertura.
  useEffect(() => {
    let vivo = true;
    contaDriveApi()
      .then((c) => vivo && setConta(c))
      .catch(() => undefined);
    indiceDoRepositorio()
      .then((i) => vivo && setIndice(i))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  // Listagem da pasta atual (ou da busca).
  useEffect(() => {
    let vivo = true;
    listarArquivosDriveApi(buscaAtiva ? { busca: buscaAtiva } : { pasta: pastaAtual })
      .then((r) => vivo && setRes({ chave, itens: r.arquivos, proxima: r.proximaPagina, erro: null, naoConectado: false }))
      .catch(
        (err) =>
          vivo &&
          setRes({
            chave,
            itens: [],
            proxima: null,
            erro: mensagemDoErro(err, "Não foi possível ler o Google Drive."),
            naoConectado: ehNaoConectado(err),
          }),
      );
    return () => {
      vivo = false;
    };
  }, [chave, buscaAtiva, pastaAtual]);

  const carregarMais = async () => {
    if (!res?.proxima) return;
    setCarregandoMais(true);
    try {
      const r = await listarArquivosDriveApi(
        buscaAtiva ? { busca: buscaAtiva, pagina: res.proxima } : { pasta: pastaAtual, pagina: res.proxima },
      );
      setRes((x) => (x ? { ...x, itens: [...x.itens, ...r.arquivos], proxima: r.proximaPagina } : x));
    } catch (err) {
      toast.error(mensagemDoErro(err, "Não foi possível carregar mais itens."));
    } finally {
      setCarregandoMais(false);
    }
  };

  const entrar = async (p: DriveArquivo) => {
    if (buscaAtiva) {
      // Vindo da busca: monta o caminho real para o breadcrumb.
      try {
        const info = await pastaDriveApi(p.id);
        setRaiz("root");
        setTrilha(info.caminho.length ? info.caminho : [{ id: p.id, nome: p.nome }]);
      } catch {
        setTrilha([{ id: p.id, nome: p.nome }]);
      }
      setBusca("");
      setBuscaAtiva(null);
      return;
    }
    setTrilha((t) => [...t, { id: p.id, nome: p.nome }]);
  };

  const alternar = (a: DriveArquivo) =>
    setSelecao((m) => {
      const n = new Map(m);
      if (n.has(a.id)) n.delete(a.id);
      else n.set(a.id, a);
      return n;
    });

  const selecionados = [...selecao.values()];
  const nPastas = selecionados.filter((s) => s.pasta).length;
  const nArquivos = selecionados.length - nPastas;
  const visiveis = (res?.itens ?? []).filter((a) => a.pasta || a.importavel);
  const todosMarcados = visiveis.length > 0 && visiveis.every((a) => selecao.has(a.id));

  const opcoesDestino = useMemo(
    () => [
      ...(temas.some((t) => t.id === PASTA_DRIVE) ? [] : [{ label: PASTA_DRIVE, value: PASTA_DRIVE }]),
      ...temas.map((t) => ({ label: t.id, value: t.id })),
    ],
    [temas],
  );

  const importar = async (itens: ItemImportacao[]) => {
    setFase("importando");
    const final = await executarImportacao(itens, setPlano);
    setPlano(final);
    setFase("concluido");
    setIndice(await indiceDoRepositorio().catch(() => indice));
  };

  const confirmar = async () => {
    setPreparando(true);
    try {
      const { itens, avisos: av } = await montarPlano(selecionados, destino, indice);
      setAvisos(av);
      setPlano(itens);
      if (!itens.length) {
        toast.error("Nenhum arquivo para importar nas pastas escolhidas.");
        return;
      }
      await importar(itens);
    } finally {
      setPreparando(false);
    }
  };

  const contagem = (s: StatusItem[]) => plano.filter((i) => s.includes(i.status)).length;
  const falhas = contagem(["falha"]);
  const ok = contagem(["importado", "atualizado"]);
  const progresso = plano.length
    ? Math.round((plano.filter((i) => !["pendente", "importando"].includes(i.status)).length / plano.length) * 100)
    : 0;

  // ----------------------------------------------------------- cabeçalho
  const cabecalho = (
    <div className="dark:border-dark-500 border-b border-gray-200 p-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1fa463]/15 text-sm font-bold text-[#1fa463]">
            GD
          </span>
          <div>
            <Titulo className="dark:text-dark-50 text-base font-semibold text-gray-800">
              {naPagina ? "Seus arquivos e pastas" : "Adicionar do Google Drive"}
            </Titulo>
            <p className="dark:text-dark-300 text-xs-plus text-gray-500">
              {conta ? `Conectado como ${conta} · somente leitura` : "Somente leitura — nada é alterado no seu Drive"}
            </p>
          </div>
        </div>
        {!naPagina && (
          <Button
            onClick={fechar}
            variant="flat"
            isIcon
            className="size-8 shrink-0 rounded-lg"
            aria-label="Fechar"
            disabled={fase === "importando"}
          >
            <XMarkIcon className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );

  // ----------------------------------------------------------- explorar
  if (fase === "explorar") {
    return (
      <>
        {cabecalho}
        <div className="flex flex-col gap-3 px-4 pt-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setBuscaAtiva(busca.trim() || null);
              }}
            >
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar arquivos e pastas no Drive"
                prefix={<MagnifyingGlassIcon className="size-4.5" />}
                classNames={{ root: "flex-1" }}
              />
              <Button type="submit" variant="outlined" className="rounded-lg">
                Buscar
              </Button>
            </form>
            <div className="flex gap-2">
              <Select
                value={raiz}
                onChange={(e) => {
                  setRaiz(e.target.value as Raiz);
                  setTrilha([]);
                  setBuscaAtiva(null);
                  setBusca("");
                }}
                data={[
                  { label: ROTULO_RAIZ.root, value: "root" },
                  { label: ROTULO_RAIZ.compartilhados, value: "compartilhados" },
                ]}
              />
              <Button
                variant="outlined"
                isIcon
                className="size-9 shrink-0 rounded-lg"
                aria-label="Atualizar"
                onClick={() => setVersao((v) => v + 1)}
              >
                <ArrowPathIcon className="size-4.5" />
              </Button>
            </div>
          </div>

          {/* Breadcrumbs */}
          <nav aria-label="Caminho no Drive" className="flex flex-wrap items-center gap-1 text-sm">
            {buscaAtiva ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setBuscaAtiva(null);
                    setBusca("");
                  }}
                  className="dark:text-dark-300 dark:hover:bg-dark-600 flex items-center gap-1 rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
                >
                  <ChevronLeftIcon className="size-4" /> Voltar
                </button>
                <span className="dark:text-dark-50 px-2 py-1 font-semibold text-gray-800">
                  Resultados para “{buscaAtiva}”
                </span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setTrilha([])}
                  className={clsx(
                    "flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
                    trilha.length === 0
                      ? "dark:text-dark-50 font-semibold text-gray-800"
                      : "dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-100 text-gray-500 hover:bg-gray-100 hover:text-gray-800",
                  )}
                >
                  <HomeIcon className="size-4" />
                  {ROTULO_RAIZ[raiz]}
                </button>
                {trilha.map((p, i) => (
                  <span key={p.id} className="flex items-center gap-1">
                    <ChevronRightIcon className="dark:text-dark-400 size-4 text-gray-300" />
                    <button
                      type="button"
                      onClick={() => setTrilha((t) => t.slice(0, i + 1))}
                      className={clsx(
                        "rounded-md px-2 py-1 transition-colors",
                        i === trilha.length - 1
                          ? "dark:text-dark-50 font-semibold text-gray-800"
                          : "dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-100 text-gray-500 hover:bg-gray-100 hover:text-gray-800",
                      )}
                    >
                      {p.nome}
                    </button>
                  </span>
                ))}
              </>
            )}
          </nav>
        </div>

        {/* Lista */}
        <div className="dark:border-dark-500 mx-4 mt-2 min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 sm:mx-6">
          {carregando ? (
            <div className="flex justify-center py-16">
              <Spinner color="primary" className="size-6" />
            </div>
          ) : res?.erro ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <ExclamationTriangleIcon className="text-warning size-8" />
              <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
                {res.naoConectado ? "O Google Drive não está conectado" : "Não foi possível acessar o Drive"}
              </p>
              <p className="dark:text-dark-300 max-w-md text-sm text-gray-500">{res.erro}</p>
              {res.naoConectado ? (
                <Button component={Link} to="/oracle/conectores" color="primary" className="rounded-lg" onClick={fechar}>
                  Abrir Conectores
                </Button>
              ) : (
                <Button variant="outlined" className="rounded-lg" onClick={() => setVersao((v) => v + 1)}>
                  Tentar de novo
                </Button>
              )}
            </div>
          ) : res && res.itens.length === 0 ? (
            <p className="dark:text-dark-300 py-14 text-center text-sm text-gray-500">
              {buscaAtiva
                ? "Nenhum arquivo ou pasta encontrado para esta busca."
                : trilha.length
                  ? "Esta pasta está vazia."
                  : raiz === "compartilhados"
                    ? "Nada foi compartilhado com você."
                    : "Seu Drive não tem arquivos ou pastas."}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="dark:bg-dark-800 dark:text-dark-300 sticky top-0 z-1 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={todosMarcados}
                      aria-label="Selecionar todos"
                      onChange={() =>
                        setSelecao((m) => {
                          const n = new Map(m);
                          for (const a of visiveis) {
                            if (todosMarcados) n.delete(a.id);
                            else n.set(a.id, a);
                          }
                          return n;
                        })
                      }
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">Nome</th>
                  <th className="hidden px-2 py-2 font-medium sm:table-cell">Tipo</th>
                  <th className="hidden px-2 py-2 font-medium md:table-cell">Modificado</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="dark:divide-dark-600 divide-y divide-gray-100">
                {res?.itens.map((a) => {
                  const sit = a.pasta ? "novo" : situacaoNoRepositorio(a, indice);
                  const habilitado = a.pasta || a.importavel;
                  return (
                    <tr key={a.id} className={clsx("dark:hover:bg-dark-700 hover:bg-gray-50", !habilitado && "opacity-55")}>
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={selecao.has(a.id)}
                          disabled={!habilitado}
                          onChange={() => alternar(a)}
                          aria-label={`Selecionar ${a.nome}`}
                        />
                      </td>
                      <td className="max-w-0 px-2 py-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <IconeTipo a={a} />
                          {a.pasta ? (
                            <button
                              type="button"
                              onClick={() => void entrar(a)}
                              className="dark:text-dark-50 truncate text-left font-medium text-gray-800 hover:underline"
                            >
                              {a.nome}
                            </button>
                          ) : (
                            <span className="dark:text-dark-100 truncate text-gray-800">{a.nome}</span>
                          )}
                          {sit === "existe" && (
                            <Badge variant="soft" color="success" className="shrink-0 rounded-full text-[11px]">
                              No Repositório
                            </Badge>
                          )}
                          {sit === "atualizado" && (
                            <Badge variant="soft" color="info" className="shrink-0 rounded-full text-[11px]">
                              Atualizado no Drive
                            </Badge>
                          )}
                          {!habilitado && (
                            <Badge variant="soft" color="warning" className="shrink-0 rounded-full text-[11px]">
                              Não suportado
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="dark:text-dark-300 hidden px-2 py-2 text-gray-500 sm:table-cell">{a.tipoRotulo}</td>
                      <td className="dark:text-dark-300 hidden px-2 py-2 whitespace-nowrap text-gray-500 md:table-cell">
                        {fmtData(a.modificadoEm)}
                      </td>
                      <td className="px-2 py-2">
                        {a.link && (
                          <a
                            href={a.link}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Abrir ${a.nome} no Google Drive`}
                            className="dark:text-dark-300 dark:hover:text-dark-50 text-gray-400 hover:text-gray-700"
                          >
                            <ArrowTopRightOnSquareIcon className="size-4.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {res?.proxima && !carregando && (
            <div className="flex justify-center p-3">
              <Button variant="flat" className="rounded-lg text-xs" disabled={carregandoMais} onClick={() => void carregarMais()}>
                {carregandoMais ? <Spinner color="primary" className="size-4" /> : "Carregar mais"}
              </Button>
            </div>
          )}
        </div>

        {/* Rodapé: seleção */}
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="dark:text-dark-200 text-sm text-gray-600">
            {selecao.size
              ? `${nArquivos} ${nArquivos === 1 ? "arquivo" : "arquivos"} · ${nPastas} ${nPastas === 1 ? "pasta" : "pastas"} selecionados`
              : "Selecione arquivos ou pastas. Uma pasta importa todo o seu conteúdo."}
          </p>
          <div className="flex gap-2">
            {selecao.size > 0 && (
              <Button variant="flat" className="rounded-lg" onClick={() => setSelecao(new Map())}>
                Limpar
              </Button>
            )}
            <Button color="primary" className="rounded-lg" disabled={!selecao.size} onClick={() => setFase("revisar")}>
              Revisar seleção
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ----------------------------------------------------------- revisar
  if (fase === "revisar") {
    return (
      <>
        {cabecalho}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:px-6">
          <p className="dark:text-dark-50 text-sm font-semibold text-gray-800">
            {nArquivos} {nArquivos === 1 ? "arquivo" : "arquivos"} · {nPastas} {nPastas === 1 ? "pasta" : "pastas"}
          </p>
          {nPastas > 0 && (
            <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-500">
              Pastas importam todo o conteúdo, incluindo subpastas, mantendo a estrutura — não apenas uma referência.
            </p>
          )}
          <ul className="dark:divide-dark-600 dark:border-dark-500 mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {selecionados.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 px-4 py-2">
                <IconeTipo a={a} />
                <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm text-gray-800">{a.nome}</span>
                <span className="dark:text-dark-300 text-xs text-gray-500">
                  {a.pasta ? "Pasta e conteúdo" : a.tipoRotulo}
                </span>
                <Button
                  variant="flat"
                  isIcon
                  className="size-7 rounded-lg"
                  aria-label={`Remover ${a.nome} da seleção`}
                  onClick={() => alternar(a)}
                >
                  <XMarkIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select
              label="Pasta de destino no Repositório"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              data={opcoesDestino}
            />
          </div>
          <div className="dark:border-dark-500 dark:bg-dark-800 dark:text-dark-200 text-xs-plus mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-600">
            Os arquivos serão lidos e processados pelo Oracle e ficarão no Repositório (pasta “{destino}”) para
            consulta e uso pela IA, e no Grafo. Arquivos já importados não são duplicados: os que mudaram no Drive
            atualizam a nota existente. Nada é alterado no seu Google Drive.
          </div>
          {!memoriaVaultSupported() && (
            <p className="text-warning text-xs-plus mt-3">
              Este navegador não grava na pasta do Repositório. Use Chrome ou Edge.
            </p>
          )}
        </div>
        <div className="flex justify-between gap-2 p-4 sm:px-6">
          <Button variant="outlined" className="rounded-lg" onClick={() => setFase("explorar")}>
            Voltar
          </Button>
          <Button
            color="primary"
            className="gap-1.5 rounded-lg"
            disabled={!selecao.size || preparando || !memoriaVaultSupported()}
            onClick={() => void confirmar()}
          >
            {preparando && <Spinner color="primary" className="size-4" />}
            {preparando ? "Lendo as pastas…" : "Adicionar ao Repositório"}
          </Button>
        </div>
      </>
    );
  }

  // ------------------------------------------------- importando / concluído
  const titulo =
    fase === "importando"
      ? `Importando… ${progresso}%`
      : falhas === 0
        ? "Importação concluída"
        : ok > 0
          ? "Importação parcialmente concluída"
          : "A importação não foi concluída";
  return (
    <>
      {cabecalho}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:px-6">
        <div className="flex items-center gap-2">
          {fase === "importando" ? (
            <Spinner color="primary" className="size-5" />
          ) : falhas === 0 ? (
            <CheckCircleIcon className="text-success size-6" />
          ) : (
            <ExclamationTriangleIcon className="text-warning size-6" />
          )}
          <p className="dark:text-dark-50 font-semibold text-gray-800">{titulo}</p>
        </div>
        <div className="dark:bg-dark-600 mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="bg-primary-500 h-full rounded-full transition-all" style={{ width: `${progresso}%` }} />
        </div>
        <p className="dark:text-dark-300 text-xs-plus mt-2 text-gray-500">
          {contagem(["importado"])} importados · {contagem(["atualizado"])} atualizados · {contagem(["existe"])} já
          estavam no Repositório · {contagem(["nao-suportado"])} não suportados · {falhas} com falha
        </p>
        {avisos.map((a) => (
          <p key={a} className="text-warning text-xs-plus mt-1">
            {a}
          </p>
        ))}
        <ul className="dark:divide-dark-600 dark:border-dark-500 mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {plano.map((i) => (
            <li key={i.arquivo.id} className="flex items-center gap-2.5 px-4 py-2">
              <IconeTipo a={i.arquivo} />
              <div className="min-w-0 flex-1">
                <p className="dark:text-dark-100 truncate text-sm text-gray-800">{i.arquivo.nome}</p>
                <p className="dark:text-dark-300 truncate font-mono text-[11px] text-gray-400">
                  {i.erro ? i.erro : i.destino}
                </p>
              </div>
              <Badge variant="soft" color={STATUS[i.status].cor} className="shrink-0 rounded-full text-[11px]">
                {STATUS[i.status].rotulo}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end gap-2 p-4 sm:px-6">
        {fase === "concluido" && falhas > 0 && (
          <Button variant="outlined" className="gap-1.5 rounded-lg" onClick={() => void importar(plano)}>
            <ArrowPathIcon className="size-4.5" />
            Tentar novamente ({falhas})
          </Button>
        )}
        {fase === "concluido" && (
          <Button
            variant="outlined"
            className="rounded-lg"
            onClick={() => {
              setSelecao(new Map());
              setPlano([]);
              setAvisos([]);
              setFase("explorar");
            }}
          >
            Importar mais
          </Button>
        )}
        <Button
          color="primary"
          className="rounded-lg"
          disabled={fase === "importando"}
          onClick={() => {
            if (!naPagina) return fechar();
            setSelecao(new Map());
            setPlano([]);
            setAvisos([]);
            setFase("explorar");
          }}
        >
          Concluir
        </Button>
      </div>
    </>
  );
}

/** Botão que abre o explorador — usado no painel do conector Google Drive. */
export function BotaoImportarDoDrive() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button color="primary" className="text-xs-plus mt-3 h-9 w-full rounded-lg" onClick={() => setAberto(true)}>
        Importar arquivos para o Repositório
      </Button>
      <ImportarDoDrive aberto={aberto} onClose={() => setAberto(false)} />
    </>
  );
}
