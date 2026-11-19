// Import Dependencies
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

// Local Imports
import { Button } from "@/components/ui";
import { ehDesktop, ponteDesktop, type EstadoBackendDesktop } from "@/utils/desktop";
import { SectionCard } from "../configuracoes-ui";
import {
  AgenteLocalCard,
  PastasAutorizadasCard,
  PreferenciasDesktopCard,
} from "./PreferenciasDesktopSection";
import {
  baixarArquivo,
  contarConflitos,
  exportarDadosLocais,
  importarDadosLocais,
  lerArquivo,
} from "./migracao";

// ----------------------------------------------------------------------
// Configurações > Geral > Oracle Desktop.
//
// No navegador: exporta os dados locais (notas, chats, preferências,
// biblioteca de Documentos) para levar ao app desktop. No app desktop:
// importa esse arquivo. É uma migração única; depois cada um segue com seus
// próprios dados locais. Repositório e dados da API não passam por aqui.
// ----------------------------------------------------------------------

export function OracleDesktopSection() {
  if (!ehDesktop()) return <Exportar />;
  return (
    <div className="flex flex-col gap-6">
      <PreferenciasDesktopCard />
      <PastasAutorizadasCard />
      <AgenteLocalCard />
      <ServidorLocal />
      <Importar />
    </div>
  );
}

/**
 * O servidor (API + banco) que o app sobe sozinho, e a importação única do
 * ambiente de desenvolvimento: banco do Docker + configuração do ts/api/.env.
 */
function ServidorLocal() {
  const [estado, setEstado] = useState<EstadoBackendDesktop | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void ponteDesktop()?.backend.estado().then(setEstado);
  }, []);

  const importar = async () => {
    const ponte = ponteDesktop();
    if (!ponte) return;
    setOcupado(true);
    try {
      const r = await ponte.backend.importarAmbienteDev();
      if (!r) return;
      if (r.ok) {
        toast.success(r.mensagem);
        // A sessão foi assinada com outro segredo: o login recomeça.
        setTimeout(() => window.location.assign("/login"), 1500);
      } else {
        toast.info(r.mensagem);
      }
      setEstado(await ponte.backend.estado());
    } finally {
      setOcupado(false);
    }
  };

  const embutido = estado?.modo === "embutido";
  return (
    <SectionCard
      titulo="Servidor do Oracle"
      descricao={
        embutido
          ? "A API e o banco de dados rodam dentro deste app, só neste computador."
          : "Este app está usando a API do Oracle que já estava aberta neste computador (ambiente de desenvolvimento)."
      }
    >
      <dl className="dark:text-dark-200 mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-gray-600">
        <dt className="font-medium">Situação</dt>
        <dd>{estado ? (estado.fase === "pronto" ? "Em funcionamento" : estado.erro ?? estado.etapa) : "…"}</dd>
        {embutido && (
          <>
            <dt className="font-medium">Dados importados</dt>
            <dd>
              {estado?.importadoEm
                ? new Date(estado.importadoEm).toLocaleString()
                : "Ainda não (banco novo deste app)"}
            </dd>
          </>
        )}
        <dt className="font-medium">Registros</dt>
        <dd className="break-all font-mono text-xs">{estado?.pastaLogs ?? "…"}</dd>
      </dl>
      {embutido && (
        <>
          <p className="dark:text-dark-300 mb-3 text-sm text-gray-500">
            Para usar aqui as mesmas contas, conectores e Repositório indexado do ambiente de
            desenvolvimento, importe o banco do Docker e o arquivo <code>ts/api/.env</code>. O
            banco original não é alterado.
          </p>
          <Button variant="flat" color="primary" disabled={ocupado} onClick={() => void importar()}>
            <CircleStackIcon className="mr-1.5 size-4" />
            {ocupado ? "Importando…" : "Importar ambiente de desenvolvimento"}
          </Button>
        </>
      )}
    </SectionCard>
  );
}

function Exportar() {
  const [ocupado, setOcupado] = useState(false);

  const exportar = async () => {
    setOcupado(true);
    try {
      const dados = await exportarDadosLocais();
      baixarArquivo(dados);
      toast.success("Arquivo exportado.", {
        description: "Abra o Oracle Desktop e importe em Configurações → Oracle Desktop.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao exportar.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <SectionCard
      titulo="Levar dados para o Oracle Desktop"
      descricao="Gera um arquivo com as notas, conversas, quadros, preferências e a biblioteca de Documentos guardados neste navegador. Nada é apagado daqui."
    >
      <ul className="dark:text-dark-200 mb-5 list-disc space-y-1 pl-5 text-sm text-gray-600">
        <li>A senha e a sessão não vão no arquivo: você entra de novo no app.</li>
        <li>
          Os arquivos do Repositório já estão numa pasta do seu computador. No app,
          basta escolher a mesma pasta.
        </li>
        <li>O arquivo contém seus dados pessoais: guarde-o com cuidado e apague depois de importar.</li>
      </ul>
      <Button color="primary" disabled={ocupado} onClick={() => void exportar()}>
        <ArrowDownTrayIcon className="mr-1.5 size-4" />
        {ocupado ? "Exportando…" : "Exportar para o Oracle Desktop"}
      </Button>
    </SectionCard>
  );
}

function Importar() {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);

  const importar = async (arquivo: File) => {
    setOcupado(true);
    try {
      const dados = lerArquivo(await arquivo.text());
      const conflitos = contarConflitos(dados);
      const sobrescrever =
        conflitos > 0 &&
        window.confirm(
          `${conflitos} item(ns) do arquivo já existem neste app.\n\n` +
            "OK: substituir pelos do arquivo.\nCancelar: manter os deste app e importar só o que falta.",
        );
      const r = await importarDadosLocais(dados, { sobrescrever });
      toast.success("Dados importados.", {
        description:
          `${r.chavesLocais + r.registrosIdb} item(ns) trazidos` +
          (r.ignoradosExistentes ? `, ${r.ignoradosExistentes} mantidos como estavam.` : ".") +
          " O Oracle vai recarregar.",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao importar.");
      setOcupado(false);
    }
  };

  return (
    <SectionCard
      titulo="Importar dados do navegador"
      descricao="Traga as notas, conversas, quadros, preferências e a biblioteca de Documentos que você usava no Oracle pelo navegador."
    >
      <ol className="dark:text-dark-200 mb-5 list-decimal space-y-1 pl-5 text-sm text-gray-600">
        <li>
          No Oracle pelo navegador, abra Configurações → Oracle Desktop e clique em
          “Exportar para o Oracle Desktop”.
        </li>
        <li>Aqui, escolha o arquivo gerado.</li>
        <li>Depois, em Repositório, selecione a mesma pasta que você já usava.</li>
      </ol>
      <input
        ref={entrada}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importar(f);
        }}
      />
      <Button color="primary" disabled={ocupado} onClick={() => entrada.current?.click()}>
        <ArrowUpTrayIcon className="mr-1.5 size-4" />
        {ocupado ? "Importando…" : "Escolher arquivo exportado"}
      </Button>
    </SectionCard>
  );
}
