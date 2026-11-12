// Import Dependencies
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  PlusIcon,
  ShieldCheckIcon,
  StopCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

// Local Imports
import { Badge, Button, Spinner } from "@/components/ui";
import { JWT_HOST_API } from "@/configs/auth";
import {
  alterarPoliticaDesktopApi,
  confirmarDispositivoApi,
  estadoAmbienteLocalApi,
  gerarCodigoPareamentoApi,
  historicoDesktopApi,
  pararDesktopApi,
  retomarDispositivoApi,
  revogarDispositivoApi,
  type Categoria,
  type Dispositivo,
  type EstadoAmbienteLocal,
  type EventoHistorico,
  type PoliticaDesktop,
} from "@/services/api/desktop";
import { SectionCard, ToggleRow } from "./configuracoes-ui";

// ----------------------------------------------------------------------
// Configurações > Organização > Ambiente local.
//
// É SÓ configuração: o controle do computador acontece na conversa com o
// Oracle (chat e voz), sem módulo próprio. Toda ampliação feita aqui só vale
// no computador depois que o usuário confirma na bandeja do agente (SR-35) —
// por isso a tela avisa quando há confirmação local pendente.
// ----------------------------------------------------------------------

const CATEGORIA_TEXTO: Record<Categoria, { nome: string; descricao: string }> = {
  apps: { nome: "Abrir e fechar aplicativos", descricao: "Só os aplicativos autorizados abaixo. Fechar sempre pede confirmação." },
  processos: { nome: "Consultar aplicativos em execução", descricao: "Nome dos programas abertos; títulos de janela só dos apps observáveis." },
  janelas: { nome: "Gerenciar janelas", descricao: "Maximizar, restaurar, lado a lado e deixar só um app visível." },
  arquivos_busca: { nome: "Pesquisar arquivos e pastas", descricao: "Nome, tamanho e data — nunca o conteúdo. Só nas pastas autorizadas." },
  documentos: { nome: "Abrir documentos", descricao: "PDF, Office, imagens e mídia das pastas autorizadas. Executáveis nunca." },
  arquivos_escrita: { nome: "Criar pastas e mover arquivos", descricao: "Dentro das pastas autorizadas. Nada é apagado; sobrescrever pede confirmação." },
  navegador: { nome: "Abrir sites no navegador", descricao: "Domínios fora da lista abaixo sempre pedem confirmação." },
  midia: { nome: "Controlar mídia", descricao: "Tocar/pausar, próxima, anterior e volume." },
  energia: { nome: "Desligar, reiniciar e bloquear", descricao: "Sempre pede confirmação e dá 30 segundos de aviso." },
};

const OPERACAO_TEXTO: Record<string, string> = {
  listar_processos: "Ver apps abertos",
  listar_janelas: "Ver janelas",
  buscar_arquivos: "Buscar arquivos",
  abrir_aplicativo: "Abrir aplicativo",
  fechar_aplicativo: "Fechar aplicativo",
  abrir_url: "Abrir site",
  abrir_documento: "Abrir documento",
  organizar_janelas: "Organizar janelas",
  controlar_midia: "Controlar mídia",
  criar_pasta: "Criar pasta",
  mover_arquivo: "Mover arquivo",
  energia: "Desligar/reiniciar",
};

const ESTADO: Record<string, { rotulo: string; cor: "success" | "warning" | "error" | "neutral" | "info" }> = {
  conectado: { rotulo: "Conectado", cor: "success" },
  desconectado: { rotulo: "Desconectado", cor: "neutral" },
  pendente: { rotulo: "Aguardando confirmação", cor: "warning" },
  inicializando: { rotulo: "Inicializando", cor: "info" },
  sincronizando: { rotulo: "Sincronizando", cor: "info" },
  atualizando: { rotulo: "Atualizando", cor: "info" },
  bloqueado: { rotulo: "Bloqueado por segurança", cor: "error" },
  erro: { rotulo: "Erro de comunicação", cor: "error" },
  revogado: { rotulo: "Revogado", cor: "neutral" },
};

const RISCO_COR = { baixo: "success", moderado: "warning", alto: "error" } as const;

function erroDe(err: unknown): string {
  const m = (err as { response?: { data?: { message?: unknown } }; message?: unknown })?.response?.data?.message ??
    (err as { message?: unknown })?.message;
  return typeof m === "string" ? m : Array.isArray(m) ? m.join(" ") : "Não foi possível concluir.";
}

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return d.toLocaleString("pt-BR");
}

const inputCls =
  "form-input dark:border-dark-450 dark:bg-dark-700 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

export function AmbienteLocalSection() {
  const [estado, setEstado] = useState<EstadoAmbienteLocal | null>(null);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const e = await estadoAmbienteLocalApi();
      setEstado(e);
      setErro(null);
      if (e.liberacao.ativo) setHistorico(await historicoDesktopApi(30));
    } catch (err) {
      setErro(erroDe(err));
    }
  }, []);

  // Recarrega a cada 10s: estado do agente e confirmações locais mudam lá fora.
  useEffect(() => {
    const primeiro = setTimeout(() => void carregar(), 0);
    const t = setInterval(() => void carregar(), 10_000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(t);
    };
  }, [carregar]);

  const alterar = async (a: Partial<Omit<PoliticaDesktop, "versao">>, ampliacao = true) => {
    try {
      await alterarPoliticaDesktopApi(a);
      if (ampliacao) toast.info("Salvo. Para ampliar permissões, confirme também no computador (ícone do Oracle na bandeja).");
      await carregar();
    } catch (err) {
      toast.error(erroDe(err));
    }
  };

  if (erro && !estado) {
    return (
      <SectionCard titulo="Ambiente local" descricao="Controle do computador pelo Oracle.">
        <p className="text-error text-sm">{erro}</p>
      </SectionCard>
    );
  }
  if (!estado) {
    return (
      <div className="flex justify-center py-12">
        <Spinner color="primary" className="size-7" />
      </div>
    );
  }

  const { politica, liberacao } = estado;
  const dispositivo = estado.dispositivos.find((d) => d.estado !== "pendente") ?? null;

  return (
    <div className="space-y-6">
      {!liberacao.ativo && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <ExclamationTriangleIcon className="size-5 shrink-0" />
          <p>
            O controle do computador está desativado neste servidor. {liberacao.motivo} A liberação depende
            da revisão de segurança (docs/security).
          </p>
        </div>
      )}

      <Conexao estado={estado} onMudou={carregar} />

      <SectionCard
        titulo="Permissões de operação"
        descricao="O que o Oracle pode fazer neste computador quando você pedir na conversa. Tudo começa desligado."
      >
        <div className="dark:divide-dark-500 divide-y divide-gray-100">
          {estado.catalogo.categorias.map((c) => {
            const ops = estado.catalogo.operacoes.filter((o) => o.categoria === c);
            return (
              <div key={c} className="py-1">
                <ToggleRow
                  nome={CATEGORIA_TEXTO[c].nome}
                  descricao={CATEGORIA_TEXTO[c].descricao}
                  checked={!!politica.permissoes[c]}
                  onChange={(v) => void alterar({ permissoes: { [c]: v } }, v)}
                />
                {politica.permissoes[c] && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {ops.map((o) => {
                      const sempre = o.base === "alto";
                      const confirmar = sempre || politica.confirmar.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className="dark:border-dark-500 flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1 text-xs"
                        >
                          <Badge color={RISCO_COR[o.base]} variant="soft" className="rounded-full">
                            {o.base}
                          </Badge>
                          <span className="dark:text-dark-100 text-gray-700">{OPERACAO_TEXTO[o.id] ?? o.id}</span>
                          {o.base !== "baixo" && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <input
                                type="checkbox"
                                className="form-checkbox"
                                checked={confirmar}
                                disabled={sempre}
                                title={sempre ? "Operações de risco alto sempre pedem confirmação." : undefined}
                                onChange={(e) =>
                                  void alterar(
                                    {
                                      confirmar: e.target.checked
                                        ? [...politica.confirmar, o.id]
                                        : politica.confirmar.filter((x) => x !== o.id),
                                    },
                                    !e.target.checked,
                                  )
                                }
                              />
                              sempre confirmar
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="dark:text-dark-300 mt-3 text-xs text-gray-500">
          Mesmo liberadas, ações de risco alto pedem sua aprovação a cada vez. Quando o pedido usa conteúdo de
          notas, e-mails, páginas ou da conversa, ou chega pela palavra de ativação, ações moderadas também pedem.
        </p>
      </SectionCard>

      <Aplicativos dispositivo={dispositivo} politica={politica} alterar={alterar} />
      <ListaEditavel
        titulo="Diretórios autorizados"
        descricao="Pastas onde o Oracle pode procurar, abrir, criar e mover arquivos. Pastas de sistema, AppData e raízes de disco são recusadas."
        itens={politica.diretorios}
        placeholder="C:\Users\voce\Documents"
        onSalvar={(diretorios, ampliou) => void alterar({ diretorios }, ampliou)}
      />
      <ListaEditavel
        titulo="Domínios autorizados"
        descricao="Sites que o Oracle pode abrir sem pedir confirmação (vale também para subdomínios). Os demais pedem aprovação."
        itens={politica.dominios}
        placeholder="figma.com"
        onSalvar={(dominios, ampliou) => void alterar({ dominios }, ampliou)}
      />

      <Seguranca estado={estado} historico={historico} onMudou={carregar} />

      <SectionCard titulo="Privacidade" descricao="O que o Oracle pode observar neste computador e como o histórico é guardado.">
        <div className="dark:divide-dark-500 divide-y divide-gray-100">
          <ToggleRow
            nome="Capturas de tela"
            descricao="Indisponível nesta versão: o Oracle não captura nem monitora a tela. Quando existir, será sob autorização a cada uso."
            checked={false}
            onChange={() => toast.info("Capturas de tela ainda não existem no Oracle.")}
          />
          <ToggleRow
            nome="Iniciar o agente junto com o Windows"
            descricao="O agente roda como você (sem administrador). Ligar exige confirmação na bandeja do computador."
            checked={politica.autoinicio}
            onChange={(v) => void alterar({ autoinicio: v }, v)}
          />
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="dark:text-dark-100 text-sm font-medium text-gray-800">Histórico de operações</p>
              <p className="dark:text-dark-300 text-xs-plus mt-0.5 text-gray-500">
                Guardado na auditoria com nomes de arquivo e domínios resumidos (sem caminho completo nem conteúdo).
              </p>
            </div>
            <select
              className="form-select dark:border-dark-450 dark:bg-dark-700 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              value={politica.retencaoDias}
              onChange={(e) => void alterar({ retencaoDias: Number(e.target.value) }, false)}
            >
              {[30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ----------------------------------------------------------------------

function Conexao({ estado, onMudou }: { estado: EstadoAmbienteLocal; onMudou: () => Promise<void> }) {
  const [codigo, setCodigo] = useState<{ codigo: string; expiraEm: string; impressaoServidor: string } | null>(null);
  const [impressao, setImpressao] = useState<Record<string, string>>({});
  const ativo = estado.liberacao.ativo;

  const acao = async (f: () => Promise<unknown>, ok: string) => {
    try {
      await f();
      toast.success(ok);
      await onMudou();
    } catch (err) {
      toast.error(erroDe(err));
    }
  };

  return (
    <SectionCard
      titulo="Conexão com o computador"
      descricao="O Oracle Local Agent roda no Windows e se conecta ao Oracle por conta própria — nenhuma porta do computador fica aberta."
    >
      {estado.dispositivos.length === 0 && (
        <p className="dark:text-dark-300 text-sm text-gray-500">Nenhum computador conectado.</p>
      )}
      <ul className="space-y-3">
        {estado.dispositivos.map((d) => (
          <LinhaDispositivo
            key={d.id}
            d={d}
            impressao={impressao[d.id] ?? ""}
            onImpressao={(v) => setImpressao((m) => ({ ...m, [d.id]: v }))}
            onConfirmar={() => acao(() => confirmarDispositivoApi(d.id, impressao[d.id] ?? ""), "Computador confirmado.")}
            onRetomar={() => acao(() => retomarDispositivoApi(d.id), "Controle retomado.")}
            onRevogar={() => {
              if (window.confirm(`Desconectar "${d.nome}" e revogar a autorização? O agente apaga a chave local.`)) {
                void acao(() => revogarDispositivoApi(d.id), "Computador desconectado.");
              }
            }}
          />
        ))}
      </ul>

      {ativo && (
        <div className="dark:border-dark-500 mt-5 rounded-xl border border-dashed border-gray-300 p-4">
          {!codigo ? (
            <Button color="primary" onClick={() => void gerarCodigoPareamentoApi().then(setCodigo).catch((e) => toast.error(erroDe(e)))}>
              <ComputerDesktopIcon className="mr-1.5 size-4" /> Conectar um computador
            </Button>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="dark:text-dark-100 text-gray-700">
                No computador, rode (vale até {new Date(codigo.expiraEm).toLocaleTimeString("pt-BR")}, uso único):
              </p>
              <code className="dark:bg-dark-800 block rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs break-all">
                oracle-agent pair {codigo.codigo} --api {JWT_HOST_API}
              </code>
              <p className="dark:text-dark-300 text-xs text-gray-500">
                O agente vai mostrar a impressão do servidor. Ela precisa ser exatamente{" "}
                <span className="font-mono font-semibold">{codigo.impressaoServidor}</span>. Depois, confirme o
                computador acima digitando a impressão que o agente mostrar.
              </p>
              <Button variant="flat" className="h-7 px-2 text-xs" onClick={() => setCodigo(null)}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function LinhaDispositivo(p: {
  d: Dispositivo;
  impressao: string;
  onImpressao: (v: string) => void;
  onConfirmar: () => void;
  onRetomar: () => void;
  onRevogar: () => void;
}) {
  const { d } = p;
  const e = ESTADO[d.estado] ?? ESTADO.erro;
  return (
    <li className="dark:border-dark-500 rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ComputerDesktopIcon className="size-5 text-gray-500" />
          <span className="dark:text-dark-50 font-medium text-gray-800">{d.nome}</span>
          <Badge color={e.cor} variant="soft" className="rounded-full">
            {e.rotulo}
          </Badge>
        </div>
        <div className="flex gap-2">
          {d.estado === "bloqueado" && (
            <Button variant="flat" color="success" className="h-8 px-3 text-xs" onClick={p.onRetomar}>
              Retomar
            </Button>
          )}
          <Button variant="flat" color="error" className="h-8 px-3 text-xs" onClick={p.onRevogar}>
            <TrashIcon className="mr-1 size-4" /> Desconectar e revogar
          </Button>
        </div>
      </div>
      <dl className="dark:text-dark-300 mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-2">
        <div>Agente: v{d.versaoAgente}</div>
        <div>Última comunicação: {quando(d.ultimoContato)}</div>
        <div>
          Impressão digital: <span className="font-mono">{d.impressaoDigital}</span>
        </div>
        <div>Política confirmada no computador: v{d.politicaAplicada}</div>
      </dl>
      {d.confirmacaoLocalPendente && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Há permissões novas esperando confirmação na bandeja deste computador.
        </p>
      )}
      {d.estado === "pendente" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} max-w-56 font-mono`}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={p.impressao}
            onChange={(ev) => p.onImpressao(ev.target.value)}
          />
          <Button color="primary" className="h-9 text-sm" onClick={p.onConfirmar}>
            <ShieldCheckIcon className="mr-1 size-4" /> Confirmar computador
          </Button>
          <span className="dark:text-dark-300 text-xs text-gray-500">Digite a impressão que o agente mostrou no pareamento.</span>
        </div>
      )}
    </li>
  );
}

function Aplicativos({
  dispositivo,
  politica,
  alterar,
}: {
  dispositivo: Dispositivo | null;
  politica: PoliticaDesktop;
  alterar: (a: Partial<Omit<PoliticaDesktop, "versao">>, ampliacao?: boolean) => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const apps = useMemo(() => {
    const inv = dispositivo?.inventario ?? [];
    const b = busca.trim().toLowerCase();
    return inv
      .filter((a) => !b || a.nome.toLowerCase().includes(b))
      .sort((x, y) => Number(politica.apps.includes(y.id)) - Number(politica.apps.includes(x.id)));
  }, [dispositivo, busca, politica.apps]);

  return (
    <SectionCard
      titulo="Aplicativos autorizados"
      descricao="Encontrados no Menu Iniciar do computador. Atalhos com parâmetros e programas de sistema (terminal, PowerShell, etc.) nunca aparecem aqui."
    >
      {!dispositivo ? (
        <p className="dark:text-dark-300 text-sm text-gray-500">Conecte um computador para ver os aplicativos.</p>
      ) : (
        <>
          <input className={`${inputCls} mb-3 max-w-xs`} placeholder="Filtrar" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <ul className="dark:divide-dark-500 dark:border-dark-500 max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100">
            {apps.map((a) => {
              const autorizado = politica.apps.includes(a.id);
              const observavel = politica.observaveis.includes(a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <p className="dark:text-dark-100 text-sm text-gray-800">{a.nome}</p>
                    <p className="dark:text-dark-300 truncate font-mono text-[11px] text-gray-400">{a.alvo}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={autorizado}
                        onChange={(e) =>
                          void alterar(
                            {
                              apps: e.target.checked ? [...politica.apps, a.id] : politica.apps.filter((x) => x !== a.id),
                              ...(e.target.checked ? {} : { observaveis: politica.observaveis.filter((x) => x !== a.id) }),
                            },
                            e.target.checked,
                          )
                        }
                      />
                      autorizado
                    </label>
                    <label className="flex items-center gap-1.5" title="Permite ler o título das janelas deste app">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={observavel}
                        disabled={!autorizado}
                        onChange={(e) =>
                          void alterar(
                            {
                              observaveis: e.target.checked
                                ? [...politica.observaveis, a.id]
                                : politica.observaveis.filter((x) => x !== a.id),
                            },
                            e.target.checked,
                          )
                        }
                      />
                      observável
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

function ListaEditavel(p: {
  titulo: string;
  descricao: string;
  itens: string[];
  placeholder: string;
  onSalvar: (itens: string[], ampliou: boolean) => void;
}) {
  const [novo, setNovo] = useState("");
  const adicionar = () => {
    const v = novo.trim();
    if (!v || p.itens.includes(v)) return;
    p.onSalvar([...p.itens, v], true);
    setNovo("");
  };
  return (
    <SectionCard titulo={p.titulo} descricao={p.descricao}>
      {p.itens.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {p.itens.map((i) => (
            <li key={i} className="dark:bg-dark-600 flex items-center gap-1.5 rounded-lg bg-gray-100 py-1 pr-1 pl-2.5 font-mono text-xs">
              {i}
              <Button
                variant="flat"
                isIcon
                className="size-6 rounded-md"
                aria-label={`Remover ${i}`}
                onClick={() => p.onSalvar(p.itens.filter((x) => x !== i), false)}
              >
                <TrashIcon className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          className={`${inputCls} max-w-md`}
          placeholder={p.placeholder}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
        />
        <Button variant="flat" color="primary" onClick={adicionar}>
          <PlusIcon className="mr-1 size-4" /> Adicionar
        </Button>
      </div>
    </SectionCard>
  );
}

function Seguranca({
  estado,
  historico,
  onMudou,
}: {
  estado: EstadoAmbienteLocal;
  historico: EventoHistorico[];
  onMudou: () => Promise<void>;
}) {
  const ativo = estado.liberacao.ativo;
  return (
    <SectionCard
      titulo="Segurança"
      descricao="A camada de segurança decide sozinha, com regras fixas — a IA não consegue mudar o risco de uma ação nem pular confirmações."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheckIcon className={ativo ? "size-5 text-emerald-500" : "size-5 text-amber-500"} />
          <span className="dark:text-dark-100 text-gray-700">
            Oracle Security Agent: {ativo ? "ativo — validando cada operação" : "funcionalidade bloqueada"}
          </span>
          <Badge variant="soft" color="neutral" className="rounded-full">
            política v{estado.politica.versao}
          </Badge>
        </div>
        <Button
          color="error"
          onClick={() =>
            void pararDesktopApi()
              .then((r) => toast.success(`Tudo parado (${r.dispositivos} computador(es)).`))
              .then(onMudou)
              .catch((e) => toast.error(erroDe(e)))
          }
        >
          <StopCircleIcon className="mr-1.5 size-4.5" /> Interromper tudo
        </Button>
      </div>

      <h4 className="dark:text-dark-100 mt-5 text-sm font-semibold text-gray-800">Operações bloqueadas (sempre)</h4>
      <ul className="dark:text-dark-300 mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
        {estado.catalogo.bloqueadas.map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <NoSymbolIcon className="size-3.5 text-red-500" /> {b}
          </li>
        ))}
      </ul>

      <h4 className="dark:text-dark-100 mt-5 text-sm font-semibold text-gray-800">Histórico de operações</h4>
      {historico.length === 0 ? (
        <p className="dark:text-dark-300 mt-2 text-xs text-gray-500">Nenhuma operação ainda.</p>
      ) : (
        <div className="mt-2 max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="dark:text-dark-300 text-gray-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Quando</th>
                <th className="py-1 pr-3 font-medium">Evento</th>
                <th className="py-1 pr-3 font-medium">Operação</th>
                <th className="py-1 font-medium">Risco</th>
              </tr>
            </thead>
            <tbody className="dark:text-dark-100 text-gray-700">
              {historico.map((h) => (
                <tr key={h.id} className="dark:border-dark-500 border-t border-gray-100">
                  <td className="py-1 pr-3 whitespace-nowrap">{new Date(h.criadoEm).toLocaleString("pt-BR")}</td>
                  <td className="py-1 pr-3">{h.evento.replace("desktop.", "")}</td>
                  <td className="py-1 pr-3">
                    {h.ferramenta?.replace("desktop_", "") ?? String((h.detalhes as { operacao?: string } | null)?.operacao ?? "—")}
                  </td>
                  <td className="py-1">{h.risco ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
