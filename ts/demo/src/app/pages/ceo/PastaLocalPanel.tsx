// Import Dependencies
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleStackIcon, FolderIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import {
  escolherPastaContexto,
  pastaContextoNativa,
  pastaContextoSuportada,
  pastaContextoSalva,
  pastaEhCopia,
} from "./memoria-inventario";
import {
  useRepositorioAtivo,
  useRepositoriosDoEscopoAtivo,
} from "@/app/pages/prototypes/contas/model/context";

// ----------------------------------------------------------------------
// Pasta local — pasta de dados do PROTÓTIPO (File System Access API + IndexedDB)
//
// É a mesma implementação que vivia em Configurações → Repositório, só
// reposicionada: agora abre pelo rodapé da sidebar (`PastaLocalButton`), e
// "Repositório" nas Configurações passou a ser a base de conhecimento da
// organização (`RepositorioSection`). As duas não compartilham dado.
//
// Lista os repositórios do escopo ativo e a pasta vinculada a cada um
// (ceo-memoria/kv/dir-handle:<repoId>). Roda 100% no navegador. Existe por
// limitação do protótipo — é daqui que a lista pessoal e o grafo leem as notas.

type PastaPorRepo = {
  nome: string | null;
  copia: boolean;
};

export function PastaLocalPanel() {
  const repositorios = useRepositoriosDoEscopoAtivo();
  const ativo = useRepositorioAtivo();
  const [pastas, setPastas] = useState<Record<string, PastaPorRepo>>({});
  // Suporte é fixo no mount; init lazy evita setState dentro de efeito.
  const [supported] = useState(() => pastaContextoSuportada());
  const [nativa] = useState(() => pastaContextoNativa());

  const ids = repositorios.map((r) => r.id).join(",");

  useEffect(() => {
    let cancelado = false;
    const lista = ids ? ids.split(",") : [];

    (async () => {
      const proximo: Record<string, PastaPorRepo> = {};
      for (const id of lista) {
        const handle = await pastaContextoSalva(id);
        proximo[id] = handle
          ? { nome: handle.name, copia: pastaEhCopia(handle) }
          : { nome: null, copia: false };
      }
      if (!cancelado) setPastas(proximo);
    })();

    return () => {
      cancelado = true;
    };
  }, [ids]);

  const pickFolder = useCallback(
    async (repositorioId: string, nomeRepo: string) => {
      const escolha = await escolherPastaContexto(repositorioId);
      if (!escolha.ok) {
        if (escolha.reason === "unsupported") {
          toast("Navegador sem suporte", {
            description: "Este navegador não permite selecionar pastas.",
          });
        }
        return;
      }
      setPastas((prev) => ({
        ...prev,
        [repositorioId]: {
          nome: escolha.dir.name,
          copia: pastaEhCopia(escolha.dir),
        },
      }));
      toast.success(`Pasta vinculada a “${nomeRepo}”: “${escolha.dir.name}”.`, {
        description:
          "Abra o Grafo ou a Lista com este contexto ativo para carregar as notas.",
      });
    },
    [],
  );

  return (
    <div>
      {repositorios.length === 0 ? (
        <p className="dark:text-dark-300 text-sm text-gray-500">
          Nenhum repositório neste escopo. Crie um pelo seletor da sidebar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {repositorios.map((repo) => {
            const pasta = pastas[repo.id];
            const folderName = pasta?.nome ?? null;
            const copia = pasta?.copia ?? false;
            const ehAtivo = ativo?.id === repo.id;

            return (
              <li
                key={repo.id}
                className="dark:border-dark-500 dark:bg-dark-600 flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 grid size-10 shrink-0 place-items-center rounded-lg">
                    <CircleStackIcon className="size-5.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="dark:text-dark-100 flex flex-wrap items-center gap-2 truncate text-sm font-medium text-gray-800">
                      <span className="truncate">{repo.nome}</span>
                      {ehAtivo ? (
                        <span className="bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                          Ativo
                        </span>
                      ) : null}
                    </p>
                    <p className="dark:text-dark-300 text-xs-plus mt-0.5 flex items-center gap-1.5 truncate text-gray-500">
                      <FolderIcon className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {folderName
                          ? copia
                            ? `${folderName} (cópia somente leitura)`
                            : folderName
                          : "Nenhuma pasta selecionada"}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  color="primary"
                  onClick={() => void pickFolder(repo.id, repo.nome)}
                  disabled={!supported}
                  className="h-10 shrink-0 gap-1.5 rounded-lg"
                >
                  <FolderIcon className="size-4.5" />
                  {folderName ? "Trocar pasta" : "Selecionar pasta"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {!supported ? (
        <p className="text-xs-plus text-warning mt-3">
          Seleção de pasta indisponível neste navegador. Use o Chrome ou o Edge.
        </p>
      ) : (
        !nativa && (
          <p className="text-xs-plus text-warning mt-3">
            Este navegador lê a pasta como cópia: o Repositório abre
            normalmente, mas a IA não grava notas de volta nos arquivos e
            mudanças feitas fora do navegador só aparecem quando você
            reselecionar a pasta. No Brave, o acesso completo liga em{" "}
            <span className="font-mono">
              brave://flags/#file-system-access-api
            </span>
            .
          </p>
        )
      )}

      <p className="dark:text-dark-300 text-xs-plus mt-4 text-gray-400">
        A pasta é lida localmente pelo navegador — nenhum arquivo é enviado a
        servidores. A escolha vale para o Grafo e a Lista do mesmo contexto.
      </p>
    </div>
  );
}
