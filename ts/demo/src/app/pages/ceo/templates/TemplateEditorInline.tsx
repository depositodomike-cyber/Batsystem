// Import Dependencies
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  CheckIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { toast } from "sonner";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import {
  analisarTemplateApi,
  atualizarTemplateApi,
  baixarArquivoTemplateApi,
  criarTemplateApi,
  fetchTemplateApi,
  LIMITE_TEMPLATE_BYTES,
  TEMPLATE_ACCEPT,
  trocarArquivoTemplateApi,
  type FormatoTemplate,
  type TemplateCompleto,
  type TemplateEstrutura,
} from "@/services/api/templates";
import { RotuloCampo } from "../RotuloCampo";
import { ToggleRow } from "../configuracoes-ui";
import { TemplatePreviaGrade } from "./TemplatePrevia";
import { formatarTamanho, mensagemDeErro, ROTULO_FORMATO } from "./useTemplates";

// ----------------------------------------------------------------------
// Cadastro, edição e visualização de um template — DENTRO de Configurações,
// no lugar da tabela (mesmo padrão de `MarcaEditorInline`).
//
// O arquivo escolhido é processado na hora por `/analisar`, que NÃO grava:
// o status que a tela mostra é o real (enviando → processando → pronto/erro),
// a prévia vem do resultado de verdade, e desistir não deixa lixo no banco.
// O "Salvar" só habilita com nome + arquivo processado com sucesso.
// ----------------------------------------------------------------------

const CAMPO =
  "form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-dark-300";
const CAMPO_TEXTAREA = `${CAMPO.replace("form-input", "form-textarea")} resize-y leading-relaxed`;

type StatusArquivo =
  | { fase: "enviando"; progresso: number }
  | { fase: "processando" }
  | { fase: "pronto"; formato: FormatoTemplate; estrutura: TemplateEstrutura }
  | { fase: "erro"; mensagem: string };

const EXTENSOES = /\.(pptx|html?|zip)$/i;

function formatoDoNome(nome: string): string {
  if (/\.pptx$/i.test(nome)) return "PowerPoint";
  if (/\.zip$/i.test(nome)) return "HTML (pacote .zip)";
  return "HTML";
}

export function TemplateEditorInline({
  templateId,
  somenteLeitura,
  onVoltar,
  onSalvo,
  onExcluir,
}: {
  /** null = novo template. */
  templateId: string | null;
  /** Visualizar, ou role sem `configuracoes.gerenciar`. */
  somenteLeitura: boolean;
  onVoltar: () => void;
  onSalvo: (t: TemplateCompleto) => void;
  onExcluir?: (t: TemplateCompleto) => void;
}) {
  const novo = templateId === null;
  const [original, setOriginal] = useState<TemplateCompleto | null>(null);
  const [carregando, setCarregando] = useState(!novo);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contexto, setContexto] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusArquivo | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [tocouNome, setTocouNome] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  // Só a análise mais recente vale: trocar o arquivo no meio do processamento
  // não pode deixar a resposta antiga sobrescrever a nova.
  const analiseAtual = useRef(0);

  useEffect(() => {
    if (novo) return;
    // O componente é montado com `key` = id, então `carregando` já nasce true.
    let vivo = true;
    fetchTemplateApi(templateId)
      .then((t) => {
        if (!vivo) return;
        setOriginal(t);
        setNome(t.nome);
        setDescricao(t.descricao ?? "");
        setContexto(t.contexto ?? "");
        setAtivo(t.ativo);
      })
      .catch((e) => vivo && setErroCarga(mensagemDeErro(e, "Template não encontrado.")))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [novo, templateId]);

  const escolher = (f: File | undefined) => {
    if (!f || somenteLeitura) return;
    setArquivo(f);
    if (!EXTENSOES.test(f.name)) {
      setStatus({
        fase: "erro",
        mensagem: "Formato não suportado. Envie um arquivo .pptx, .html ou .zip (HTML com recursos).",
      });
      return;
    }
    if (f.size > LIMITE_TEMPLATE_BYTES) {
      setStatus({ fase: "erro", mensagem: "O arquivo passa do limite de 4 MB." });
      return;
    }
    if (f.size === 0) {
      setStatus({ fase: "erro", mensagem: "O arquivo está vazio." });
      return;
    }
    const minha = ++analiseAtual.current;
    setStatus({ fase: "enviando", progresso: 0 });
    analisarTemplateApi(f, (p) => {
      if (analiseAtual.current !== minha) return;
      // Upload completo: daqui em diante quem trabalha é o servidor.
      setStatus(p >= 1 ? { fase: "processando" } : { fase: "enviando", progresso: p });
    })
      .then((r) => {
        if (analiseAtual.current !== minha) return;
        setStatus({ fase: "pronto", formato: r.formato, estrutura: r.estrutura });
      })
      .catch((e) => {
        if (analiseAtual.current !== minha) return;
        setStatus({
          fase: "erro",
          mensagem: mensagemDeErro(e, "Verifique se o arquivo abre normalmente e tente de novo."),
        });
      });
  };

  const descartarArquivo = () => {
    analiseAtual.current++;
    setArquivo(null);
    setStatus(null);
  };

  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    escolher(e.dataTransfer.files[0]);
  };

  const metaMudou =
    !!original &&
    (nome.trim() !== original.nome ||
      descricao.trim() !== (original.descricao ?? "") ||
      contexto.trim() !== (original.contexto ?? "") ||
      ativo !== original.ativo);
  const sujo = novo ? !!(nome.trim() || descricao.trim() || contexto.trim() || arquivo) : metaMudou || !!arquivo;

  const nomeValido = nome.trim().length > 0;
  const arquivoOk = arquivo ? status?.fase === "pronto" : !novo;
  const podeSalvar = nomeValido && arquivoOk && sujo && !salvando;

  const voltar = () => {
    if (
      !somenteLeitura &&
      sujo &&
      !window.confirm("Há alterações não salvas neste template. Sair mesmo assim?")
    ) {
      return;
    }
    onVoltar();
  };

  const salvar = async () => {
    setTocouNome(true);
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const meta = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        contexto: contexto.trim(),
      };
      let salvo: TemplateCompleto;
      if (novo) {
        salvo = await criarTemplateApi(meta, arquivo!);
        if (!ativo) salvo = await atualizarTemplateApi(salvo.id, { ativo: false });
      } else {
        salvo = original!;
        // Arquivo primeiro: se falhar, nada mais muda e o anterior continua.
        if (arquivo) salvo = await trocarArquivoTemplateApi(salvo.id, arquivo);
        if (metaMudou) salvo = await atualizarTemplateApi(salvo.id, { ...meta, ativo });
      }
      toast.success(novo ? "Template adicionado" : "Template atualizado");
      onSalvo(salvo);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar o template."));
    } finally {
      setSalvando(false);
    }
  };

  const baixar = async () => {
    if (!original) return;
    setBaixando(true);
    try {
      const blob = await baixarArquivoTemplateApi(original.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = original.arquivoNome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível baixar o arquivo."));
    } finally {
      setBaixando(false);
    }
  };

  if (carregando) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner color="primary" className="size-8" />
      </div>
    );
  }

  if (erroCarga) {
    return (
      <div>
        <Cabecalho titulo="Template" onVoltar={onVoltar} />
        <p className="text-xs-plus dark:text-error-lighter border-error/30 bg-error/10 text-error rounded-lg border px-3 py-2">
          {erroCarga}
        </p>
      </div>
    );
  }

  const estruturaExibida =
    status?.fase === "pronto" ? status.estrutura : arquivo ? null : original?.estrutura ?? null;

  // ------------------------------------------------------------ só leitura
  if (somenteLeitura && original) {
    return (
      <div>
        <Cabecalho titulo={original.nome} onVoltar={onVoltar} />
        <dl className="dark:text-dark-200 mb-5 grid gap-x-6 gap-y-3 text-sm text-gray-600 sm:grid-cols-2">
          <Info rotulo="Descrição" valor={original.descricao} />
          <Info rotulo="Contexto de uso" valor={original.contexto} />
          <Info
            rotulo="Arquivo"
            valor={`${original.arquivoNome} · ${ROTULO_FORMATO[original.formato]} · ${formatarTamanho(original.arquivoTamanho)}`}
          />
          <Info
            rotulo="Status"
            valor={`${original.ativo ? "Ativo" : "Inativo"} · versão ${original.versao}`}
          />
        </dl>
        <Button
          variant="outlined"
          onClick={() => void baixar()}
          disabled={baixando}
          className="mb-5 h-8 gap-1.5 px-2.5 text-xs-plus"
        >
          {baixando ? <Spinner className="size-4" /> : <ArrowDownTrayIcon className="size-4" />}
          Baixar arquivo original
        </Button>
        <TemplatePreviaGrade estrutura={original.estrutura} />
      </div>
    );
  }

  // ------------------------------------------------------------ formulário
  return (
    <div>
      <Cabecalho
        titulo={novo ? "Novo template" : original?.nome || "Template"}
        onVoltar={voltar}
        sujo={sujo}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <RotuloCampo rotulo="Nome do template" />
          <input
            className={clsx(CAMPO, tocouNome && !nomeValido && "border-error dark:border-error")}
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => setTocouNome(true)}
            placeholder="Ex.: Apresentação de resultados trimestrais"
            aria-invalid={tocouNome && !nomeValido}
          />
          {tocouNome && !nomeValido && (
            <span className="text-error mt-1 block text-xs">Informe o nome do template.</span>
          )}
        </label>
        <label className="block">
          <RotuloCampo
            rotulo="Contexto de uso"
            opcional
            ajuda="Em que situação este template costuma ser usado. Ex.: reunião de board, proposta comercial."
          />
          <input
            className={CAMPO}
            value={contexto}
            maxLength={120}
            onChange={(e) => setContexto(e.target.value)}
            placeholder="Ex.: Reunião de board"
          />
        </label>
        <label className="block lg:col-span-2">
          <RotuloCampo rotulo="Descrição" opcional />
          <textarea
            className={CAMPO_TEXTAREA}
            rows={2}
            value={descricao}
            maxLength={500}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Para que serve este template e quando usá-lo."
          />
        </label>
      </div>

      {/* ---- Arquivo de referência ---- */}
      <div className="mt-5">
        <RotuloCampo
          rotulo="Arquivo de referência"
          ajuda="PowerPoint (.pptx) ou HTML (.html). Se o HTML depende de imagens ou fontes, envie um .zip com o HTML e os recursos. Até 4 MB."
        />
        <input
          ref={inputRef}
          type="file"
          accept={TEMPLATE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            escolher(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {!arquivo && novo ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
            className={clsx(
              "dark:border-dark-500 hover:border-primary-400 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center transition-colors",
              arrastando && "border-primary-500 dark:border-primary-500 bg-primary-50/40 dark:bg-primary-500/5",
            )}
          >
            <div className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 grid size-12 place-items-center rounded-2xl">
              <ArrowUpTrayIcon className="size-6 stroke-[1.5]" />
            </div>
            <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
              Arraste o arquivo aqui ou clique para selecionar
            </p>
            <p className="dark:text-dark-300 mt-1 text-xs text-gray-400">
              .pptx, .html ou .zip (HTML com imagens e fontes) · até 4 MB
            </p>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
            className={clsx(
              "dark:border-dark-500 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 px-4 py-3",
              arrastando && "border-primary-500 dark:border-primary-500",
            )}
          >
            <DocumentIcon className="dark:text-dark-300 size-8 shrink-0 text-gray-400 stroke-[1.2]" />
            <div className="min-w-0 flex-1">
              <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                {arquivo ? arquivo.name : original?.arquivoNome}
              </p>
              <p className="dark:text-dark-300 text-xs text-gray-500">
                {arquivo
                  ? `${formatoDoNome(arquivo.name)} · ${formatarTamanho(arquivo.size)}`
                  : original &&
                    `${ROTULO_FORMATO[original.formato]} · ${formatarTamanho(original.arquivoTamanho)} · versão ${original.versao}`}
              </p>
              <StatusLinha status={arquivo ? status : null} atual={!arquivo} />
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!novo && !arquivo && (
                <Button
                  variant="flat"
                  onClick={() => void baixar()}
                  disabled={baixando}
                  className="h-8 gap-1.5 px-2.5 text-xs-plus"
                >
                  {baixando ? <Spinner className="size-4" /> : <ArrowDownTrayIcon className="size-4" />}
                  Baixar
                </Button>
              )}
              {arquivo && !novo && (
                <Button
                  variant="flat"
                  onClick={descartarArquivo}
                  className="h-8 px-2.5 text-xs-plus"
                >
                  Manter o atual
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={() => inputRef.current?.click()}
                disabled={status?.fase === "enviando" || status?.fase === "processando"}
                className="h-8 gap-1.5 px-2.5 text-xs-plus"
              >
                <ArrowPathIcon className="size-4" />
                Substituir arquivo
              </Button>
            </div>
          </div>
        )}
        {!novo && arquivo && (
          <p className="dark:text-dark-300 mt-1.5 text-xs text-gray-500">
            O arquivo atual só é substituído ao salvar, e só se o novo for processado com sucesso.
          </p>
        )}
      </div>

      {!novo && (
        <div className="dark:border-dark-600 mt-4 rounded-xl border border-gray-200 px-4">
          <ToggleRow
            nome="Template ativo"
            descricao="Templates inativos não aparecem na criação de apresentações do AI Studio."
            checked={ativo}
            onChange={setAtivo}
          />
        </div>
      )}

      {/* ---- Prévia ---- */}
      {estruturaExibida && (
        <div className="mt-6">
          <h5 className="dark:text-dark-100 mb-2 text-sm font-semibold text-gray-700">
            Pré-visualização
          </h5>
          <TemplatePreviaGrade estrutura={estruturaExibida} />
        </div>
      )}

      {/* Margens negativas para o rodapé colar nas bordas do SectionCard. */}
      <div className="dark:border-dark-600 dark:bg-dark-700/95 sticky bottom-0 -mx-5 mt-6 -mb-5 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
        {!novo && original && onExcluir && (
          <Button
            variant="flat"
            onClick={() => onExcluir(original)}
            disabled={salvando}
            className="me-auto gap-1.5 text-rose-600 dark:text-rose-400"
          >
            <TrashIcon className="size-4" /> Excluir template
          </Button>
        )}
        <Button variant="outlined" onClick={voltar} disabled={salvando}>
          Cancelar
        </Button>
        <Button
          color="primary"
          onClick={() => void salvar()}
          disabled={!podeSalvar}
          className="gap-1.5"
        >
          {salvando ? <Spinner className="size-4" /> : <CheckIcon className="size-4" />}
          {salvando ? "Salvando…" : novo ? "Salvar template" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

function Cabecalho({
  titulo,
  onVoltar,
  sujo,
}: {
  titulo: string;
  onVoltar: () => void;
  sujo?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Button variant="flat" onClick={onVoltar} className="text-xs-plus h-8 gap-1.5 px-2.5">
        <ArrowLeftIcon className="size-4" /> Templates
      </Button>
      <h4 className="dark:text-dark-50 min-w-0 truncate text-base font-semibold text-gray-800">
        {titulo}
      </h4>
      {sujo && <span className="text-warning text-tiny-plus">alterações não salvas</span>}
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="dark:text-dark-300 text-xs text-gray-400">{rotulo}</dt>
      <dd className="dark:text-dark-100 mt-0.5 break-words text-gray-700">{valor || "—"}</dd>
    </div>
  );
}

function StatusLinha({ status, atual }: { status: StatusArquivo | null; atual: boolean }) {
  if (atual) {
    return (
      <div className="text-success mt-1 flex items-center gap-1 text-xs">
        <CheckCircleIcon className="size-4" /> Arquivo atual processado
      </div>
    );
  }
  if (!status) return null;
  const base = "mt-1 flex items-center gap-1.5 text-xs";
  switch (status.fase) {
    case "enviando":
      return (
        <div className={clsx(base, "dark:text-dark-200 text-gray-600")} aria-live="polite">
          <Spinner className="size-3.5" /> Enviando arquivo… {Math.round(status.progresso * 100)}%
        </div>
      );
    case "processando":
      return (
        <div className={clsx(base, "dark:text-dark-200 text-gray-600")} aria-live="polite">
          <Spinner className="size-3.5" /> Arquivo enviado · Processando template…
        </div>
      );
    case "pronto":
      return (
        <div className={clsx(base, "text-success")} aria-live="polite">
          <CheckCircleIcon className="size-4" /> Template processado com sucesso ·{" "}
          {status.estrutura.totalSlides}{" "}
          {status.estrutura.totalSlides === 1 ? "slide" : "slides"}
        </div>
      );
    case "erro":
      return (
        <div className={clsx(base, "text-error items-start")} role="alert">
          <ExclamationCircleIcon className="mt-px size-4 shrink-0" />
          <span>
            Não foi possível processar o arquivo. {status.mensagem}
          </span>
        </div>
      );
  }
}
