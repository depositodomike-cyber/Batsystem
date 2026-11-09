// ----------------------------------------------------------------------
// Painel › Google Drive — os arquivos e pastas da conta conectada, no mesmo
// lugar que Email e Agenda. É o explorador de importação (drive/) em modo
// página: navegar, buscar, abrir no Drive e adicionar ao Repositório.
// Somente leitura: nada muda no Drive.
// ----------------------------------------------------------------------

import { useLocation } from "react-router";

import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { Explorador } from "./drive/ImportarDoDrive";

export default function Drive() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  return (
    <Page title={`Google Drive · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex flex-col gap-1">
          <PageTitle
            help={{
              title: "Google Drive",
              description: (
                <>
                  <p>
                    Navegue pelos arquivos e pastas do seu <strong>Google Drive</strong>,
                    com permissão somente de leitura.
                  </p>
                  <p>
                    Selecione arquivos ou pastas e use <strong>Adicionar ao Repositório</strong>:
                    eles viram notas que a IA consulta e aparecem no grafo. Uma pasta importa
                    todo o conteúdo, mantendo a estrutura. Nada é alterado no seu Drive.
                  </p>
                </>
              ),
            }}
          >
            Google Drive
          </PageTitle>
          <p className="dark:text-dark-300 text-sm text-gray-500">
            Seus arquivos e pastas, prontos para virar conhecimento no Repositório
          </p>
        </div>

        <div className="dark:border-dark-600 dark:bg-dark-700 mt-6 flex h-[calc(100vh-17rem)] min-h-[30rem] flex-col rounded-2xl border border-gray-200 bg-white">
          <Explorador modo="pagina" />
        </div>
      </div>
    </Page>
  );
}
