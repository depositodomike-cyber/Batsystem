// Import Dependencies
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import {
  TableCellsIcon,
  SparklesIcon,
  PlusIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import clsx from "clsx";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { Accordion, Button, Checkbox, Spinner } from "@/components/ui";
import { ApresentacaoEtapa, type EtapaStatus } from "./ApresentacaoEtapa";
import { PlanilhaAbaCard } from "./PlanilhaAbaCard";
import { ehDragDoModo } from "./ApresentacaoSlideCard";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useAssistente } from "@/app/contexts/assistente/context";
import { NEUTRO } from "./design-system/types";
import {
  ajustarAbaApi,
  enviarFonteApi,
  gerarConteudoApi,
  gerarPlanilhaApi,
  gerarPlanoPlanilhaApi,
  FONTE_ACCEPT,
  type ConteudoPlanilha,
  type PlanoPlanilha,
  type RecursosPlanilha,
} from "@/services/api/planilha";
import { useCriacao } from "./criacoes/useCriacao";
import type { CriacaoStatus } from "@/services/api/criacoes";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { PASTA_MEMORIA } from "./memoria-pastas";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Criar planilha — tela do AI Studio (`/:produto/ia/planilha`).
//
// Segunda função-tela do Studio, e de propósito a mesma casa que "Criar
// apresentação": mesmo wizard em accordion, mesmo card de plano, mesma sticky
// bar, mesmo "Ajustar com IA".
//
// Configurar → planejar → revisar → gerar → consumir:
//   1) wizard de configuração (necessidade, fontes, preferências);
//   2) a IA devolve o PLANO — o que cada ABA vai fazer, com que colunas e que
//      cálculos, nunca os dados;
//   3) o usuário revisa, reordena, exclui e dirige por "Ajustar com IA";
//   4) aprovado o plano, a IA preenche as linhas e o construtor gera o .xlsx;
//   5) baixar e/ou salvar no Repositório.
//
// O usuário não digita a planilha: ele descreve o problema e dirige. Por isso
// não há edição manual do plano — só instrução em linguagem natural.
//
// O trabalho PERSISTE: o briefing, as fontes, o plano, os ajustes e o conteúdo
// final viram uma criação privada (ver `useCriacao`), que aparece na Home do AI
// Studio e pode ser retomada por `?criacao=<id>`. Fechar a aba não custa nada.
// ----------------------------------------------------------------------

// Classes de campo — as mesmas de `Apresentacao.tsx` (e de Insights, Documentos
// e Conectores). `dark:text-dark-100` precisa estar aqui mesmo vindo de
// `form-input`: a classe vive em `@layer components` e perde para o
// `text-gray-800` da camada utilities.
const CAMPO =
  "form-input dark:border-dark-450 dark:bg-dark-800 dark:text-dark-100 dark:placeholder:text-dark-300 dark:hover:border-dark-400 focus:border-primary-500 w-full border border-gray-300 bg-white text-sm text-gray-800 placeholder:text-gray-400 hover:border-gray-400 focus:ring-0";
// `resize-y` anula de propósito o `resize-none` que vem de `form-textarea`.
const CAMPO_TEXTAREA = `${CAMPO.replace("form-input", "form-textarea")} resize-y`;
const CAIXA_ERRO =
  "text-xs-plus dark:text-error-lighter border-error/30 bg-error/10 text-error rounded-lg border px-3 py-2";

// As sugestões de início (§8 do briefing) SAÍRAM: o campo já pede detalhe, e
// seis atalhos que só plantam meia frase competiam com o pedido de descrever
// bem. O placeholder continua mostrando o que é um bom briefing.

// "Nível de detalhamento" e "Quantidade de abas" SAÍRAM. Eram dois selects
// que nasciam em "Automático" e pediam ao usuário uma decisão de arquitetura
// que o briefing já responde — e que a IA decide melhor lendo a necessidade.
// O backend continua aceitando os dois (`detalhamento` e `nAbas`), e a
// ausência deles é lida como "você decide".

const RECURSOS: [keyof RecursosPlanilha, string][] = [
  ["formulas", "Criar fórmulas automaticamente"],
  ["filtros", "Criar filtros quando necessário"],
  ["validacoes", "Criar validações de dados quando necessário"],
  ["formatacaoCondicional", "Aplicar formatação condicional quando relevante"],
];

const RECURSOS_PADRAO: RecursosPlanilha = {
  formulas: true,
  filtros: true,
  validacoes: true,
  formatacaoCondicional: true,
};

type Step = "form" | "planejando" | "plano" | "gerando" | "pronta";

// UMA etapa. "Configurações avançadas" saiu primeiro (os recursos subiram para
// cá), e "Dados e referências" saiu depois: o anexo virou o "+" ao lado do
// rótulo, e o Repositório deixou de ser escolha — a busca acontece sozinha no
// servidor, a partir do próprio briefing.
//
// O card numerado fica: é o que mantém a tela na mesma família visual de "Criar
// apresentação", e recolhido ele vira a revisão da configuração antes de gerar.
type EtapaId = "sobre";

const ETAPAS: { id: EtapaId; numero: string; titulo: string }[] = [
  { id: "sobre", numero: "01", titulo: "Sobre a planilha" },
];

/**
 * Um arquivo anexado pelo usuário.
 *
 * O texto vem extraído por `POST planilha/fonte` e viaja no corpo — o arquivo
 * em si fica no computador de quem anexou.
 *
 * Não há mais fonte "do Repositório" aqui: as notas entram sozinhas, buscadas
 * no servidor, e nunca passam pela tela. Uma criação salva antes disso pode
 * trazer campos a mais neste objeto; o chip só lê `nome`, então ela continua
 * abrindo sem erro.
 */
interface Fonte {
  id: string;
  nome: string;
  texto?: string;
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

/** Plural simples, para o resumo do plano não dizer "1 abas". */
function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; error?: unknown };
    if (typeof o.message === "string") return o.message;
    if (Array.isArray(o.message) && typeof o.message[0] === "string") {
      return o.message[0];
    }
    if (typeof o.error === "string") return o.error;
  }
  return "Falha ao gerar. Tente novamente.";
}

export default function Planilha() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  const [step, setStep] = useState<Step>("form");
  const [erro, setErro] = useState("");
  // Validação da etapa 01, separada de `erro` (falha da API): cada erro aparece
  // onde o usuário pode resolvê-lo.
  const [erroNecessidade, setErroNecessidade] = useState("");

  // Etapa 01
  const [necessidade, setNecessidade] = useState("");
  const [nome, setNome] = useState("");
  const [recursos, setRecursos] = useState<RecursosPlanilha>(RECURSOS_PADRAO);

  // Anexos
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [enviandoFonte, setEnviandoFonte] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  /** Quantas notas do Repositório a busca automática usou no plano. */
  const [notasUsadas, setNotasUsadas] = useState(0);

  // Plano — a especificação que o usuário revisa e dirige.
  const [plano, setPlano] = useState<PlanoPlanilha | null>(null);
  const [ajustando, setAjustando] = useState<Set<string>>(new Set());
  const [errosAjuste, setErrosAjuste] = useState<Record<string, string>>({});
  /** Impactos declarados pelo último ajuste de cada aba. */
  const [impactos, setImpactos] = useState<Record<string, string[]>>({});
  /** Houve ajuste individual? É o que faz "Refazer plano" pedir confirmação. */
  const [ajustou, setAjustou] = useState(false);

  /**
   * As linhas que a IA escreveu para o plano aprovado.
   *
   * É isto que a criação guarda, e não o arquivo: o construtor é
   * determinístico, então o mesmo plano com o mesmo conteúdo remonta o mesmo
   * .xlsx, byte a byte, sem gastar IA de novo.
   */
  const [conteudoFinal, setConteudoFinal] = useState<ConteudoPlanilha | null>(
    null,
  );

  // Resultado — o arquivo fica em memória até o usuário pedir. Gerar não
  // baixa: baixar é decisão dele. `blob` é nulo numa criação RETOMADA, em que
  // o arquivo ainda não foi remontado.
  const [resultado, setResultado] = useState<{
    blob: Blob | null;
    nome: string;
    abas: number;
  } | null>(null);
  const [baixando, setBaixando] = useState(false);

  /** Trava síncrona da geração — ver `gerarPlanilha`. */
  const gerandoRef = useRef(false);

  // Confirmações
  const [aExcluir, setAExcluir] = useState<string | null>(null);
  const [confirmarRefazer, setConfirmarRefazer] = useState(false);

  const criacao = useCriacao("planilha");
  const { anunciar } = useAssistente();
  /** Ver `aiStudioGenerationChat`: o painel não abre sozinho. */
  const semChatAutomatico = isFeatureTemporarilyDisabled(
    "aiStudioGenerationChat",
  );

  // ---- Wizard ----
  const [etapaAtiva, setEtapaAtiva] = useState<EtapaId | null>("sobre");
  const [resolvidas, setResolvidas] = useState<Set<EtapaId>>(
    () => new Set<EtapaId>(),
  );
  const cardsRef = useRef<Partial<Record<EtapaId, HTMLDivElement | null>>>({});

  const semGeracao = isFeatureTemporarilyDisabled("spreadsheetGeneration");
  const planejando = step === "planejando";
  const gerando = step === "gerando";

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

  const concluirEtapa = (id: EtapaId) => {
    setResolvidas((prev) => new Set(prev).add(id));
    const prox = proximaEtapa(id);
    if (prox) irPara(prox);
    else setEtapaAtiva(null);
  };

  const statusEtapa = (id: EtapaId): EtapaStatus =>
    etapaAtiva === id ? "ativa" : resolvidas.has(id) ? "concluida" : "pendente";

  /**
   * O design que vai no pedido: sempre o NEUTRO.
   *
   * "Usar identidade visual da organização" saiu desta tela, então não há mais
   * o que escolher. Continua sendo o NEUTRO explícito, e não `undefined`:
   * `designTheme()` sem design nenhum cai na paleta âmbar da plataforma, que
   * é justamente o que "neutro" não deve ser.
   */
  const designEnviado = NEUTRO;

  const resumos: Record<EtapaId, string> = {
    sobre: [
      necessidade.trim() ? necessidade.trim().slice(0, 80) : "A definir",
      fontes.length ? plural(fontes.length, "anexo", "anexos") : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };

  const temNecessidade = !!necessidade.trim();

  // ---- Persistência ----
  // O status é DERIVADO do que está na tela: não há um segundo estado para
  // manter em dia, e por isso ele nunca discorda do que a pessoa vê.
  const statusAtual: CriacaoStatus = erro
    ? "erro"
    : step === "pronta"
      ? "concluido"
      : step === "gerando"
        ? "gerando"
        : step === "plano"
          ? "plano_pronto"
          : step === "planejando"
            ? "planejando"
            : "rascunho";

  const etapaAtual = plano
    ? step === "pronta"
      ? "resultado"
      : "plano"
    : "configuracao";

  /**
   * Já existe trabalho que valha um registro?
   *
   * Abrir a tela e olhar não cria nada. Escrever meia dúzia de palavras,
   * anexar uma fonte ou pedir um plano, sim — é aí que existe algo a perder.
   */
  const trabalhoRelevante =
    necessidade.trim().length >= 20 || fontes.length > 0 || plano !== null;

  /** O documento que vai para o banco. Só o que é preciso para retomar. */
  const montarDados = (): Record<string, unknown> => ({
    necessidade,
    nome,
    recursos,
    // O TEXTO do anexo vai junto: sem ele, retomar perderia a fonte, já que o
    // arquivo original mora no computador de quem subiu.
    fontes,
    plano,
    impactos,
    ajustou,
    notasUsadas,
    conteudoFinal,
    resultado: resultado
      ? { nome: resultado.nome, abas: resultado.abas }
      : null,
  });

  const retrato = () => ({
    relevante: trabalhoRelevante,
    titulo: (plano?.titulo || nome).trim(),
    status: statusAtual,
    etapa: etapaAtual,
    dados: montarDados(),
  });

  // Autosave com debounce. As dependências são exatamente o que a pessoa pode
  // mudar — e `retrato()` é lido no momento da gravação, não agora.
  const sincronizar = criacao.sincronizar;
  useEffect(() => {
    if (criacao.carregando) return;
    sincronizar(retrato());
    // `retrato` é recriado a cada render de propósito: o efeito é disparado
    // pelas dependências abaixo, e lê o estado fresco quando roda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sincronizar,
    criacao.carregando,
    necessidade,
    nome,
    recursos,
    fontes,
    plano,
    impactos,
    ajustou,
    notasUsadas,
    conteudoFinal,
    resultado,
    statusAtual,
    etapaAtual,
  ]);

  // ---- Retomar ----
  // Carrega uma vez, quando a criação chega do servidor. Restaura o que havia e
  // devolve a pessoa à etapa certa — sem gerar plano nenhum de novo.
  const carregada = criacao.carregada;
  useEffect(() => {
    if (!carregada) return;
    const d = (carregada.dados ?? {}) as Record<string, unknown>;
    const texto = (v: unknown, padrao = "") =>
      typeof v === "string" ? v : padrao;

    setNecessidade(texto(d.necessidade));
    setNome(texto(d.nome));
    if (d.recursos && typeof d.recursos === "object") {
      setRecursos({ ...RECURSOS_PADRAO, ...(d.recursos as RecursosPlanilha) });
    }
    if (Array.isArray(d.fontes)) setFontes(d.fontes as Fonte[]);
    if (d.impactos && typeof d.impactos === "object") {
      setImpactos(d.impactos as Record<string, string[]>);
    }
    setAjustou(Boolean(d.ajustou));
    setNotasUsadas(typeof d.notasUsadas === "number" ? d.notasUsadas : 0);

    const planoSalvo = (d.plano ?? null) as PlanoPlanilha | null;
    setPlano(planoSalvo);
    const conteudoSalvo = (d.conteudoFinal ?? null) as ConteudoPlanilha | null;
    setConteudoFinal(conteudoSalvo);

    const res = d.resultado as { nome?: string; abas?: number } | null;
    if (carregada.status === "concluido" && conteudoSalvo && planoSalvo) {
      // O arquivo não é remontado agora: só quando a pessoa pedir para baixar.
      setResultado({
        blob: null,
        nome: res?.nome || planoSalvo.titulo || "planilha",
        abas: res?.abas ?? planoSalvo.abas.length,
      });
      setStep("pronta");
    } else if (planoSalvo) {
      // "gerando" que ficou pela metade volta para a revisão do plano: a
      // geração não sobrevive ao fechamento da aba, mas o plano sim, e de lá
      // dá para tentar de novo com um clique.
      setStep("plano");
    } else {
      setStep("form");
      setEtapaAtiva("sobre");
    }
  }, [carregada]);

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

  // ---- Fontes ----
  const anexarArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviandoFonte(true);
    try {
      const r = await enviarFonteApi(arquivo);
      // Acumula, nunca substitui em silêncio (§15).
      setFontes((f) => [
        ...f,
        { id: `up-${Date.now()}-${f.length}`, nome: r.origem, texto: r.texto },
      ]);
      toast("Arquivo anexado", { description: r.origem });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setEnviandoFonte(false);
      if (arquivoRef.current) arquivoRef.current.value = ""; // permite reanexar o mesmo
    }
  };

  /** Tirar daqui não apaga o arquivo no computador. */
  const removerFonte = (id: string) =>
    setFontes((f) => f.filter((x) => x.id !== id));

  // ---- Configuração → plano ----
  // A primeira geração NÃO produz arquivo: produz a especificação que o usuário
  // revisa. É o que tira o usuário do papel de executor técnico.
  const gerarPlano = async () => {
    setErro("");
    if (!necessidade.trim()) {
      setErroNecessidade("Descreva o que você quer criar.");
      irPara("sobre");
      return;
    }
    setStep("planejando");
    try {
      const { plano: novo, fontes: usadas } = await gerarPlanoPlanilhaApi({
        necessidade: necessidade.trim(),
        nome: nome.trim(),
        recursos,
        referencia: referenciaDosAnexos(),
        design: designEnviado,
      });
      setPlano(novo);
      setErrosAjuste({});
      setImpactos({});
      setAjustou(false);
      setResultado(null);
      setConteudoFinal(null);
      setStep("plano");
      // Marco: o plano é trabalho que vale por si, com ou sem arquivo depois.
      void criacao.gravarAgora({
        relevante: true,
        titulo: (novo.titulo || nome).trim(),
        status: "plano_pronto",
        etapa: "plano",
        dados: {
          necessidade,
          nome,
          recursos,
          fontes,
          plano: novo,
          impactos: {},
          ajustou: false,
          notasUsadas: usadas.notas.length,
          conteudoFinal: null,
          resultado: null,
        },
      });

      // Quantas notas do Repositório a busca automática achou e usou. Vira uma
      // linha discreta na tela do plano — é lá que a informação é verdadeira.
      setNotasUsadas(usadas.notas.length);

      if (!semChatAutomatico) {
        anunciar({
          titulo: "Criar planilha · plano pronto",
          corpo: resumoParaAssistente(novo, usadas.notas.length),
        });
      }
    } catch (err) {
      setErro(errMessage(err));
      setStep("form");
    }
  };

  // ---- Ajuste de uma aba por instrução ----
  // Só a aba pedida muda. O plano anterior dela fica intacto até a resposta
  // chegar, e continua lá se a chamada falhar.
  const ajustarAba = async (indice: number, instrucao: string) => {
    if (!plano) return;
    const alvo = plano.abas[indice];
    if (!alvo) return;
    setAjustando((s) => new Set(s).add(alvo.id));
    setErrosAjuste((e) => {
      if (!(alvo.id in e)) return e;
      const resto = { ...e };
      delete resto[alvo.id];
      return resto;
    });
    try {
      const { aba, impactos: novos } = await ajustarAbaApi({
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
              abas: p.abas.map((a) =>
                a.id === alvo.id ? { ...aba, id: alvo.id } : a,
              ),
            }
          : p,
      );
      setImpactos((i) => ({ ...i, [alvo.id]: novos }));
      setAjustou(true);
    } catch (err) {
      setErrosAjuste((e) => ({
        ...e,
        [alvo.id]: `Não foi possível ajustar esta aba. ${errMessage(err)}`,
      }));
    } finally {
      setAjustando((s) => {
        const next = new Set(s);
        next.delete(alvo.id);
        return next;
      });
    }
  };

  /**
   * Quem depende da aba — pelo NOME, que é como o plano declara dependência.
   * Vazio = excluir não quebra nada, e a confirmação nem aparece.
   */
  const dependentesDe = (id: string): string[] => {
    const alvo = plano?.abas.find((a) => a.id === id);
    if (!alvo || !plano) return [];
    const nomeAlvo = alvo.nome.trim().toLowerCase();
    if (!nomeAlvo) return [];
    return plano.abas
      .filter(
        (a) =>
          a.id !== id &&
          (a.dependencias ?? []).some(
            (d) => d.trim().toLowerCase() === nomeAlvo,
          ),
      )
      .map((a) => a.nome);
  };

  const excluirAba = (id: string) => {
    setPlano((p) =>
      p ? { ...p, abas: p.abas.filter((a) => a.id !== id) } : p,
    );
    setAExcluir(null);
  };

  /** Excluir pede confirmação só quando outra aba puxa dados desta (§42). */
  const pedirExclusao = (id: string) => {
    if (dependentesDe(id).length) setAExcluir(id);
    else excluirAba(id);
  };

  // ---- Plano → arquivo ----
  // A IA preenche as linhas a partir do plano aprovado e das MESMAS fontes; o
  // construtor determinístico monta o .xlsx. Nada baixa aqui.
  const gerarPlanilha = async () => {
    // Guarda de reentrada numa REF, e não no `step`: dois cliques no mesmo tick
    // rodam os dois com o `step` que o render capturou ("plano"), e sairiam dois
    // arquivos e duas chamadas de IA. O `disabled` do botão também não cobre
    // esse caso — ele só vale depois do próximo render.
    if (!plano || gerandoRef.current) return;
    gerandoRef.current = true;
    setErro("");
    setStep("gerando");
    try {
      // Duas chamadas, e não uma: a primeira é a IA escrevendo as linhas, e o
      // resultado dela precisa voltar para cá porque é o que a criação guarda.
      // A segunda é só construção.
      const conteudo = await gerarConteudoApi({
        plano,
        referencia: referenciaDosAnexos(),
      });
      const blob = await gerarPlanilhaApi({
        plano,
        conteudo,
        recursos,
        design: designEnviado,
      });
      const nomeArquivo = nomeDoArquivo();
      const pronto = {
        blob,
        nome: nomeArquivo,
        abas: plano.abas.length,
      };
      setConteudoFinal(conteudo);
      setResultado(pronto);
      setStep("pronta");
      // Marco: grava na hora. Quem fecha a aba no segundo seguinte espera
      // encontrar "Concluído" na Home, não "Gerando".
      void criacao.gravarAgora({
        relevante: true,
        titulo: (plano.titulo || nome).trim(),
        status: "concluido",
        etapa: "resultado",
        dados: {
          necessidade,
          nome,
          recursos,
          fontes,
          plano,
          impactos,
          ajustou,
          notasUsadas,
          conteudoFinal: conteudo,
          resultado: { nome: pronto.nome, abas: pronto.abas },
        },
      });
      if (semChatAutomatico) return;
      anunciar({
        titulo: "Criar planilha · planilha gerada",
        corpo: `**${plano.titulo}** está pronta — ${plural(plano.abas.length, "aba", "abas")} em .xlsx. Baixe ou salve no Repositório na tela.`,
      });
    } catch (err) {
      // O plano e os ajustes continuam de pé: dá para tentar de novo sem
      // refazer nada.
      setErro(errMessage(err));
      setStep("plano");
    } finally {
      gerandoRef.current = false;
    }
  };

  /** Nome do arquivo, saneado. O mesmo em toda geração desta criação. */
  const nomeDoArquivo = (): string =>
    (nome.trim() || plano?.titulo || "planilha")
      .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
      .trim()
      .slice(0, 60) || "planilha";

  /** O texto dos anexos, que viaja no corpo (a nota do Repositório vai por path). */
  const referenciaDosAnexos = (): string =>
    fontes
      .map((f) => f.texto)
      .filter(Boolean)
      .join("\n\n");

  /**
   * O arquivo em mãos.
   *
   * Numa criação RETOMADA o blob não existe: o que foi guardado é o conteúdo.
   * Aqui ele é remontado — sem IA, porque o construtor é determinístico e
   * recebe exatamente o mesmo plano e o mesmo conteúdo de antes.
   */
  const obterBlob = async (): Promise<Blob | null> => {
    if (resultado?.blob) return resultado.blob;
    if (!plano || !conteudoFinal) return null;
    const blob = await gerarPlanilhaApi({
      plano,
      conteudo: conteudoFinal,
      recursos,
      design: designEnviado,
    });
    setResultado((r) => (r ? { ...r, blob } : r));
    return blob;
  };

  const baixarArquivo = async () => {
    if (!resultado || baixando) return;
    setBaixando(true);
    try {
      const blob = await obterBlob();
      if (!blob) {
        toast.error("Não foi possível montar o arquivo desta criação.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resultado.nome}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Download iniciado", { description: `${resultado.nome}.xlsx` });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBaixando(false);
    }
  };

  /**
   * A nota do Repositório: o plano em Markdown, com o .xlsx anexado.
   *
   * Um artefato só — plano e arquivo pertencem à mesma coisa, e separá-los em
   * dois itens faria o Repositório guardar metade de uma planilha em cada.
   */
  const prepararMemoria = async () => {
    if (!resultado || !plano) return { conteudo: "" };
    const blob = await obterBlob();
    const corpo = plano.abas
      .map((a, i) => {
        const partes = [`## ${i + 1}. ${a.nome}`, "", a.objetivo, ""];
        if (a.colunas.length) {
          partes.push(
            "**Colunas**",
            ...a.colunas.map((c) => `- ${c.nome} (${c.tipo})`),
            "",
          );
        }
        for (const [rotulo, lista] of [
          ["Cálculos", a.calculos],
          ["Indicadores", a.indicadores],
        ] as const) {
          if (lista.length) {
            partes.push(
              `**${rotulo}**`,
              ...lista.map((c) => `- ${c.nome}: ${c.logica}`),
              "",
            );
          }
        }
        if (a.dependencias.length) {
          partes.push(`**Depende de:** ${a.dependencias.join(", ")}`, "");
        }
        if (a.dadosExemplo) {
          partes.push("> Esta aba traz dados de exemplo, não dados reais.", "");
        }
        return partes.join("\n");
      })
      .join("\n");
    const cabecalho = plano.objetivo ? `*${plano.objetivo}*\n\n` : "";
    const rodape = plano.limitacoes.length
      ? `\n## O que as fontes não cobrem\n\n${plano.limitacoes.map((l) => `- ${l}`).join("\n")}\n`
      : "";
    return {
      conteudo: cabecalho + corpo + rodape,
      anexos: blob ? [{ nome: `${resultado.nome}.xlsx`, dados: blob }] : [],
    };
  };

  /** "Refazer plano": regenera a estrutura inteira a partir da configuração. */
  const refazerPlano = () => {
    setConfirmarRefazer(false);
    void gerarPlano();
  };

  const voltarAConfiguracao = () => {
    setErro("");
    setStep("form");
    setEtapaAtiva("sobre");
    irPara("sobre");
  };

  // ---- Reordenação ----
  const mover = (de: number, para: number) =>
    setPlano((p) => (p ? { ...p, abas: reposicionar(p.abas, de, para) } : p));

  // A lista inteira fica numa ref para o monitor não ser reassinado a cada
  // renderização.
  const itensRef = useRef<{ id: string }[]>([]);
  itensRef.current = plano?.abas ?? [];

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => ehDragDoModo(source.data, "aba"),
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
    // `mover` só usa o setter do estado, que é estável, então o monitor é
    // assinado uma vez e não reage a re-render.
    [],
  );

  const totalCalculos =
    plano?.abas.reduce((n, a) => n + (a.calculos?.length ?? 0), 0) ?? 0;
  const totalIndicadores =
    plano?.abas.reduce((n, a) => n + (a.indicadores?.length ?? 0), 0) ?? 0;

  // Só o que existe entra no resumo — nada de "0 indicadores" (§29).
  const resumoPlano = plano
    ? [
        plural(plano.abas.length, "aba", "abas"),
        totalCalculos ? plural(totalCalculos, "cálculo", "cálculos") : "",
        totalIndicadores
          ? plural(totalIndicadores, "indicador", "indicadores")
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Page title={`Criar planilha · ${product.name}`}>
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

            <div className="mb-8 flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-green-500/10 text-green-500">
                <TableCellsIcon className="size-5 stroke-[1.5]" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <PageTitle
                    help={{
                      description: (
                        <>
                          <p>
                            Você descreve o problema em português. A IA monta um{" "}
                            <strong>plano</strong>: que abas existem, que
                            colunas cada uma tem e que contas ela faz — antes de
                            existir arquivo nenhum.
                          </p>
                          <p>
                            Os cálculos aparecem primeiro como lógica de negócio
                            (“Saldo = Orçamento − Realizado”). A fórmula de
                            planilha fica em <strong>Ver detalhes</strong>, para
                            quem quiser conferir. Você não precisa saber Excel
                            para validar o plano.
                          </p>
                          <p>
                            Para mudar uma aba, use{" "}
                            <strong>Ajustar com IA</strong> e diga o que quer.
                            Reordenar e excluir continuam na sua mão.
                          </p>
                        </>
                      ),
                    }}
                  >
                    Criar planilha
                  </PageTitle>
                  {step === "plano" && (
                    <span className="dark:bg-dark-600 dark:text-dark-200 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                      Revisar o plano
                    </span>
                  )}
                </div>
                <p className="dark:text-dark-300 text-sm text-gray-500">
                  A IA planeja a estrutura, você revisa e dirige, e a IA
                  constrói.
                </p>
              </div>
            </div>

            {/* Etapa 1 — wizard de configuração. */}
            {step === "form" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void gerarPlano();
                }}
              >
                <Accordion
                  value={etapaAtiva ?? ""}
                  onChange={(v) => setEtapaAtiva((v as EtapaId) || null)}
                  className="flex flex-col gap-3"
                >
                  {/* 01 — o que se quer resolver */}
                  <ApresentacaoEtapa {...etapa("sobre")}>
                    {/* O "+" na linha do rótulo, alinhado à direita — o mesmo
                        lugar que ele ocupa em "Criar apresentação". */}
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <PerguntaEtapa className="">
                        O que você quer criar?
                      </PerguntaEtapa>
                      <MenuAdicionarDados
                        ocupado={enviandoFonte}
                        onUpload={() => arquivoRef.current?.click()}
                      />
                    </div>

                    {/* Fora do <label> do campo: um input de arquivo escondido
                        dentro dele seria acionado ao clicar no texto. */}
                    <input
                      ref={arquivoRef}
                      type="file"
                      accept={FONTE_ACCEPT}
                      hidden
                      onChange={(e) => void anexarArquivo(e.target.files?.[0])}
                    />

                    <MemoriaTextarea
                      value={necessidade}
                      onChange={(e) => {
                        setNecessidade(e.target.value);
                        if (erroNecessidade) setErroNecessidade("");
                      }}
                      rows={5}
                      placeholder="Ex.: Crie uma planilha para acompanhar o orçamento anual das áreas, comparando planejado e realizado, com indicadores e uma visão executiva."
                      className={CAMPO_TEXTAREA}
                    />
                    {erroNecessidade ? (
                      <p className="text-error mt-2 text-sm">
                        {erroNecessidade}
                      </p>
                    ) : (
                      <p className="dark:text-dark-300 text-xs-plus mt-2 text-gray-500">
                        Descreva com o máximo de detalhes o que você precisa. A
                        IA usará essas informações para definir a estrutura, os
                        dados, cálculos e análises da sua planilha.
                      </p>
                    )}

                    {fontes.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-2">
                        {fontes.map((f) => (
                          <li
                            key={f.id}
                            className="dark:border-dark-600 dark:bg-dark-800/40 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2"
                          >
                            <PaperClipIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
                            <span className="dark:text-dark-100 text-xs-plus min-w-0 flex-1 truncate text-gray-700">
                              {f.nome}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerFonte(f.id)}
                              aria-label={`Remover ${f.nome}`}
                              className="dark:text-dark-300 dark:hover:text-dark-100 grid size-6 shrink-0 place-items-center rounded-lg text-gray-400 hover:text-gray-700"
                            >
                              <XMarkIcon className="size-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <label className="mt-5 block">
                      <span className="dark:text-dark-200 mb-1 block text-sm font-medium text-gray-600">
                        Nome da planilha{" "}
                        <span className="dark:text-dark-300 font-normal text-gray-400">
                          (opcional)
                        </span>
                      </span>
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Ex.: Planejamento orçamentário 2027"
                        className={CAMPO}
                      />
                      <span className="dark:text-dark-300 text-xs-plus mt-1 block text-gray-500">
                        Em branco, a IA sugere um nome a partir do que você
                        descreveu.
                      </span>
                    </label>

                    {/* Recursos aqui, e não numa etapa de configuração: são
                        preferências sobre o que a planilha vai ter, da mesma
                        natureza do que o campo acima descreve. A frase de
                        rodapé fica DEPOIS das caixas porque ela explica o
                        limite delas — só faz sentido depois de lidas. */}
                    <div className="mt-5">
                      <span className="dark:text-dark-200 mb-2 block text-sm font-medium text-gray-600">
                        Recursos da planilha
                      </span>
                      <div className="flex flex-col gap-2.5">
                        {RECURSOS.map(([chave, label]) => (
                          <label
                            key={chave}
                            className="flex cursor-pointer items-center gap-2.5 text-sm"
                          >
                            <Checkbox
                              checked={recursos[chave]}
                              onChange={(e) =>
                                setRecursos((r) => ({
                                  ...r,
                                  [chave]: e.target.checked,
                                }))
                              }
                            />
                            <span className="dark:text-dark-200 text-gray-600">
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="dark:text-dark-300 text-xs-plus mt-2 text-gray-500">
                        São preferências: onde aplicar cada recurso continua
                        sendo decisão da IA.
                      </p>
                    </div>

                    <AcoesEtapa
                      rotulo="Concluir"
                      onContinuar={() => {
                        if (!necessidade.trim()) {
                          setErroNecessidade("Descreva o que você quer criar.");
                          return;
                        }
                        setErroNecessidade("");
                        concluirEtapa("sobre");
                      }}
                    />
                  </ApresentacaoEtapa>
                </Accordion>

                {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="dark:text-dark-300 text-sm text-gray-500">
                    {!temNecessidade
                      ? "Descreva sua planilha para continuar."
                      : plano
                        ? "Planejar de novo substitui o plano atual e os ajustes feitos nele."
                        : "É só isto. A IA decide o resto."}
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
                    <Button
                      type="submit"
                      color="primary"
                      disabled={!temNecessidade}
                      className="h-10 gap-2 px-5"
                    >
                      <SparklesIcon className="size-5" />
                      Gerar plano
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Loading. Indeterminado de propósito: o servidor não informa
                progresso, e inventar "8 de 12" seria encenação. */}
            {(planejando || gerando) && (
              <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <div
                  aria-live="polite"
                  className="grid place-items-center py-10"
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Spinner className="size-6" />
                    <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
                      {planejando
                        ? "Planejando sua planilha…"
                        : "Construindo sua planilha…"}
                    </p>
                    <p className="dark:text-dark-300 text-sm text-gray-500">
                      {planejando
                        ? "A IA está definindo as abas, as colunas e os cálculos."
                        : "Estamos preenchendo as abas e aplicando os cálculos."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Etapa 2 — revisar o plano */}
            {step === "plano" && plano && (
              <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
                      {plano.titulo}
                    </h3>
                    {plano.objetivo && (
                      <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
                        {plano.objetivo}
                      </p>
                    )}
                    <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
                      {resumoPlano}
                    </p>
                    {/* O Repositório é dito AQUI, e não na configuração:
                        anunciar antes de gerar seria promessa; depois, é fato. */}
                    {notasUsadas > 0 && (
                      <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
                        Baseado em {plural(notasUsadas, "nota", "notas")} do seu
                        Repositório.
                      </p>
                    )}
                  </div>

                  {plano.limitacoes.length > 0 && (
                    <div className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 p-3">
                      <span className="dark:text-dark-300 text-tiny-plus mb-1 block font-medium tracking-wider text-gray-500 uppercase">
                        O que as fontes não cobrem
                      </span>
                      <ul className="dark:text-dark-200 list-disc space-y-1 ps-4 text-sm text-gray-600 marker:text-gray-300">
                        {plano.limitacoes.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <span className="dark:text-dark-300 text-tiny-plus font-medium tracking-wider text-gray-500 uppercase">
                    Plano da planilha
                  </span>

                  {plano.abas.map((a, i) => (
                    <PlanilhaAbaCard
                      key={a.id}
                      aba={a}
                      indice={i}
                      total={plano.abas.length}
                      ajustando={ajustando.has(a.id)}
                      erro={errosAjuste[a.id]}
                      impactos={impactos[a.id]}
                      campoTextarea={CAMPO_TEXTAREA}
                      onAjustar={(instrucao) => void ajustarAba(i, instrucao)}
                      onRemover={() => pedirExclusao(a.id)}
                      onMover={mover}
                    />
                  ))}

                  {erro && <div className={CAIXA_ERRO}>{erro}</div>}

                  <div className="dark:border-dark-600 dark:bg-dark-700 sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-white px-6 pt-3 pb-1 sm:-mx-8 sm:px-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="flat"
                        onClick={voltarAConfiguracao}
                        className="gap-1.5"
                      >
                        <ArrowLeftIcon className="size-4" />
                        Voltar à configuração
                      </Button>
                      <Button
                        variant="flat"
                        onClick={() =>
                          ajustou ? setConfirmarRefazer(true) : refazerPlano()
                        }
                        className="gap-1.5"
                      >
                        <ArrowPathIcon className="size-4" />
                        Refazer plano
                      </Button>
                    </div>
                    {/* Fase 2. Visível e sem clique é o padrão da casa para o
                        que está a caminho — ver temporarilyDisabledFeatures. */}
                    <Button
                      color="primary"
                      onClick={() => void gerarPlanilha()}
                      disabled={semGeracao || gerando || !plano.abas.length}
                      title={
                        semGeracao
                          ? "A geração do arquivo chega na próxima etapa."
                          : undefined
                      }
                      className={clsx(
                        "h-10 gap-2 px-5",
                        semGeracao && "cursor-not-allowed",
                      )}
                    >
                      <SparklesIcon className="size-5" />
                      Gerar planilha
                      {semGeracao && (
                        <span className="sr-only">(em breve)</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Etapa 3 — planilha pronta */}
            {step === "pronta" && resultado && plano && (
              <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <span className="bg-primary-500 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-slate-900">
                    <CheckIcon className="size-4" strokeWidth="2.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
                      Planilha pronta
                    </h3>
                    <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
                      {plano.titulo}
                    </p>
                    <p className="dark:text-dark-300 mt-2 text-sm text-gray-500">
                      {plural(resultado.abas, "aba", "abas")} · XLSX
                    </p>

                    {/* O que o arquivo NÃO tem, dito aqui e não descoberto ao
                        abrir: exemplo é exemplo, e falta é falta. */}
                    {(plano.abas.some((a) => a.dadosExemplo) ||
                      plano.limitacoes.length > 0) && (
                      <div className="dark:border-dark-600 dark:bg-dark-800/40 mt-4 rounded-xl border border-gray-200 p-3">
                        <span className="dark:text-dark-300 text-tiny-plus mb-1 block font-medium tracking-wider text-gray-500 uppercase">
                          Antes de usar
                        </span>
                        <ul className="dark:text-dark-200 list-disc space-y-1 ps-4 text-sm text-gray-600 marker:text-gray-300">
                          {plano.abas.some((a) => a.dadosExemplo) && (
                            <li>
                              Algumas abas trazem dados de exemplo, marcados
                              como exemplo no próprio arquivo — nenhum valor
                              deles é real.
                            </li>
                          )}
                          {plano.limitacoes.map((l, i) => (
                            <li key={i}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <SalvarNaMemoriaButton
                        pasta={PASTA_MEMORIA.planilha}
                        titulo={plano.titulo || "Planilha"}
                        tags={["planilha"]}
                        versao={resultado.nome}
                        preparar={prepararMemoria}
                        rotulo="Salvar no Repositório"
                        rotuloSalvo="Salvo no Repositório"
                        // Sem seletor de pasta: nesta tela o destino é evidente
                        // (Planilhas), e a seta só competiria com o CTA.
                        semSeletorDePasta
                        className="h-10 px-5"
                      />
                      <Button
                        color="primary"
                        onClick={() => void baixarArquivo()}
                        disabled={baixando}
                        className="h-10 gap-2 px-5"
                      >
                        {baixando ? (
                          <Spinner className="size-5" />
                        ) : (
                          <ArrowDownTrayIcon className="size-5" />
                        )}
                        Baixar .xlsx
                      </Button>
                      <Button
                        variant="flat"
                        onClick={() => setStep("plano")}
                        className="h-10 gap-1.5"
                      >
                        <ArrowLeftIcon className="size-4" />
                        Voltar ao plano
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        show={aExcluir != null}
        onClose={() => setAExcluir(null)}
        onOk={() => aExcluir && excluirAba(aExcluir)}
        state="pending"
        messages={{
          pending: {
            title: "Excluir esta aba?",
            description: `${dependentesDe(aExcluir ?? "").join(", ")} ${
              dependentesDe(aExcluir ?? "").length === 1
                ? "usa os dados desta aba e ficará"
                : "usam os dados desta aba e ficarão"
            } sem essa fonte.`,
            actionText: "Excluir aba",
          },
        }}
      />

      <ConfirmModal
        show={confirmarRefazer}
        onClose={() => setConfirmarRefazer(false)}
        onOk={refazerPlano}
        state="pending"
        messages={{
          pending: {
            title: "Refazer o plano?",
            description:
              "Refazer o plano substituirá os ajustes realizados até agora.",
            actionText: "Refazer plano",
          },
        }}
      />
    </Page>
  );
}

/** Markdown do aviso publicado no assistente quando o plano fica pronto. */
function resumoParaAssistente(plano: PlanoPlanilha, notas: number): string {
  const linhas: string[] = [
    `Planejei **${plano.titulo}** — ${plural(plano.abas.length, "aba", "abas")}.`,
    "",
    "**Abas**",
    ...plano.abas.map((a, i) => `${i + 1}. ${a.nome} — ${a.objetivo}`),
  ];
  if (notas) {
    linhas.push(
      `**Fontes do Repositório:** ${plural(notas, "nota usada", "notas usadas")}.`,
    );
  }
  if (plano.limitacoes.length) {
    linhas.push("", "**O que as fontes não cobrem**");
    linhas.push(...plano.limitacoes.map((l) => `- ${l}`));
  }
  linhas.push("", "Revise o plano na tela e ajuste as abas antes de gerar.");
  return linhas.join("\n");
}

// `SeletorDoRepositorio` saiu daqui. A escolha manual de notas deixou de
// existir: o Repositório entra sozinho em toda geração, buscado no servidor
// a partir do briefing. Oferecer um seletor E buscar sozinho deixaria a
// pessoa sem saber se escolher muda alguma coisa.

/** O "+" do step 02: por onde entram dados que não estão no Repositório. */
function MenuAdicionarDados({
  ocupado,
  onUpload,
}: {
  ocupado: boolean;
  onUpload: () => void;
}) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        disabled={ocupado}
        aria-label="Adicionar dados"
        title="Adicionar dados"
        className="dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600 grid size-8 place-items-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ocupado ? (
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
                  Fazer upload
                </span>
                <span className="dark:text-dark-300 text-tiny mt-0.5 block text-gray-400">
                  Um .csv, .docx ou PDF com os dados que a IA deve considerar.
                </span>
              </span>
            </button>
          )}
        </MenuItem>
      </Transition>
    </Menu>
  );
}

/** A pergunta que abre uma etapa do wizard — o que o usuário está decidindo. */
function PerguntaEtapa({
  children,
  className = "mb-3",
}: {
  children: React.ReactNode;
  /** `""` quando a pergunta divide a linha com outro controle — aí o
      espaçamento é do contêiner. */
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

/** Rodapé de uma etapa. */
function AcoesEtapa({
  onContinuar,
  rotulo = "Continuar",
}: {
  onContinuar: () => void;
  rotulo?: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      {/* `type="button"` obrigatório: dentro de um <form>, o default é submit. */}
      <Button
        type="button"
        color="primary"
        onClick={onContinuar}
        className="h-9 gap-1.5"
      >
        {rotulo}
      </Button>
    </div>
  );
}
