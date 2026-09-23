// Import Dependencies
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import {
  PresentationChartBarIcon,
  SparklesIcon,
  PlusIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  CircleStackIcon,
  XMarkIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { Accordion, Button, Checkbox, Spinner } from "@/components/ui";
import { ApresentacaoEtapa, type EtapaStatus } from "./ApresentacaoEtapa";
import {
  ApresentacaoSlideCard,
  ehDragDoModo,
  type ModoItem,
} from "./ApresentacaoSlideCard";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useAssistente } from "@/app/contexts/assistente/context";
import { RotuloCampo } from "./RotuloCampo";
import {
  DesignSystemBar,
  useActiveDesignSystem,
  useDesignSystems,
} from "./design-system";
import { NEUTRO, type DesignSystem } from "./design-system/types";
import {
  gerarPlanoApi,
  ajustarSlideApi,
  gerarSlidesApi,
  gerarPptxApi,
  gerarHtmlApi,
  extrairIdentidadeApi,
  IDENTIDADE_ACCEPT,
  type IdentidadeExtraida,
  type Formato,
  type FontesUsadas,
  type Plano,
  type Roteiro,
} from "@/services/api/apresentacao";
import { takeIaPrefill } from "@/utils/iaPrefill";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Criar apresentação — tela do AI Studio (`/:produto/ia/apresentacao`). Era uma
// janela do host global de modais de IA; virou tela porque o fluxo não cabe numa
// janela.
//
// Configurar → planejar → revisar → gerar → consumir:
//   1) wizard de configuração (tema, formato, nº, tom);
//   2) a IA devolve o PLANO — o que cada slide vai fazer, não o texto final;
//   3) o usuário revisa, reordena, remove e dirige por "Ajustar com IA";
//   4) aprovado o plano, a IA escreve os slides e o renderizador gera o arquivo;
//   5) baixar e/ou salvar no Repositório.
//
// O usuário não edita o texto dos slides: ele dirige, a IA executa. Por isso
// não há input de conteúdo no plano — só instrução em linguagem natural.
// Sem persistência: sair da tela descarta o plano, como fechar o modal fazia.
// ----------------------------------------------------------------------

// Classe canônica de campo do app (Insights, Documentos, Conectores, FeedDetail).
// `form-input` já entrega rounded-lg e px-3 py-2, então isto acrescenta borda,
// fundo, largura e os estados de hover/foco.
//
// `dark:text-dark-100` precisa estar AQUI, mesmo a classe `form-input` já
// trazendo: ela vive em `@layer components` e perde para o `text-gray-800` da
// camada utilities — sem este par o texto digitado some no tema escuro.
const CAMPO =
  "form-input dark:border-dark-450 dark:bg-dark-800 dark:text-dark-100 dark:placeholder:text-dark-300 dark:hover:border-dark-400 focus:border-primary-500 w-full border border-gray-300 bg-white text-sm text-gray-800 placeholder:text-gray-400 hover:border-gray-400 focus:ring-0";
const CAMPO_SELECT = CAMPO.replace("form-input", "form-select");
// `resize-y` anula de propósito o `resize-none` que vem de `form-textarea`.
const CAMPO_TEXTAREA = `${CAMPO.replace("form-input", "form-textarea")} resize-y`;
// Caixa de erro com os tokens semânticos do tema (o app usa `text-error`).
const CAIXA_ERRO =
  "text-xs-plus dark:text-error-lighter border-error/30 bg-error/10 text-error rounded-lg border px-3 py-2";

const FORMATOS: { id: Formato; label: string; desc: string }[] = [
  {
    id: "pptx",
    label: "PowerPoint (.pptx)",
    desc: "Baixa um arquivo para PowerPoint/Keynote/Slides.",
  },
  {
    id: "slides-html",
    label: "Slides HTML",
    desc: "Passador de página no navegador (setas/clique).",
  },
  {
    id: "book-html",
    label: "Book HTML",
    desc: "Documento de leitura com menu de capítulos.",
  },
];

// "" = a IA decide. O backend já trata tom ausente ("- Tom: (não informado)"),
// o select é que nunca oferecia a opção — o mesmo contrato do 0 em QTDS.
const TONS: [string, string][] = [
  ["", "A IA decide"],
  ["executivo", "Executivo"],
  ["didatico", "Didático"],
  ["inspirador", "Inspirador"],
  ["comercial", "Comercial"],
  ["tecnico", "Técnico"],
];

const QTDS = [0, 5, 7, 10, 12, 15, 20];

/**
 * Configurar → planejar → revisar → gerar → consumir.
 *
 * A diferença que importa: a primeira geração produz o PLANO (o que cada slide
 * vai fazer), não o arquivo. O arquivo só existe depois que o usuário aprova.
 */
type Step = "form" | "planejando" | "plano" | "gerando" | "pronta";

// Etapas do wizard da etapa "form". É estado de APRESENTAÇÃO: nenhuma delas
// muda o payload enviado ao backend, que segue sendo montado dos mesmos campos.
type EtapaId = "sobre" | "formato" | "geracao";

// "Direcionamento" (público-alvo e objetivo) SAIU: eram dois campos opcionais
// perguntando, em outra etapa, o que a primeira já pede em texto livre — quem
// escreve "para o conselho, destacando riscos" respondeu as duas coisas na
// frase. Uma etapa a menos vale mais que dois campos que repetem a pergunta.
const ETAPAS: { id: EtapaId; numero: string; titulo: string }[] = [
  { id: "sobre", numero: "01", titulo: "Sobre a apresentação" },
  { id: "formato", numero: "02", titulo: "Formato" },
  // "Contexto" (usar o Repositório como referência) SAIU junto: o Repositório
  // já entra em toda geração — as diretrizes ativas vão no system prompt de
  // qualquer chamada de IA e os títulos do Vault são carregados sempre. A
  // etapa pedia uma decisão que já estava tomada. Ver `fontes` em gerarPlano.
  // "Identidade visual" deixou de ser etapa: virou UMA caixa abaixo do campo de
  // "Sobre", porque a decisão é binária (usar a identidade da organização ou
  // não) e não merecia um passo do wizard só para ela. Escolher QUAL marca é da
  // organização, em Configurações › Aparência › Guia de marca — aqui só se usa.
  { id: "geracao", numero: "03", titulo: "Geração" },
];

/**
 * A identidade extraída de um documento, no formato que o resto do fluxo já
 * usa.
 *
 * Parte do NEUTRO e sobrepõe só o que veio: o que o manual não disser continua
 * neutro, em vez de herdar a paleta de outra marca. As cores vazias são
 * descartadas porque `designTheme()` no backend rejeita silenciosamente
 * qualquer coisa que não case `#RRGGBB` — deixar passar string vazia faria o
 * arquivo cair no fallback sem ninguém perceber.
 */
function identidadeParaDesign(id: IdentidadeExtraida): DesignSystem {
  const cores = { ...NEUTRO.cores };
  for (const [chave, valor] of Object.entries(id.cores)) {
    if (valor) (cores as Record<string, string>)[chave] = valor;
  }
  return {
    ...NEUTRO,
    marca: { ...NEUTRO.marca, nome: id.nome, tom: id.tom },
    cores,
    tipografia: {
      ...NEUTRO.tipografia,
      fonteTitulo: id.fonteTitulo || NEUTRO.tipografia.fonteTitulo,
      fonteCorpo: id.fonteCorpo || NEUTRO.tipografia.fonteCorpo,
    },
  };
}

/** Etapa seguinte na ordem, ou `null` na última. */
function proximaEtapa(id: EtapaId): EtapaId | null {
  const i = ETAPAS.findIndex((e) => e.id === id);
  return i >= 0 && i < ETAPAS.length - 1 ? ETAPAS[i + 1].id : null;
}

/** Remove e reinsere — e não troca dois vizinhos: o drop pode pular posições. */
function reposicionar<T>(arr: T[], de: number, para: number): T[] {
  if (para < 0 || para >= arr.length || de === para) return arr;
  const next = [...arr];
  const [item] = next.splice(de, 1);
  next.splice(para, 0, item);
  return next;
}

/** Assuntos que a IA ligou no bloco "Conexões" — `[[Título]]`, com o `(novo)`
    preservado quando a linha o traz. É sugestão do modelo, não fonte lida. */
function assuntosConectados(conexoes: string): string[] {
  const linhas = (conexoes || "").split("\n");
  const achados: string[] = [];
  for (const linha of linhas) {
    const m = linha.match(/\[\[(.+?)\]\]/);
    if (!m) continue;
    achados.push(/\(novo\)/i.test(linha) ? `${m[1]} (novo)` : m[1]);
  }
  return achados;
}

interface ResumoParams {
  tema: string;
  quantos: number;
  unidadeTexto: string;
  titulos: string[];
  rotuloFormato: string;
  rotuloQtd: string;
  rotuloTom: string;
  marca: string;
  fontesUsadas?: FontesUsadas;
  conexoes: string;
  /** Gerou sem passar pela revisão — muda a frase de fechamento. */
  direto: boolean;
}

/** Máximo de regras listadas uma a uma; o resto vira "e mais N". Sessenta
    linhas de fonte afogariam o resto da mensagem num painel de chat. */
const MAX_FONTES_LISTADAS = 10;

/**
 * Markdown do aviso publicado no assistente quando o roteiro fica pronto.
 *
 * Função pura: recebe tudo por parâmetro, para o texto poder ser lido (e
 * conferido) sem o componente em volta.
 *
 * Cada fonte é nomeada pelo que ela é de fato. As REGRAS do Repositório
 * alimentam a geração (o conteúdo vai no prompt); as notas .md não são lidas —
 * delas só os títulos são oferecidos como alvo de link. Dizer "arquivos usados"
 * para as notas seria falso, e é por isso que os dois blocos são separados.
 */
function resumoParaAssistente(p: ResumoParams): string {
  const linhas: string[] = [
    `Planejei uma apresentação de **${p.quantos} ${p.unidadeTexto}** a partir de *${p.tema}*.`,
    "",
    "**Configuração**",
    `- Formato: ${p.rotuloFormato} · Quantidade: ${p.rotuloQtd} · Tom: ${p.rotuloTom}`,
    `- Identidade visual: ${p.marca}`,
    "",
    "**Plano da apresentação**",
    ...p.titulos.map((t, i) => `${i + 1}. ${t.trim() || "(sem título)"}`),
  ];

  // O Repositório entra sempre — o bloco deixou de ser condicional junto com a
  // etapa que o ligava.
  {
    linhas.push("", "**Fontes do Repositório**");
    const regras = p.fontesUsadas?.memorias;
    if (!p.fontesUsadas) {
      // Servidor sem o campo de proveniência: dizer o que foi pedido, sem
      // fingir saber o que foi usado.
      linhas.push(
        "O Repositório entrou como referência (este servidor não informa quais itens foram usados).",
      );
    } else if (!regras?.length) {
      linhas.push(
        "Não havia nenhuma regra ativa no Repositório — nada foi acrescentado como referência.",
      );
    } else {
      linhas.push(
        `${regras.length} ${regras.length === 1 ? "regra entrou" : "regras entraram"} como referência:`,
        ...regras
          .slice(0, MAX_FONTES_LISTADAS)
          .map((m) => `- ${m.category ? `${m.category} · ` : ""}${m.title}`),
      );
      if (regras.length > MAX_FONTES_LISTADAS) {
        linhas.push(`- … e mais ${regras.length - MAX_FONTES_LISTADAS}`);
      }
    }

    const titulosVault = p.fontesUsadas?.vaultTitulos ?? [];
    if (titulosVault.length) {
      linhas.push(
        "",
        `Os arquivos .md não são lidos na geração: das notas sincronizadas a IA recebeu só os títulos (${titulosVault.length}), como alvos para o bloco de conexões.`,
      );
    }
    if (p.fontesUsadas?.truncado) {
      linhas.push(
        "",
        "O bloco de referências passou do limite e foi cortado em 20.000 caracteres.",
      );
    }
  }

  const conectados = assuntosConectados(p.conexoes);
  if (conectados.length) {
    linhas.push(
      "",
      "**Assuntos conectados** *(sugestão da IA, não são fontes)*",
      ...conectados.map((a) => `- ${a}`),
    );
  }

  linhas.push(
    "",
    p.direto
      ? "A apresentação foi gerada direto deste plano, sem a etapa de revisão."
      : 'Revise o plano na tela. Para mudar um slide, use "Ajustar com IA" — e então gere a apresentação.',
  );
  return linhas.join("\n");
}

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar. Tente novamente.";
}

export default function Apresentacao() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  const [step, setStep] = useState<Step>("form");
  const [erro, setErro] = useState("");
  // Validação da etapa 01. Separada de `erro` (falha da API) porque cada erro
  // aparece onde o usuário pode resolvê-lo: este dentro da etapa, o outro
  // junto do CTA.
  const [erroTema, setErroTema] = useState("");

  // Marca/design system ativo — vale para o roteiro e para o arquivo gerado
  // (cores, fontes e logo do .pptx / HTML saem daqui).
  const design = useActiveDesignSystem();
  const { brands } = useDesignSystems();
  const temMarcas = brands.length > 0;
  /**
   * Usar a identidade da organização (a marca ativa). Marcado por padrão — é o
   * comportamento que a tela sempre teve. Desmarcado, a apresentação sai no
   * visual neutro.
   */
  const [usarIdentidadeDaOrg, setUsarIdentidadeDaOrg] = useState(true);
  /** Identidade lida de um documento anexado, e o nome do arquivo de origem. */
  const [identidade, setIdentidade] = useState<{
    ds: IdentidadeExtraida;
    origem: string;
  } | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Formulário (etapa 1)
  const [tema, setTema] = useState("");
  const [formato, setFormato] = useState<Formato>("pptx");
  const [nSlides, setNSlides] = useState(0);
  const [tom, setTom] = useState("executivo");
  /** Etapa 03: ir do wizard ao arquivo sem parar na revisão do plano. */
  const [pularRevisao, setPularRevisao] = useState(false);

  // Plano (etapa 2) — a especificação que o usuário revisa e dirige.
  const [plano, setPlano] = useState<Plano | null>(null);
  /** Slides em ajuste e erros do último ajuste, por id. */
  const [ajustando, setAjustando] = useState<Set<string>>(new Set());
  const [errosAjuste, setErrosAjuste] = useState<Record<string, string>>({});

  // Resultado (etapa 3) — o arquivo fica em memória até o usuário pedir.
  // Gerar não baixa: baixar é uma decisão dele.
  const [resultado, setResultado] = useState<{
    roteiro: Roteiro;
    blob: Blob;
    nome: string;
    quantos: number;
  } | null>(null);

  // Prefill vindo de outra tela (ex.: ação de IA de uma nota). Uso único: quem
  // navega para cá grava em sessionStorage e esta leitura consome.
  useEffect(() => {
    const pre = takeIaPrefill("apresentacao");
    // O contexto ia para o campo Objetivo, da etapa Direcionamento. Sem ela,
    // ele entra no próprio tema — descartá-lo perderia o que a tela de origem
    // mandou, e o texto livre é exatamente onde essa informação passou a morar.
    const partes = [pre?.tema, pre?.contexto].filter(Boolean) as string[];
    if (partes.length) setTema(partes.join("\n\n"));
  }, []);

  // ---- Wizard da etapa "form" ----
  // `null` = todas recolhidas. Acontece ao concluir a última etapa: o wizard
  // inteiro vira o resumo da configuração, que é a revisão antes de gerar.
  const [etapaAtiva, setEtapaAtiva] = useState<EtapaId | null>("sobre");
  // "Resolvida" = o usuário passou pela etapa. Nenhuma nasce resolvida: a
  // identidade, que era a exceção, deixou de ser etapa.
  const [resolvidas, setResolvidas] = useState<Set<EtapaId>>(
    () => new Set<EtapaId>(),
  );
  const cardsRef = useRef<Partial<Record<EtapaId, HTMLDivElement | null>>>({});

  const isBook = formato === "book-html";
  const unidade = isBook ? "capítulos" : "slides";
  const unidadeSingular = isBook ? "capítulo" : "slide";
  const busy = step === "planejando" || step === "gerando";

  // O relato do que foi gerado vai para o assistente que já existe (a bolinha),
  // e não para um painel próprio desta tela.
  const { anunciar } = useAssistente();
  /** Ver `aiStudioGenerationChat`: o painel não abre sozinho. */
  const semChatAutomatico = isFeatureTemporarilyDisabled(
    "aiStudioGenerationChat",
  );

  const irPara = (id: EtapaId) => {
    setEtapaAtiva(id);
    // Depois do paint: o painel só existe na próxima renderização.
    requestAnimationFrame(() =>
      cardsRef.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      }),
    );
  };

  /** Marca a etapa como resolvida e abre a seguinte; na última, recolhe tudo. */
  const concluirEtapa = (id: EtapaId) => {
    setResolvidas((prev) => new Set(prev).add(id));
    const prox = proximaEtapa(id);
    if (prox) irPara(prox);
    else setEtapaAtiva(null);
  };

  const statusEtapa = (id: EtapaId): EtapaStatus =>
    etapaAtiva === id ? "ativa" : resolvidas.has(id) ? "concluida" : "pendente";

  // Resumos das etapas recolhidas — derivados dos mesmos campos do formulário,
  // sem estado paralelo. Juntos, os cards recolhidos são a revisão final: por
  // isso não existe uma sexta etapa de "revisão".
  const rotuloFormato =
    FORMATOS.find((f) => f.id === formato)?.label ?? "PowerPoint (.pptx)";
  const rotuloQtd = nSlides === 0 ? "A IA decide" : `${nSlides} ${unidade}`;
  const rotuloTom = TONS.find(([id]) => id === tom)?.[1] ?? TONS[0][1];

  /**
   * A identidade que a apresentação vai usar, e o rótulo dela.
   *
   * Marcado, vale a marca ativa da organização — e ela SOBREPÕE o que estiver
   * descrito no campo de "Sobre". Desmarcado (ou marcado sem nenhuma marca
   * cadastrada), vale o NEUTRO: a tela dizia "estilo padrão da plataforma"
   * enquanto mandava a marca beculture inteira para o prompt, e esta é a linha
   * que conserta isso.
   */
  const usandoMarca = usarIdentidadeDaOrg && temMarcas;
  const designEnviado = usandoMarca
    ? design
    : identidade
      ? identidadeParaDesign(identidade.ds)
      : NEUTRO;
  const rotuloIdentidade = usandoMarca
    ? design.marca.nome
    : identidade
      ? identidade.ds.nome || identidade.origem
      : "Visual neutro";

  const resumos: Record<EtapaId, string> = {
    sobre: [tema.trim() || "A definir", rotuloIdentidade].join(" · "),
    formato: [rotuloFormato, rotuloQtd, rotuloTom].join(" · "),
    geracao: pularRevisao
      ? "Gerar sem revisar o plano"
      : "Revisar o plano antes de gerar",
  };

  const temTema = !!tema.trim();
  const faltaResolver = ETAPAS.some((e) => !resolvidas.has(e.id));

  /** "Decidir por mim"/"Deixar o restante com a IA": não inventa valores —
      devolve os campos ao estado vazio, que o backend já trata como decisão da
      IA no momento da geração. */
  const deixarComIa = (ids: EtapaId[]) => {
    if (ids.includes("formato")) {
      setNSlides(0);
      setTom("");
    }
    setResolvidas((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  /** "Decidir por mim" de uma etapa: limpa os campos e conclui em um passo. */
  const decidirPorMim = (id: EtapaId) => {
    deixarComIa([id]);
    concluirEtapa(id);
  };

  /** Meta + estado de uma etapa, no formato que o card espera. */
  const etapa = (id: EtapaId) => {
    const e = ETAPAS.find((x) => x.id === id)!;
    return {
      id,
      numero: e.numero,
      titulo: e.titulo,
      status: statusEtapa(id),
      resumo: resumos[id],
      innerRef: (el: HTMLDivElement | null) => {
        cardsRef.current[id] = el;
      },
    };
  };

  /** Lê o manual de marca anexado. Falha aqui não trava nada: o fluxo segue no
      visual neutro, e a mensagem do backend já vem pronta para exibir. */
  const anexarEspecificacoes = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setExtraindo(true);
    try {
      const r = await extrairIdentidadeApi(arquivo);
      setIdentidade({ ds: r.identidade, origem: r.origem });
      setUsarIdentidadeDaOrg(false); // anexar é dizer "quero esta, não a da organização"
      toast("Identidade visual extraída", {
        description: r.identidade.observacoes || `A partir de ${r.origem}.`,
      });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setExtraindo(false);
      if (arquivoRef.current) arquivoRef.current.value = ""; // permite reanexar o mesmo arquivo
    }
  };

  /**
   * "Repensar direcionamento": devolve ao wizard, na primeira etapa, com tudo
   * preenchido como estava.
   *
   * Não toca no plano. Ele continua em memória, e o rodapé do wizard oferece a
   * volta enquanto existir — sem isso, um clique sem querer obrigaria a
   * regenerar (perdendo os ajustes feitos slide a slide) só para rever o que já
   * estava pronto.
   */
  const repensarDirecionamento = () => {
    setErro("");
    setStep("form");
    setEtapaAtiva("sobre");
    irPara("sobre");
  };

  const resetTudo = () => {
    setStep("form");
    setErro("");
    setErroTema("");
    setEtapaAtiva("sobre");
    setResolvidas(new Set<EtapaId>());
    setPlano(null);
    setResultado(null);
    setErrosAjuste({});
    setIdentidade(null);
  };

  // ---- Configuração → plano ----
  // A primeira geração NÃO produz arquivo: produz a especificação que o usuário
  // revisa. É o que tira o usuário do papel de redator.
  //
  // `direto` é a etapa 03: em vez de parar na revisão, executa o plano assim
  // que ele chega — o mesmo que clicar em "Gerar apresentação" na tela de
  // revisão, sem a tela. É intenção do SUBMIT, não modo persistente: quem já
  // está revisando e pede "Refazer plano" continua na revisão.
  const gerarPlano = async ({ direto = false } = {}) => {
    setErro("");
    if (!tema.trim()) {
      setErroTema("Descreva o que você deseja apresentar.");
      irPara("sobre");
      return;
    }
    setStep("planejando");
    try {
      const { plano: novo, fontesUsadas } = await gerarPlanoApi({
        tema: tema.trim(),
        formato,
        nSlides,
        tom,
        // Incondicional: o Repositório deixou de ser uma escolha do wizard.
        // Ele já alimentava toda geração pelas diretrizes do system prompt;
        // pedi-lo aqui é o que o promove a base factual do plano (bloco
        // "REFERÊNCIAS") e o que devolve `fontesUsadas` — o recibo que a
        // mensagem do assistente lista.
        fontes: ["memoria"],
        design: designEnviado,
      });
      setPlano(novo);
      setErrosAjuste({});
      setResultado(null);

      // No caminho direto o aviso sai DEPOIS do arquivo: anunciar "plano
      // pronto" enquanto a geração corre descreveria um estado que a pessoa
      // nunca vê.
      const gerou = direto ? await executarPlano(novo) : false;
      if (!direto) setStep("plano");

      if (semChatAutomatico) return;
      anunciar({
        titulo: gerou
          ? "Criar apresentação · apresentação gerada"
          : "Criar apresentação · plano pronto",
        corpo: resumoParaAssistente({
          tema: tema.trim(),
          quantos: novo.slides.length,
          unidadeTexto: novo.slides.length === 1 ? unidadeSingular : unidade,
          titulos: novo.slides.map((s) => s.titulo),
          rotuloFormato,
          rotuloQtd,
          rotuloTom,
          marca: rotuloIdentidade,
          fontesUsadas,
          conexoes: novo.conexoes || "",
          direto: gerou,
        }),
      });
    } catch (err) {
      setErro(errMessage(err));
      setStep("form");
    }
  };

  // ---- Ajuste de um slide por instrução ----
  // Só o slide pedido muda. O plano anterior dele fica intacto até a resposta
  // chegar, e continua lá se a chamada falhar.
  const ajustarSlide = async (indice: number, instrucao: string) => {
    if (!plano) return;
    const alvo = plano.slides[indice];
    if (!alvo) return;
    setAjustando((s) => new Set(s).add(alvo.id));
    setErrosAjuste((e) => {
      if (!(alvo.id in e)) return e;
      const resto = { ...e };
      delete resto[alvo.id];
      return resto;
    });
    try {
      const slide = await ajustarSlideApi({
        plano,
        indice,
        instrucao,
        design: designEnviado,
      });
      setPlano((p) =>
        p
          ? {
              ...p,
              // Casa por id, e não por índice: o usuário pode ter reordenado
              // enquanto a IA respondia.
              slides: p.slides.map((s) =>
                s.id === alvo.id ? { ...slide, id: alvo.id } : s,
              ),
            }
          : p,
      );
    } catch (err) {
      setErrosAjuste((e) => ({
        ...e,
        [alvo.id]: `Não foi possível ajustar este ${unidadeSingular}. ${errMessage(err)}`,
      }));
    } finally {
      setAjustando((s) => {
        const next = new Set(s);
        next.delete(alvo.id);
        return next;
      });
    }
  };

  const removerSlide = (id: string) =>
    setPlano((p) =>
      p ? { ...p, slides: p.slides.filter((s) => s.id !== id) } : p,
    );

  // ---- Plano → apresentação ----
  // Duas chamadas: a IA escreve o conteúdo final a partir do plano, e o
  // renderizador determinístico transforma em arquivo. Nada baixa aqui — o
  // arquivo fica em memória até o usuário clicar em baixar.
  //
  // Recebe o plano por ARGUMENTO, e não do estado: o caminho direto (etapa 03)
  // executa o plano no mesmo tick em que ele chega, antes de o `setPlano` ter
  // efeito. Devolve se deu certo, para quem chamou saber o que anunciar.
  const executarPlano = async (p: Plano): Promise<boolean> => {
    if (!p.slides.length) return false;
    setErro("");
    setStep("gerando");
    try {
      const roteiro = await gerarSlidesApi({
        plano: p,
        formato,
        tom,
        design: designEnviado,
      });
      const nome =
        (roteiro.titulo || "apresentacao")
          .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
          .slice(0, 60) || "apresentacao";
      const blob =
        formato === "pptx"
          ? await gerarPptxApi(roteiro, designEnviado)
          : new Blob([await gerarHtmlApi(formato, roteiro, designEnviado)], {
              type: "text/html",
            });
      setResultado({
        roteiro,
        blob,
        nome,
        quantos: (isBook ? roteiro.capitulos : roteiro.slides)?.length ?? 0,
      });
      setStep("pronta");
      return true;
    } catch (err) {
      // O plano e os ajustes continuam de pé: dá para tentar de novo sem
      // refazer nada. Vale também para o caminho direto — falhou a escrita, a
      // pessoa cai na revisão com o plano inteiro em mãos.
      setErro(errMessage(err));
      setStep("plano");
      return false;
    }
  };

  /** Botão "Gerar apresentação" da tela de revisão. */
  const gerarApresentacao = () => {
    if (!plano || step === "gerando") return;
    void executarPlano(plano);
  };

  const baixarArquivo = () => {
    if (!resultado) return;
    const ext = formato === "pptx" ? "pptx" : "html";
    const url = URL.createObjectURL(resultado.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resultado.nome}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Download iniciado", { description: `${resultado.nome}.${ext}` });
  };

  const abrirNoNavegador = () => {
    if (!resultado || formato === "pptx") return;
    const url = URL.createObjectURL(resultado.blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // ---- Repositório ----
  // A nota guarda o roteiro em Markdown (é o que o grafo lê) e anexa o arquivo
  // já gerado — o mesmo que o usuário baixa, sem uma segunda geração.
  const prepararMemoria = async () => {
    if (!resultado) return { conteudo: "" };
    const { roteiro, blob } = resultado;
    const corpo = isBook
      ? (roteiro.capitulos ?? [])
          .map(
            (c, i) =>
              `## ${i + 1}. ${c.titulo}\n\n${c.paragrafos.join("\n\n")}`,
          )
          .join("\n\n")
      : (roteiro.slides ?? [])
          .map((s, i) => {
            const linhas = [
              ...(s.bullets ?? []).map((b) => `- ${b}`),
              ...(s.destaques ?? []).map(
                (d) => `- **${d.valor}** — ${d.rotulo}`,
              ),
              ...(s.colunas ?? []).map(
                (c) => `- **${c.titulo}**: ${c.itens.join("; ")}`,
              ),
            ].join("\n");
            return `## ${i + 1}. ${s.titulo}\n\n${linhas}${s.notas ? `\n\n> ${s.notas}` : ""}`;
          })
          .join("\n\n");
    const cabecalho = roteiro.subtitulo ? `*${roteiro.subtitulo}*\n\n` : "";
    return {
      conteudo:
        cabecalho +
        corpo +
        (roteiro.conexoes?.trim() ? `\n\n${roteiro.conexoes.trim()}\n` : ""),
      anexos: [
        {
          nome: formato === "pptx" ? "deck.pptx" : "deck.html",
          dados: blob,
        },
      ],
    };
  };

  // ---- Reordenação ----
  const modoItem: ModoItem = isBook ? "capitulo" : "slide";

  /** Move por índice. Serve aos botões ↑/↓, ao Alt+setas e ao drop. */
  const mover = (de: number, para: number) =>
    setPlano((p) =>
      p ? { ...p, slides: reposicionar(p.slides, de, para) } : p,
    );

  // A lista inteira fica numa ref para o monitor não ser reassinado a cada
  // renderização.
  const itensRef = useRef<{ id: string }[]>([]);
  itensRef.current = plano?.slides ?? [];

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => ehDragDoModo(source.data, modoItem),
        onDrop({ source, location }) {
          const alvo = location.current.dropTargets[0];
          if (!alvo) return;
          const atual = itensRef.current;
          const de = atual.findIndex((x) => x.id === source.data.id);
          const para = atual.findIndex((x) => x.id === alvo.data.id);
          if (de < 0 || para < 0) return;
          const destino = reorderWithEdge({
            list: atual,
            startIndex: de,
            indexOfTarget: para,
            closestEdgeOfTarget: extractClosestEdge(alvo.data),
            axis: "vertical",
          }).findIndex((x) => x.id === source.data.id);
          if (destino === de) return;
          mover(de, destino);
        },
      }),
    // `mover` e `modoItem` derivam de `isBook`; recriar o monitor ao trocar de
    // formato é o certo — as duas listas são independentes.
    [modoItem],
  );

  return (
    <Page title={`Criar apresentação · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="mx-auto max-w-4xl">
          <div>
            <Link
              to={`/${product.code}/ia`}
              className="dark:text-dark-300 dark:hover:text-dark-100 mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              <ArrowLeftIcon className="size-4" />
              Voltar ao AI Studio
            </Link>

            {/* O ícone é apoio, não protagonista: quem abre a leitura é o título
              (`PageTitle`, text-2xl). Por isso size-9 e não size-11. */}
            <div className="mb-8 flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-500">
                <PresentationChartBarIcon className="size-5 stroke-[1.5]" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <PageTitle
                    help={{
                      description: (
                        <>
                          <p>
                            A IA monta um <strong>plano</strong>: o que cada
                            slide precisa fazer, a narrativa e a direção visual.
                            Você revisa antes de existir arquivo nenhum.
                          </p>
                          <p>
                            Para mudar um slide, use{" "}
                            <strong>Ajustar com IA</strong> e diga o que quer em
                            português — o conteúdo é da IA, a direção é sua.
                            Reordenar e remover continuam na sua mão.
                          </p>
                          <p>
                            Com o plano aprovado, a IA escreve os slides e gera
                            o arquivo: um{" "}
                            <span className="font-mono">.pptx</span> para
                            PowerPoint/Keynote/Slides, slides HTML ou um book de
                            leitura — que você baixa e/ou salva no Repositório.
                          </p>
                        </>
                      ),
                    }}
                  >
                    Criar apresentação
                  </PageTitle>
                  {step === "plano" && (
                    <span className="dark:bg-dark-600 dark:text-dark-200 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                      Revisar o plano
                    </span>
                  )}
                </div>
                <p className="dark:text-dark-300 text-sm text-gray-500">
                  A IA planeja, você revisa e orienta, a IA executa.
                </p>
              </div>
            </div>

            {/* Etapa 1 — wizard de configuração. Uma etapa por vez: a ativa
              mostra os campos, as concluídas viram resumo editável e as
              pendentes ficam discretas. Os cards recolhidos são a revisão da
              configuração — por isso não existe uma sexta etapa de "revisão". */}
            {step === "form" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  gerarPlano({ direto: pularRevisao });
                }}
              >
                <Accordion
                  value={etapaAtiva ?? ""}
                  // Clicar no cabeçalho já aberto devolve "" — recolhe tudo, que
                  // é o estado de resumo. Por isso `null` é um valor legítimo.
                  onChange={(v) => setEtapaAtiva((v as EtapaId) || null)}
                  className="flex flex-col gap-3"
                >
                  {/* 01 — o que se quer apresentar, para quem e para quê */}
                  <ApresentacaoEtapa {...etapa("sobre")}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <PerguntaEtapa className="">
                        O que você quer apresentar, para quem e com que
                        objetivo?
                      </PerguntaEtapa>
                      <FontesDeReferencia
                        extraindo={extraindo}
                        onUpload={() => arquivoRef.current?.click()}
                      />
                    </div>

                    {/* Fora do <label> do campo de propósito: um input de arquivo
                        escondido dentro dele seria acionado ao clicar no texto. */}
                    <input
                      ref={arquivoRef}
                      type="file"
                      accept={IDENTIDADE_ACCEPT}
                      hidden
                      onChange={(e) =>
                        void anexarEspecificacoes(e.target.files?.[0])
                      }
                    />

                    <MemoriaTextarea
                      value={tema}
                      onChange={(e) => {
                        setTema(e.target.value);
                        if (erroTema) setErroTema("");
                      }}
                      rows={5}
                      placeholder="Ex.: Crie uma apresentação sobre o planejamento estratégico de 2027 para o conselho de administração, com o objetivo de aprovar o orçamento — destacando resultados, riscos e próximos passos."
                      className={CAMPO_TEXTAREA}
                    />
                    {erroTema ? (
                      <p className="text-error mt-2 text-sm">{erroTema}</p>
                    ) : (
                      <p className="dark:text-dark-300 text-xs-plus mt-2 text-gray-500">
                        Quanto mais contexto você der sobre o público e o
                        objetivo, melhor será o plano criado pela IA.
                      </p>
                    )}

                    {identidade && (
                      <div className="dark:border-dark-600 dark:bg-dark-800/40 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
                        <PaperClipIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
                        <span className="dark:text-dark-100 text-xs-plus min-w-0 flex-1 truncate text-gray-700">
                          {identidade.origem}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {[
                            identidade.ds.cores.primaria,
                            identidade.ds.cores.secundaria,
                            identidade.ds.cores.acento,
                          ]
                            .filter(Boolean)
                            .map((cor, i) => (
                              <span
                                key={i}
                                title={cor}
                                className="size-3.5 rounded-full border border-black/10"
                                style={{ background: cor }}
                              />
                            ))}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIdentidade(null)}
                          aria-label="Remover as especificações anexadas"
                          className="dark:text-dark-300 dark:hover:text-dark-100 grid size-6 shrink-0 place-items-center rounded-lg text-gray-400 hover:text-gray-700"
                        >
                          <XMarkIcon className="size-4" />
                        </button>
                      </div>
                    )}

                    {/* A identidade visual mora aqui, e não numa etapa própria:
                        a decisão é binária, e o seletor só aparece quando ela é
                        "sim" — sem descrição, porque a própria barra abaixo diz
                        qual marca está valendo (e, sem nenhuma cadastrada,
                        explica isso e aponta o caminho). */}
                    <div className="dark:border-dark-600 mt-4 border-t border-gray-200 pt-4">
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                        <Checkbox
                          checked={usarIdentidadeDaOrg}
                          onChange={(e) =>
                            setUsarIdentidadeDaOrg(e.target.checked)
                          }
                        />
                        <span className="dark:text-dark-200 font-medium text-gray-600">
                          Usar identidade visual de marca
                        </span>
                      </label>

                      {usarIdentidadeDaOrg && (
                        <div className="mt-3">
                          <DesignSystemBar plain />
                        </div>
                      )}
                    </div>

                    <AcoesEtapa
                      onContinuar={() => {
                        if (!tema.trim()) {
                          setErroTema("Descreva o que você deseja apresentar.");
                          return;
                        }
                        setErroTema("");
                        concluirEtapa("sobre");
                      }}
                    />
                  </ApresentacaoEtapa>

                  {/* 02 — como gerar */}
                  <ApresentacaoEtapa
                    {...etapa("formato")}
                    pendenteLabel="A seguir"
                  >
                    <PerguntaEtapa>
                      Como você quer apresentar esse conteúdo?
                    </PerguntaEtapa>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {FORMATOS.map((f) => {
                        const on = formato === f.id;
                        return (
                          <button
                            type="button"
                            key={f.id}
                            onClick={() => setFormato(f.id)}
                            // A seleção não fica só na cor: `aria-pressed` a
                            // comunica a quem usa leitor de tela.
                            aria-pressed={on}
                            className={clsx(
                              "focus-visible:ring-primary-500/50 flex h-full flex-col rounded-lg border p-4 text-start outline-hidden transition-colors focus-visible:ring-2",
                              on
                                ? "border-primary-500 bg-primary-500/10"
                                : "dark:border-dark-600 dark:hover:border-dark-400 border-gray-200 hover:border-gray-300",
                            )}
                          >
                            <span
                              className={clsx(
                                "block text-sm font-semibold",
                                // No tema claro o título selecionado fica na cor
                                // de texto forte, e não no amber: a rampa da
                                // marca não tem tom escuro (primary-700 ainda é
                                // #FFA000) e amber sobre o preenchimento amber/10
                                // dá ~1.8:1. É a mesma regra do botão primário do
                                // tema, que usa slate sobre amber. No escuro,
                                // amber-400 lê bem e fica.
                                on
                                  ? "dark:text-primary-400 text-gray-800"
                                  : "dark:text-dark-100 text-gray-800",
                              )}
                            >
                              {f.label}
                            </span>
                            <span className="dark:text-dark-300 text-xs-plus mt-1 block text-gray-500">
                              {f.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <label className="block text-sm">
                        <RotuloCampo rotulo={`Quantidade de ${unidade}`} />
                        <select
                          value={nSlides}
                          onChange={(e) => setNSlides(Number(e.target.value))}
                          className={CAMPO_SELECT}
                        >
                          {QTDS.map((q) => (
                            <option key={q} value={q}>
                              {q === 0 ? "A IA decide" : `${q} ${unidade}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <RotuloCampo rotulo="Tom" />
                        <select
                          value={tom}
                          onChange={(e) => setTom(e.target.value)}
                          className={CAMPO_SELECT}
                        >
                          {TONS.map(([id, nome]) => (
                            <option key={id} value={id}>
                              {nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <AcoesEtapa
                      onDecidirPorMim={() => decidirPorMim("formato")}
                      onContinuar={() => concluirEtapa("formato")}
                    />
                  </ApresentacaoEtapa>

                  {/* 03 — parar para revisar o plano, ou não */}
                  <ApresentacaoEtapa
                    {...etapa("geracao")}
                    pendenteLabel="Opcional"
                  >
                    <PerguntaEtapa>
                      Quer revisar o plano antes de gerar a apresentação?
                    </PerguntaEtapa>

                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <Checkbox
                        checked={pularRevisao}
                        onChange={(e) => setPularRevisao(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="dark:text-dark-200 block font-medium text-gray-600">
                          Não revisar o plano antes de gerar
                        </span>
                        {/* O planejamento continua acontecendo — é dele que
                            saem os layouts. O que se pula é a parada. Dizer
                            "pular o planejamento" prometeria outra coisa. */}
                        <span className="dark:text-dark-300 mt-0.5 block text-xs font-normal text-gray-400">
                          No plano, você poderá reordenar, remover ou ajustar os
                          slides antes da geração.
                        </span>
                      </span>
                    </label>

                    <AcoesEtapa
                      rotulo="Concluir"
                      onContinuar={() => concluirEtapa("geracao")}
                    />
                  </ApresentacaoEtapa>
                </Accordion>

                {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

                {/* Rodapé: estado semântico + a ação que conclui o fluxo. Nunca um
                  contador "n/5" — as etapas opcionais não são requisito. */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="dark:text-dark-300 text-sm text-gray-500">
                    {!temTema
                      ? "Descreva sua apresentação para continuar."
                      : pularRevisao
                        ? "A IA vai planejar e gerar a apresentação de uma vez."
                        : plano
                          ? "Planejar de novo substitui o plano atual e os ajustes feitos nele."
                          : "Configurações essenciais definidas. Pronto para planejar."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {plano && (
                      <Button
                        type="button"
                        variant="flat"
                        onClick={() => setStep("plano")}
                        className="h-10 gap-1.5"
                      >
                        <ArrowLeftIcon className="size-4" />
                        Voltar ao plano
                      </Button>
                    )}
                    {temTema && faltaResolver && (
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={() => {
                          deixarComIa(
                            ETAPAS.filter((e) => !resolvidas.has(e.id)).map(
                              (e) => e.id,
                            ),
                          );
                          setEtapaAtiva(null);
                        }}
                        className="h-10 gap-1.5"
                      >
                        <SparklesIcon className="size-4" />
                        Deixar o restante com a IA
                      </Button>
                    )}
                    <Button
                      type="submit"
                      color="primary"
                      disabled={!temTema}
                      className="h-10 gap-2 px-5"
                    >
                      <SparklesIcon className="size-5" />
                      {/* O rótulo antigo, "Gerar roteiro", já mentia: o que
                          este botão produz é o plano. Agora ele diz qual dos
                          dois caminhos a etapa 03 escolheu. */}
                      {pularRevisao
                        ? "Gerar apresentação"
                        : "Planejar apresentação"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Loading das duas gerações. Indeterminado de propósito: o
                servidor não informa progresso, e inventar "8 de 12" seria
                encenação. */}
            {busy && (
              <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <div
                  aria-live="polite"
                  className="grid place-items-center py-10"
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Spinner className="size-6" />
                    <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
                      {step === "planejando"
                        ? "Planejando a apresentação…"
                        : "Gerando apresentação…"}
                    </p>
                    <p className="dark:text-dark-300 text-sm text-gray-500">
                      {step === "planejando"
                        ? "A IA está definindo o que cada slide vai fazer."
                        : "Estamos transformando o plano em slides."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Etapa 2 — revisar o plano */}
            {step === "plano" && plano && (
              <div className="flex flex-col gap-4">
                <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
                        {plano.titulo}
                      </h3>
                      {plano.subtitulo && (
                        <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
                          {plano.subtitulo}
                        </p>
                      )}
                    </div>

                    <FaixaIdentidade
                      design={designEnviado}
                      rotulo={rotuloIdentidade}
                    />

                    <span className="dark:text-dark-300 text-tiny-plus font-medium tracking-wider text-gray-500 uppercase">
                      Plano da apresentação
                    </span>

                    {plano.slides.map((s, i) => (
                      <ApresentacaoSlideCard
                        key={s.id}
                        slide={s}
                        indice={i}
                        total={plano.slides.length}
                        modo={modoItem}
                        ajustando={ajustando.has(s.id)}
                        erro={errosAjuste[s.id]}
                        campoTextarea={CAMPO_TEXTAREA}
                        onAjustar={(instrucao) => ajustarSlide(i, instrucao)}
                        onRemover={() => removerSlide(s.id)}
                        onMover={mover}
                      />
                    ))}

                    {erro && <div className={CAIXA_ERRO}>{erro}</div>}

                    <div className="dark:border-dark-600 dark:bg-dark-700 sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-white px-6 pt-3 pb-1 sm:-mx-8 sm:px-8">
                      {/* Volta ao wizard, e NÃO regenera: quem quer outro plano
                          quase sempre quer mudar o pedido antes, e regenerar
                          com o mesmo texto devolveria uma variação do mesmo.
                          O plano fica guardado — dá para voltar sem perdê-lo. */}
                      <Button
                        variant="flat"
                        onClick={repensarDirecionamento}
                        className="gap-1.5"
                      >
                        <ArrowLeftIcon className="size-4" /> Repensar
                        direcionamento
                      </Button>
                      <Button
                        color="primary"
                        onClick={gerarApresentacao}
                        disabled={!plano.slides.length}
                        className="h-10 gap-2 px-5"
                      >
                        <SparklesIcon className="size-5" />
                        Gerar apresentação
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Etapa 3 — apresentação pronta */}
            {step === "pronta" && resultado && (
              <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <span className="bg-primary-500 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-slate-900">
                    <CheckIcon className="size-4" strokeWidth="2.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
                      Apresentação pronta
                    </h3>
                    <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
                      Sua apresentação foi criada a partir do plano aprovado.
                    </p>
                    <p className="dark:text-dark-300 mt-2 text-sm text-gray-500">
                      {resultado.quantos}{" "}
                      {resultado.quantos === 1 ? unidadeSingular : unidade} ·{" "}
                      {rotuloFormato}
                    </p>
                  </div>
                </div>

                {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

                <div className="dark:border-dark-600 mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="flat"
                      onClick={() => setStep("plano")}
                      className="gap-1.5"
                    >
                      <ArrowLeftIcon className="size-4" /> Voltar ao plano
                    </Button>
                    <Button
                      variant="flat"
                      onClick={resetTudo}
                      className="text-xs-plus px-3"
                    >
                      Nova apresentação
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SalvarNaMemoriaButton
                      pasta={PASTA_MEMORIA.apresentacao}
                      titulo={resultado.roteiro.titulo || "Apresentação"}
                      tags={["apresentação"]}
                      versao={resultado.quantos}
                      preparar={prepararMemoria}
                      rotulo="Salvar no Repositório"
                      rotuloSalvo="Salvo no Repositório"
                      // Sem seletor de pasta: nesta tela o destino é evidente
                      // (Apresentações), e a seta só competiria com o CTA.
                      semSeletorDePasta
                      // Mesma altura e respiro do "Baixar" ao lado.
                      className="h-10 px-5"
                    />
                    <EnviarParaGrupoButton
                      funcao="apresentacao"
                      titulo={resultado.roteiro.titulo || "Apresentação"}
                      versao={resultado.quantos}
                      preparar={prepararMemoria}
                      className="h-10 px-5"
                    />
                    {formato !== "pptx" && (
                      <Button
                        variant="outlined"
                        onClick={abrirNoNavegador}
                        className="h-10 gap-2 px-5"
                      >
                        <ArrowTopRightOnSquareIcon className="size-5" />
                        Abrir
                      </Button>
                    )}
                    <Button
                      color="primary"
                      onClick={baixarArquivo}
                      className="h-10 gap-2 px-5"
                    >
                      <ArrowDownTrayIcon className="size-5" />
                      Baixar {formato === "pptx" ? ".pptx" : ".html"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}

/**
 * Faixa compacta da identidade na tela de revisão.
 *
 * INFORMA, não administra: diz qual identidade vai ser aplicada — a marca da
 * organização ou o visual neutro — para a pessoa confirmar antes de gerar. A
 * troca acontece no primeiro step (o checkbox) ou em Configurações › Guia de
 * marca; oferecer um terceiro lugar para mexer nisso era justamente o que esta
 * evolução veio desfazer.
 */
function FaixaIdentidade({
  design,
  rotulo,
}: {
  design: DesignSystem;
  rotulo: string;
}) {
  return (
    <div className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="dark:text-dark-300 text-tiny-plus font-medium tracking-wider text-gray-500 uppercase">
          Identidade visual
        </span>
        <span className="dark:text-dark-100 text-sm font-medium text-gray-800">
          {rotulo}
        </span>
        <span className="flex items-center gap-1">
          {[
            design.cores.primaria,
            design.cores.secundaria,
            design.cores.acento,
          ].map((cor, i) => (
            <span
              key={i}
              className="size-3.5 rounded-full border border-black/10"
              style={{ background: cor }}
              title={cor}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

/** A pergunta que abre uma etapa do wizard — o que o usuário está decidindo. */
function PerguntaEtapa({
  children,
  className = "mb-3",
}: {
  children: React.ReactNode;
  /** Sobrescreve a margem inferior. `""` para a pergunta dividir a linha com
      outro controle, onde o espaçamento passa a ser do contêiner. */
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "dark:text-dark-100 text-sm font-medium text-gray-700",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Rodapé de uma etapa.
 *
 * `onDecidirPorMim` só é passado onde a IA realmente resolve sozinha — não
 * existe endpoint que preencha campos, então a ação devolve os campos ao estado
 * vazio, que o backend já lê como "você decide". Em Contexto e Identidade a
 * ação não aparece: escolher Repositório ou criar marca não é decisão da IA.
 */
function AcoesEtapa({
  onContinuar,
  onDecidirPorMim,
  rotulo = "Continuar",
}: {
  onContinuar: () => void;
  onDecidirPorMim?: () => void;
  rotulo?: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      {onDecidirPorMim && (
        // `type="button"` obrigatório: dentro de um <form>, o default é submit.
        <Button
          type="button"
          variant="outlined"
          onClick={onDecidirPorMim}
          className="h-9 gap-1.5"
        >
          <SparklesIcon className="size-4" />
          Decidir por mim
        </Button>
      )}
      <Button
        type="button"
        color="primary"
        onClick={onContinuar}
        className="h-9 gap-1.5"
      >
        {rotulo}
        {rotulo === "Continuar" && <ArrowRightIcon className="size-4" />}
      </Button>
    </div>
  );
}

/**
 * O "+" do campo de propósito: de onde a IA pode tirar a identidade visual além
 * do guia de marca da organização.
 *
 * O upload FUNCIONA — PDF e .docx passam pelo mesmo `extrairTexto` que Análise,
 * Ata e Documento já usam, e o backend devolve a paleta. Buscar no Repositório
 * fica visível e sem clique enquanto ele for cego para o que não é .md; é o
 * padrão da casa para anunciar o que vem (ver temporarilyDisabledFeatures.ts).
 *
 * Sem opção de imagem: nenhum provedor desta plataforma lê pixels.
 */
function FontesDeReferencia({
  extraindo,
  onUpload,
}: {
  extraindo: boolean;
  onUpload: () => void;
}) {
  const repositorioDesligado = isFeatureTemporarilyDisabled(
    "presentationRepositorySource",
  );

  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        disabled={extraindo}
        aria-label="Adicionar uma referência visual"
        title="Adicionar uma referência visual"
        className="dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600 grid size-8 place-items-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {extraindo ? (
          <Spinner className="size-4" />
        ) : (
          <PlusIcon className="size-4.5" />
        )}
      </MenuButton>
      <Transition
        as={MenuItems}
        anchor={{ to: "bottom end", gap: 4 }}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
        className="dark:bg-dark-750 dark:border-dark-500 z-100 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
      >
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onUpload}
              className={clsx(
                "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors",
                focus && "dark:bg-dark-600 bg-gray-100",
              )}
            >
              <ArrowUpTrayIcon className="dark:text-dark-300 mt-0.5 size-4 shrink-0 text-gray-400" />
              <span>
                <span className="dark:text-dark-100 block text-sm text-gray-700">
                  Realizar upload do computador
                </span>
                <span className="dark:text-dark-300 text-tiny mt-0.5 block text-gray-400">
                  Um PDF ou Word com as especificações da marca — a IA lê e
                  aplica um padrão visual parecido.
                </span>
              </span>
            </button>
          )}
        </MenuItem>

        <div
          aria-disabled={repositorioDesligado || undefined}
          className={clsx(
            "flex items-start gap-2.5 px-3.5 py-2.5",
            repositorioDesligado && DISABLED_MENU_CLASS,
          )}
        >
          <CircleStackIcon className="dark:text-dark-300 mt-0.5 size-4 shrink-0 text-gray-400" />
          <span>
            <span className="dark:text-dark-100 block text-sm text-gray-700">
              Buscar no Repositório
            </span>
            <span className="dark:text-dark-300 text-tiny mt-0.5 block text-gray-400">
              Usar um material que já está no seu Repositório como referência.
            </span>
          </span>
          {repositorioDesligado && <span className="sr-only">(em breve)</span>}
        </div>
      </Transition>
    </Menu>
  );
}
