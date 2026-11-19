// Import Dependencies
import { useCallback, useEffect, useState } from "react";
import { ComputerDesktopIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

// Local Imports
import { Button } from "@/components/ui";
import {
  ponteDesktop,
  type EstadoAgenteDesktop,
  type PreferenciasDesktop,
} from "@/utils/desktop";
import { SectionCard, ToggleRow } from "../configuracoes-ui";

// ----------------------------------------------------------------------
// Configurações > Oracle Desktop (só no app): comportamento da janela, início
// com o Windows, atalho global, notificações e o Oracle Local Agent.
// ----------------------------------------------------------------------

export function PreferenciasDesktopCard() {
  const [p, setP] = useState<PreferenciasDesktop | null>(null);
  const [atalho, setAtalho] = useState("");

  useEffect(() => {
    void ponteDesktop()
      ?.preferencias.obter()
      .then((v) => {
        setP(v);
        setAtalho(v?.atalhoGlobal ?? "");
      });
  }, []);

  const salvar = async (parcial: Partial<PreferenciasDesktop>) => {
    const r = await ponteDesktop()?.preferencias.salvar(parcial);
    if (!r) return;
    setP(r);
    setAtalho(r.atalhoGlobal);
    if (r.atalhoOk === false) {
      toast.error("Esse atalho não pôde ser usado (inválido ou já usado por outro programa).");
    }
  };

  if (!p) return null;
  return (
    <SectionCard
      titulo="App desktop"
      descricao="Como o Oracle se comporta no Windows. Vale só para este computador."
    >
      <ToggleRow
        nome="Fechar para a bandeja"
        descricao="Fechar a janela mantém o Oracle aberto na bandeja (notas do Telegram continuam chegando)."
        checked={p.fecharParaBandeja}
        onChange={(v) => void salvar({ fecharParaBandeja: v })}
      />
      <ToggleRow
        nome="Iniciar com o Windows"
        descricao={
          p.instalado
            ? "Abre o Oracle ao entrar no Windows."
            : "Disponível no Oracle instalado (não no modo de desenvolvimento)."
        }
        checked={p.iniciarComWindows}
        onChange={(v) => p.instalado && void salvar({ iniciarComWindows: v })}
      />
      {p.iniciarComWindows && (
        <ToggleRow
          nome="Começar na bandeja"
          descricao="Ao iniciar com o Windows, não abre a janela."
          checked={p.iniciarNaBandeja}
          onChange={(v) => void salvar({ iniciarNaBandeja: v })}
        />
      )}
      <ToggleRow
        nome="Notificações do Windows"
        descricao="Avisa, por exemplo, quando chega nota do Telegram com o Oracle ao fundo."
        checked={p.notificacoes}
        onChange={(v) => void salvar({ notificacoes: v })}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">Atalho global</p>
          <p className="dark:text-dark-300 text-xs-plus mt-0.5 text-gray-500">
            Mostra ou esconde o Oracle de qualquer lugar. Ex.: CommandOrControl+Alt+O. Vazio
            desliga.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar({ atalhoGlobal: atalho.trim() });
          }}
        >
          <input
            value={atalho}
            onChange={(e) => setAtalho(e.target.value)}
            maxLength={64}
            aria-label="Atalho global"
            className="dark:border-dark-450 dark:bg-dark-800 dark:text-dark-100 h-8 w-56 rounded-lg border border-gray-300 bg-white px-2 font-mono text-xs text-gray-800"
          />
          <Button type="submit" variant="flat" className="h-8 px-3 text-xs">
            Salvar
          </Button>
        </form>
      </div>
    </SectionCard>
  );
}

/** Pastas que o app pode ler/gravar sem perguntar de novo (Repositório). */
export function PastasAutorizadasCard() {
  const [pastas, setPastas] = useState<{ caminho: string; modo: "readable" | "writable" }[] | null>(
    null,
  );

  useEffect(() => {
    void ponteDesktop()
      ?.pastas.listar()
      .then((l) => setPastas(l ?? []));
  }, []);

  const revogar = async (caminho: string) => {
    const ponte = ponteDesktop();
    if (!ponte) return;
    if (await ponte.pastas.revogar(caminho)) {
      toast.success("Acesso revogado. O Oracle vai pedir permissão de novo para esta pasta.");
    }
    setPastas((await ponte.pastas.listar()) ?? []);
  };

  if (!pastas) return null;
  return (
    <SectionCard
      titulo="Pastas autorizadas"
      descricao="Pastas que você escolheu para o Repositório. O Oracle lê (e, se permitido, grava) nelas sem perguntar de novo a cada abertura. Pastas do sistema e do perfil nunca são autorizadas."
    >
      {pastas.length === 0 ? (
        <p className="dark:text-dark-300 text-sm text-gray-500">Nenhuma pasta autorizada.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pastas.map((p) => (
            <li key={p.caminho} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="dark:text-dark-100 truncate font-mono text-xs text-gray-800">{p.caminho}</p>
                <p className="dark:text-dark-300 text-xs text-gray-500">
                  {p.modo === "writable" ? "Leitura e gravação" : "Só leitura"}
                </p>
              </div>
              <Button variant="flat" color="error" className="h-8 px-3 text-xs" onClick={() => void revogar(p.caminho)}>
                Revogar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function AgenteLocalCard() {
  const [e, setE] = useState<EstadoAgenteDesktop | null>(null);
  const [p, setP] = useState<PreferenciasDesktop | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const ponte = ponteDesktop();
    if (!ponte) return;
    setE(await ponte.agente.estado());
    setP(await ponte.preferencias.obter());
  }, []);

  useEffect(() => {
    const ponte = ponteDesktop();
    if (!ponte) return;
    void Promise.all([ponte.agente.estado(), ponte.preferencias.obter()]).then(([a, b]) => {
      setE(a);
      setP(b);
    });
  }, []);

  const iniciar = async () => {
    setOcupado(true);
    try {
      const r = await ponteDesktop()?.agente.iniciar();
      if (r) (r.ok ? toast.success : toast.error)(r.mensagem);
      await recarregar();
    } finally {
      setOcupado(false);
    }
  };

  const situacao = !e
    ? "…"
    : !e.instalado
      ? "Não instalado neste computador"
      : !e.pareado
        ? "Instalado, ainda não pareado"
        : !e.rodando
          ? "Parado"
          : e.paradoLocal
            ? "Rodando, pausado localmente"
            : "Rodando";

  return (
    <SectionCard
      titulo="Oracle Local Agent"
      descricao="O agente que executa ações autorizadas neste computador. Ele fala só com o servidor do Oracle; o app apenas o inicia e mostra o estado."
    >
      <dl className="dark:text-dark-200 mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-gray-600">
        <dt className="font-medium">Situação</dt>
        <dd>{situacao}</dd>
        {e?.api && (
          <>
            <dt className="font-medium">Servidor</dt>
            <dd className="font-mono text-xs">{e.api}</dd>
          </>
        )}
      </dl>
      {p && (
        <ToggleRow
          nome="Iniciar o agente com o Oracle"
          descricao="Se este computador estiver pareado e o agente parado, o app o inicia ao abrir."
          checked={p.iniciarAgente}
          onChange={(v) =>
            void ponteDesktop()
              ?.preferencias.salvar({ iniciarAgente: v })
              .then((r) => r && setP(r))
          }
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {e?.instalado && e.pareado && !e.rodando && (
          <Button color="primary" disabled={ocupado} onClick={() => void iniciar()}>
            <ComputerDesktopIcon className="mr-1.5 size-4" />
            {ocupado ? "Iniciando…" : "Iniciar agente"}
          </Button>
        )}
        <Button
          variant="flat"
          onClick={() => window.location.assign("/oracle/configuracoes?secao=ambiente-local")}
        >
          Pareamento e permissões
        </Button>
      </div>
    </SectionCard>
  );
}
