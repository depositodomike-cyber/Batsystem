// Import Dependencies
import { CircleStackIcon, EyeIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { SectionCard } from "../configuracoes-ui";
import { useDocumentosOrg } from "./useDocumentosOrg";

// ----------------------------------------------------------------------
// Configurações → Geral → Repositório
//
// O Repositório da ORGANIZAÇÃO: a base de conhecimento compartilhada. A tela
// mantém a anatomia da antiga seção de pasta (cartão da seção, card do
// repositório com ícone, chip "Ativo", subtítulo e ação à direita), mas nada
// aqui fala de pasta — a pasta local do protótipo mora no rodapé da sidebar
// (`PastaLocalButton`) e não compartilha dado com esta tela.
//
// "Visualizar arquivos" abre a listagem própria (`RepositorioArquivos`) no
// mesmo layout de Configurações, via `?vista=arquivos`.

export function RepositorioSection({
  onVisualizarArquivos,
}: {
  onVisualizarArquivos: () => void;
}) {
  const { documentos, carregando } = useDocumentosOrg();
  const total = documentos.length;

  return (
    <SectionCard
      titulo="Repositório"
      descricao="Gerencie os documentos compartilhados que fazem parte da base de conhecimento da organização."
    >
      <div className="dark:border-dark-500 dark:bg-dark-600 flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 grid size-10 shrink-0 place-items-center rounded-lg">
            <CircleStackIcon className="size-5.5" />
          </span>
          <div className="min-w-0">
            <p className="dark:text-dark-100 flex flex-wrap items-center gap-2 truncate text-sm font-medium text-gray-800">
              <span className="truncate">Repositório</span>
              <span className="bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Ativo
              </span>
            </p>
            <p className="dark:text-dark-300 text-xs-plus mt-0.5 truncate text-gray-500">
              Base de conhecimento da organização
              {!carregando &&
                ` · ${total} ${total === 1 ? "documento" : "documentos"}`}
            </p>
          </div>
        </div>
        <Button
          color="primary"
          onClick={onVisualizarArquivos}
          className="h-10 shrink-0 gap-1.5 rounded-lg"
        >
          <EyeIcon className="size-4.5" />
          Visualizar arquivos
        </Button>
      </div>

      <p className="dark:text-dark-300 text-xs-plus mt-4 text-gray-400">
        Os documentos do repositório pertencem à organização e ficam disponíveis
        como contexto para a IA de quem tem acesso a eles.
      </p>
    </SectionCard>
  );
}
