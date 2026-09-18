// Import Dependencies
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import {
  ConfirmModal,
  type ModalState,
} from "@/components/shared/ConfirmModal";
import {
  getGrafoAtivo,
  getVinhetaAtiva,
  setGrafoAtivo,
  setVinhetaAtiva,
} from "@/utils/beculturePrefs";
import { SectionCard, ToggleRow } from "./configuracoes-ui";
import { MarcasLista } from "./MarcasLista";
import { MarcaEditorInline } from "./MarcaEditorInline";
import {
  MENSAGENS_EXCLUIR_MARCA,
  useGestaoMarcas,
  type MarcaLocal,
} from "./design-system";
import { usePodeGerenciarMarcas } from "./design-system/usePodeGerenciarMarcas";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Configurações › Geral › Aparência.
//
// Duas abas, e a primeira seção de Configurações a ter abas internas:
//
//   • Aparência — animação de fundo e vinheta, preferências deste navegador.
//     São os dois toggles que a seção já tinha, sem uma linha de mudança.
//   • Guia de marca — as marcas da ORGANIZAÇÃO: o que decide a cara do que o AI
//     Studio gera. Criar, editar e excluir mora aqui e só aqui; o AI Studio
//     inteiro virou consumidor e apenas seleciona.
//
// Guia de marca é uma aba, e não um item novo na navegação lateral, porque
// responde à mesma pergunta que Aparência: com que cara as coisas aparecem.
// ----------------------------------------------------------------------

const ABAS = [
  { id: "aparencia", titulo: "Aparência" },
  { id: "marca", titulo: "Guia de marca" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

/**
 * As abas que a seção mostra agora. `settingsAppearancePanel` tira a primeira
 * do ar sem removê-la do código — ver o comentário da flag.
 */
function abasVisiveis(): readonly { id: AbaId; titulo: string }[] {
  if (isFeatureTemporarilyDisabled("settingsAppearancePanel")) {
    return ABAS.filter((a) => a.id !== "aparencia");
  }
  return ABAS;
}

/**
 * `?aba=` desconhecido — ou de uma aba oculta — cai na primeira visível, em
 * silêncio. Mesma doutrina de `resolverSecao`, e a lista de permitidos importa:
 * `?aba=` já significou `cargos`/`hierarquia` na antiga tela de Administração, e
 * esses links ainda existem por aí.
 */
function resolverAba(pedida: string | null): AbaId {
  const visiveis = abasVisiveis();
  return visiveis.some((a) => a.id === pedida)
    ? (pedida as AbaId)
    : visiveis[0].id;
}

export function AparenciaSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const aba = resolverAba(searchParams.get("aba"));
  const marcaEditando = searchParams.get("marca");

  const irPara = (proxima: AbaId) => {
    const p = new URLSearchParams(searchParams);
    p.set("aba", proxima);
    p.delete("marca");
    // Trocar de aba não merece uma entrada no histórico; abrir uma marca, sim.
    setSearchParams(p, { replace: true });
  };

  const abrirMarca = (id: string | null) => {
    const p = new URLSearchParams(searchParams);
    p.set("aba", "marca");
    if (id) p.set("marca", id);
    else p.delete("marca");
    setSearchParams(p);
  };

  const visiveis = abasVisiveis();

  return (
    <SectionCard
      titulo="Aparência"
      // A descrição segue as abas: com a de preferências fora do ar, falar em
      // "ajustes do painel" descreveria algo que não está na tela.
      descricao={
        visiveis.length > 1
          ? "Ajustes visuais do painel e os guias de marca da organização. As preferências de exibição ficam neste navegador; os guias de marca valem para toda a organização."
          : "Preferências visuais da organização."
      }
    >
      {/* Uma aba só não é uma escolha: a barra some junto. */}
      {visiveis.length > 1 && <Abas ativa={aba} onIrPara={irPara} />}

      <div
        role="tabpanel"
        id={`painel-aparencia-${aba}`}
        aria-labelledby={`aba-aparencia-${aba}`}
      >
        {aba === "aparencia" ? (
          <AbaPainel />
        ) : (
          <AbaGuiaDeMarca
            marcaEditando={marcaEditando}
            onAbrirMarca={abrirMarca}
          />
        )}
      </div>
    </SectionCard>
  );
}

// ------------------------------------------------------------------- as abas

/**
 * Abas locais, e não um componente compartilhado.
 *
 * Os dois precedentes da casa já divergem entre si — `SidePanel` tem contador e
 * `flex-1`, `AtaModal` tem ícone e alinhamento à esquerda —, então um terceiro
 * consumidor daria uma API de props opcionais para acomodar três usos, e não
 * uma abstração. As classes aqui são as do `AtaModal`, que é o caso mais
 * próximo.
 */
function Abas({
  ativa,
  onIrPara,
}: {
  ativa: AbaId;
  onIrPara: (id: AbaId) => void;
}) {
  const listaRef = useRef<HTMLDivElement>(null);

  // Roving tabindex: o Tab entra no grupo uma vez e as setas percorrem as abas,
  // que é o que um `tablist` promete a quem navega por teclado.
  const navegar = (e: React.KeyboardEvent) => {
    const passo =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
          ? -1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? abasVisiveis().length - 1
              : null;
    if (passo === null) return;
    e.preventDefault();

    const visiveis = abasVisiveis();
    const atual = visiveis.findIndex((a) => a.id === ativa);
    const proximo =
      e.key === "Home" || e.key === "End"
        ? passo
        : (atual + passo + visiveis.length) % visiveis.length;

    onIrPara(visiveis[proximo].id);
    // O foco acompanha a seleção; o botão já existe, só mudou de estado.
    requestAnimationFrame(() => {
      const botoes =
        listaRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      botoes?.[proximo]?.focus();
    });
  };

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label="Aparência"
      onKeyDown={navegar}
      className="dark:border-dark-600 mb-5 flex gap-1 border-b border-gray-200"
    >
      {abasVisiveis().map((a) => {
        const on = a.id === ativa;
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-aparencia-${a.id}`}
            aria-selected={on}
            aria-controls={`painel-aparencia-${a.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onIrPara(a.id)}
            className={clsx(
              "text-xs-plus flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition-colors",
              on
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "dark:text-dark-300 border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {a.titulo}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------- Painel

function AbaPainel() {
  const [grafo, setGrafo] = useState(getGrafoAtivo);
  const [vinheta, setVinheta] = useState(getVinhetaAtiva);

  return (
    <div className="dark:divide-dark-500 divide-y divide-gray-100">
      <ToggleRow
        nome="Animação de fundo"
        descricao="A rede de nós animada por trás do painel."
        checked={grafo}
        onChange={(v) => {
          setGrafo(v);
          setGrafoAtivo(v);
        }}
      />
      <ToggleRow
        nome="Vinheta"
        descricao="Escurecimento suave nas bordas da tela."
        checked={vinheta}
        onChange={(v) => {
          setVinheta(v);
          setVinhetaAtiva(v);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------ Guia de marca

function AbaGuiaDeMarca({
  marcaEditando,
  onAbrirMarca,
}: {
  marcaEditando: string | null;
  onAbrirMarca: (id: string | null) => void;
}) {
  const {
    marcas,
    activeId,
    carregando,
    hidratado,
    offline,
    erro,
    legadoPendente,
    migracaoBloqueada,
    recarregar,
    criar,
    remover,
    setActive,
    migrarLocais,
  } = useGestaoMarcas();
  // Enquanto as permissões não voltaram, nada de escrita aparece: o hook parte
  // de "pode" para não travar o modo offline, e sem esta espera o botão "Nova
  // marca" piscaria na tela de quem não pode antes de sumir.
  const { pode, resolvendo } = usePodeGerenciarMarcas();
  const podeGerenciar = pode && !resolvendo;

  const [criando, setCriando] = useState(false);
  const [enviandoLegado, setEnviandoLegado] = useState(false);
  // A marca em confirmação e o estado do modal são separados porque o
  // `ConfirmModal` segue montado durante o fade-out: zerar a marca no
  // fechamento faria o texto piscar para a mensagem genérica.
  const [aExcluir, setAExcluir] = useState<MarcaLocal | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState<ModalState>("pending");

  // Um id de marca na URL que não existe mais (link antigo, marca excluída por
  // outro membro) volta para a lista em vez de deixar a tela em branco.
  const existe = marcas.some((m) => m.id === marcaEditando);
  useEffect(() => {
    if (marcaEditando && hidratado && !existe) onAbrirMarca(null);
  }, [marcaEditando, hidratado, existe, onAbrirMarca]);

  const criarMarca = async () => {
    setCriando(true);
    try {
      onAbrirMarca(await criar());
    } catch (e) {
      toast.error(mensagem(e, "Não foi possível criar a marca."));
    } finally {
      setCriando(false);
    }
  };

  const enviarLegado = async () => {
    setEnviandoLegado(true);
    try {
      const r = await migrarLocais();
      if (r.bloqueada) {
        toast.error("A sua role não permite enviar marcas para a organização.");
      } else if (r.falhas) {
        toast.error(`${r.falhas} marca(s) não puderam ser enviadas.`);
      } else {
        toast(
          r.migradas === 1
            ? "1 marca enviada para a organização"
            : `${r.migradas} marcas enviadas para a organização`,
        );
      }
    } finally {
      setEnviandoLegado(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await remover(aExcluir.id);
      setEstadoConfirm("success");
    } catch (e) {
      setEstadoConfirm("error");
      toast.error(mensagem(e, "Não foi possível excluir a marca."));
    } finally {
      setExcluindo(false);
    }
  };

  // A edição só monta com a marca já em mãos: `useEditorMarca` lê o estado
  // inicial do store uma vez, e montá-lo antes da hidratação partiria do PADRAO.
  if (marcaEditando) {
    if (!hidratado) {
      return (
        <div className="grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      );
    }
    if (existe) {
      return (
        <>
          <Avisos offline={offline} />
          <MarcaEditorInline
            key={marcaEditando}
            brandId={marcaEditando}
            podeGerenciar={podeGerenciar}
            onVoltar={() => onAbrirMarca(null)}
          />
        </>
      );
    }
  }

  return (
    <>
      <Avisos offline={offline} />

      <div className="mb-5">
        <h4 className="dark:text-dark-50 text-base font-semibold text-gray-800">
          Guia de marca
        </h4>
        <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
          Gerencie as identidades visuais usadas pela IA na geração de
          conteúdos.
        </p>
      </div>

      {legadoPendente > 0 && podeGerenciar && (
        <div className="dark:border-dark-600 dark:bg-dark-800/40 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5">
          <p className="dark:text-dark-200 text-xs-plus min-w-0 text-gray-600">
            {legadoPendente === 1
              ? "1 marca deste navegador ainda não foi enviada para a organização."
              : `${legadoPendente} marcas deste navegador ainda não foram enviadas para a organização.`}
            {migracaoBloqueada &&
              " A sua role não permite enviá-las — fale com um administrador."}
          </p>
          {!migracaoBloqueada && (
            <Button
              variant="outlined"
              onClick={() => void enviarLegado()}
              disabled={enviandoLegado}
              className="text-xs-plus h-8 shrink-0 gap-1.5 px-2.5"
            >
              {enviandoLegado ? (
                <Spinner className="size-4" />
              ) : (
                <ArrowUpTrayIcon className="size-4" />
              )}
              Enviar agora
            </Button>
          )}
        </div>
      )}

      <MarcasLista
        marcas={marcas}
        activeId={activeId}
        carregando={carregando || criando}
        erro={erro}
        podeGerenciar={podeGerenciar}
        onRecarregar={() => void recarregar()}
        onCriar={() => void criarMarca()}
        onEditar={(m) => onAbrirMarca(m.id)}
        onAtivar={(m) => setActive(m.id)}
        onExcluir={setAExcluir}
      />

      <ConfirmModal
        show={aExcluir != null}
        onClose={() => {
          setAExcluir(null);
          setEstadoConfirm("pending");
        }}
        onOk={() => void confirmarExclusao()}
        confirmLoading={excluindo}
        state={estadoConfirm}
        messages={MENSAGENS_EXCLUIR_MARCA(aExcluir?.ds.marca.nome ?? "")}
      />
    </>
  );
}

/** Faixa de "as alterações não estão indo para a organização". */
function Avisos({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <div className="text-xs-plus dark:text-warning-lighter border-warning/30 bg-warning/10 text-warning mb-4 rounded-lg border px-3 py-2">
      Sem conexão com o servidor: as marcas e as alterações estão ficando só
      neste navegador. Entre de novo para voltar a sincronizar com a
      organização.
    </div>
  );
}

/** Mensagem do erro da API, com um fallback curto. */
function mensagem(e: unknown, padrao: string): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return padrao;
}
