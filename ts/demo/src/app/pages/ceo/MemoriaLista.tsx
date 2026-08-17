// Import Dependencies
import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import clsx from "clsx";
import {
  ArrowPathIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  FilmIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Badge, Button, Spinner } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";
import { syncVault } from "@/services/api/vault";
import { NotaMemoriaModal } from "./NotaMemoriaModal";
import { RepositorioViewSelect } from "./RepositorioViewSelect";
import {
  escolherPastaContexto,
  filtrarInventario,
  lerArquivosMd,
  montarInventario,
  notasParaVault,
  parseNotaMd,
  pastasDoInventario,
  pastaContextoSalva,
  pastaEhCopia,
  permissaoDeLeitura,
  tituloPadrao,
  type ArquivoMd,
  type FSDirHandle,
  type ItemContexto,
} from "./memoria-inventario";

// ----------------------------------------------------------------------
// Repositório · Lista — a mesma pasta de notas .md que o Grafo mostra, só que como
// inventário. As duas telas convivem: o grafo responde "como isto se conecta?",
// a lista responde "o que tem aqui?" — e é ela que serve quando o vault cresce e
// achar um arquivo pelo nome vale mais que ver a teia.
//
// Leitura da pasta, títulos, tags e tipo dos itens vêm de memoria-inventario.ts,
// compartilhado com o grafo. Clicar numa linha abre o mesmo NotaMemoriaModal.
// ----------------------------------------------------------------------

// Ícone por tipo derivado do item (ver tipoDoItem em memoria-inventario).
const ICONE_POR_TIPO: Record<string, ElementType> = {
  Análise: ChartBarIcon,
  Apresentação: PresentationChartBarIcon,
  Áudio: SpeakerWaveIcon,
  Conversa: ChatBubbleLeftRightIcon,
  Corte: FilmIcon,
  Dashboard: ChartBarIcon,
  "E-mail": EnvelopeIcon,
  Imagem: PhotoIcon,
  Pessoa: UserIcon,
  Reunião: UserGroupIcon,
  Slack: ChatBubbleLeftRightIcon,
  Transcrição: MicrophoneIcon,
  Vídeo: FilmIcon,
};

function formatarData(ms: number): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function MemoriaLista() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const repositorio = useRepositorioAtivo();
  const repositorioId = repositorio?.id ?? null;

  // `null` = a pasta ainda não foi lida nesta sessão (empty state de escolha);
  // `[]` = pasta lida e sem nenhum .md.
  const [itens, setItens] = useState<ItemContexto[] | null>(null);
  const [lendo, setLendo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [pasta, setPasta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [nota, setNota] = useState<{ path: string; titulo: string } | null>(null);

  // Indexa as notas na IA (mesmo /ai/vault do grafo). Só roda quando o usuário
  // escolhe a pasta ou clica em Sincronizar: abrir a lista para consultar não
  // precisa reenviar o vault inteiro.
  const indexarNaIa = useCallback(async (arquivos: ArquivoMd[]) => {
    setSincronizando(true);
    try {
      const r = await syncVault(notasParaVault(arquivos));
      toast.success("Repositório sincronizado", {
        description: `${r.total} notas disponíveis para a IA.`,
      });
    } catch {
      toast.error("Falha ao sincronizar o Repositório com a IA.", {
        description: "A lista está atualizada, mas as notas não chegaram ao servidor.",
      });
    } finally {
      setSincronizando(false);
    }
  }, []);

  const carregar = useCallback(
    async (handle: FSDirHandle, opts?: { indexar?: boolean }) => {
      setLendo(true);
      try {
        const arquivos = await lerArquivosMd(handle);
        setItens(montarInventario(arquivos));
        if (arquivos.length && opts?.indexar) void indexarNaIa(arquivos);
      } catch {
        toast("Falha ao ler a pasta", {
          description: "Não foi possível ler os arquivos da pasta.",
        });
      } finally {
        setLendo(false);
      }
    },
    [indexarNaIa],
  );

  const escolherPasta = useCallback(async () => {
    const escolha = await escolherPastaContexto();
    if (!escolha.ok) {
      // Cancelar a seleção não merece aviso; navegador sem suporte, sim.
      if (escolha.reason === "unsupported") {
        toast("Navegador sem suporte", {
          description: "Este navegador não permite selecionar pastas.",
        });
      }
      return;
    }
    await carregar(escolha.dir, { indexar: true });
  }, [carregar]);

  // Relê a pasta e reenvia as notas à IA. Sem pasta guardada — ou com permissão
  // revogada — cai no seletor: `requestPermission` só vale a partir de um gesto
  // do usuário, e o clique no botão é um.
  const sincronizar = useCallback(async () => {
    const handle = await pastaContextoSalva();
    // Uma cópia é um retrato do momento da seleção: sincronizar precisa dos
    // arquivos de agora, e sem handle a única forma de relê-los é o seletor.
    if (
      !handle ||
      pastaEhCopia(handle) ||
      !(await permissaoDeLeitura(handle, { pedir: true }))
    ) {
      await escolherPasta();
      return;
    }
    await carregar(handle, { indexar: true });
  }, [carregar, escolherPasta]);

  // Restaura a pasta do repositório ativo. Ao trocar de repositório, limpa o
  // inventário (após await) e tenta carregar a pasta (ou fica vazio).
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const handle = await pastaContextoSalva(repositorioId);
      if (cancelado) return;
      if (handle && (await permissaoDeLeitura(handle))) {
        await carregar(handle);
        return;
      }
      setItens(null);
      setPasta(null);
      setBusca("");
      setNota(null);
    })();

    return () => {
      cancelado = true;
    };
  }, [carregar, repositorioId]);

  const pastas = useMemo(() => pastasDoInventario(itens ?? []), [itens]);
  // Uma pasta filtrada pode desaparecer ao sincronizar; nesse caso o filtro cai
  // em "Todas" em vez de esvaziar a lista sem explicação.
  const pastaAtiva =
    pasta && pastas.some((p) => p.pasta === pasta) ? pasta : null;
  const visiveis = useMemo(
    () => filtrarInventario(itens ?? [], { pasta: pastaAtiva, busca }),
    [itens, pastaAtiva, busca],
  );

  const total = itens?.length ?? 0;
  const semPasta = itens === null;
  const ocupado = lendo || sincronizando;

  return (
    <Page title={`Repositório · lista · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <PageTitle
              help={{
                description: (
                  <p>
                    Esta é a lista do Repositório: todos os arquivos da sua
                    pasta — uploads, transcrições, atas, documentos gerados
                    pela IA e notas dos agrupamentos.
                  </p>
                ),
              }}
            >
              Repositório · Lista
            </PageTitle>
            <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
              {total} {total === 1 ? "nota" : "notas"} em:{" "}
              {repositorio?.nome ?? "—"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <RepositorioViewSelect compact />
            <Button
              onClick={sincronizar}
              color="primary"
              disabled={ocupado}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              {ocupado ? (
                <Spinner className="size-4" />
              ) : (
                <ArrowPathIcon className="size-4" />
              )}
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Sem pasta escolhida (ou permissão revogada) */}
        {semPasta && !lendo && (
          <div className="dark:border-dark-600 mt-6 grid place-items-center rounded-2xl border-2 border-dashed border-gray-200 px-6 py-16 text-center">
            <div className="flex max-w-sm flex-col items-center gap-4">
              <span className="dark:bg-white/5 dark:text-dark-200 grid size-14 place-items-center rounded-2xl bg-gray-900/5 text-gray-500">
                <FolderIcon className="size-7 stroke-[1.5]" />
              </span>
              <p className="dark:text-dark-300 text-sm text-gray-500">
                Escolha a pasta onde ficam as notas{" "}
                <span className="font-mono">.md</span> do seu Repositório. A lista mostra
                cada arquivo com pasta, tipo e tags.
              </p>
              <Button onClick={escolherPasta} color="primary" className="gap-2">
                <FolderIcon className="size-5" />
                Selecionar pasta
              </Button>
            </div>
          </div>
        )}

        {lendo && semPasta && (
          <div className="dark:text-dark-200 mt-6 flex items-center justify-center gap-3 py-16 text-sm text-gray-600">
            <Spinner className="size-5" />
            Lendo a pasta…
          </div>
        )}

        {!semPasta && (
          <>
            {/* Busca + filtro por pasta */}
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xs">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
                </span>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título, tipo ou tag…"
                  className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 focus:border-primary-500 h-10 w-full rounded-lg border border-gray-300 bg-white pr-9 pl-10 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    aria-label="Limpar busca"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="size-4.5" />
                  </button>
                )}
              </div>

              {pastas.length > 0 && (
                <div className="dark:bg-dark-700 inline-flex flex-wrap gap-1 rounded-lg bg-gray-200/70 p-1">
                  <ChipPasta
                    ativo={pastaAtiva === null}
                    onClick={() => setPasta(null)}
                    rotulo="Todas"
                    total={total}
                  />
                  {pastas.map((p) => (
                    <ChipPasta
                      key={p.pasta}
                      ativo={pastaAtiva === p.pasta}
                      onClick={() => setPasta(p.pasta)}
                      rotulo={p.pasta}
                      total={p.total}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Itens */}
            {visiveis.length > 0 ? (
              <div className="dark:border-dark-600 mt-4 overflow-hidden rounded-xl border border-gray-200">
                <ul className="dark:divide-dark-600 dark:bg-dark-700 divide-y divide-gray-100 bg-white">
                  {visiveis.map((item) => (
                    <LinhaNota
                      key={item.path}
                      item={item}
                      onAbrir={() => setNota({ path: item.path, titulo: item.titulo })}
                    />
                  ))}
                </ul>
              </div>
            ) : (
              <div className="dark:border-dark-600 mt-4 grid place-items-center rounded-xl border border-gray-200 px-6 py-14 text-center">
                <div className="max-w-sm">
                  <h3 className="dark:text-dark-50 text-base font-semibold text-gray-800">
                    {total === 0 ? "Nenhuma nota nesta pasta" : "Nenhuma nota encontrada"}
                  </h3>
                  <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
                    {total === 0
                      ? "Faça um upload de documento, áudio ou transcrição para o Repositório começar a se formar."
                      : "Ajuste a busca ou escolha outra pasta."}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Linha clicada: abre o .md para ler e editar, igual ao nó do grafo. */}
      <NotaMemoriaModal
        isOpen={!!nota}
        close={() => setNota(null)}
        path={nota?.path ?? null}
        titulo={nota?.titulo}
        onSalvo={(conteudo) => {
          if (!nota) return;
          // O título pode ter mudado no frontmatter — atualiza a linha sem reler
          // a pasta inteira.
          const novo =
            parseNotaMd(conteudo).titulo || tituloPadrao(nota.path.split("/").pop()!);
          if (novo === nota.titulo) return;
          setNota({ ...nota, titulo: novo });
          setItens((atuais) =>
            (atuais ?? []).map((i) =>
              i.path === nota.path ? { ...i, titulo: novo } : i,
            ),
          );
        }}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------

function ChipPasta({
  ativo,
  onClick,
  rotulo,
  total,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  total: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={clsx(
        "rounded-lg px-3.5 py-1.5 text-xs-plus font-medium transition-colors",
        ativo
          ? "dark:bg-dark-500 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
          : "dark:text-dark-300 dark:hover:text-dark-100 text-gray-500 hover:text-gray-700",
      )}
    >
      {rotulo}
      <span className="dark:text-dark-400 ml-1.5 text-tiny text-gray-400">{total}</span>
    </button>
  );
}

function LinhaNota({ item, onAbrir }: { item: ItemContexto; onAbrir: () => void }) {
  const Icone = ICONE_POR_TIPO[item.tipo] ?? DocumentTextIcon;

  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="dark:hover:bg-dark-600 flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-gray-50"
      >
        <span className="dark:bg-dark-600 dark:text-dark-200 grid size-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
          <Icone className="size-5 stroke-[1.5]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className="dark:text-dark-100 truncate text-sm font-medium text-gray-800"
              title={item.titulo}
            >
              {item.titulo}
            </span>
            <Badge variant="soft" color="neutral" className="shrink-0 text-tiny">
              {item.tipo}
            </Badge>
          </span>
          <span
            className="dark:text-dark-300 mt-0.5 block truncate font-mono text-tiny text-gray-400"
            title={item.path}
          >
            {item.path}
            {item.origem && <span className="font-sans"> · {item.origem}</span>}
          </span>
        </span>

        {item.tags.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 lg:flex">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="dark:bg-dark-600 dark:text-dark-200 rounded-md bg-gray-100 px-1.5 py-0.5 text-tiny text-gray-500"
              >
                #{tag}
              </span>
            ))}
          </span>
        )}

        <span className="dark:text-dark-300 hidden w-24 shrink-0 text-end text-tiny text-gray-400 sm:block">
          {formatarData(item.modificadoEm)}
        </span>
      </button>
    </li>
  );
}
