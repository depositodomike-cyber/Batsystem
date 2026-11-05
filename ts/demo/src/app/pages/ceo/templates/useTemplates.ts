import { useCallback, useEffect, useState } from "react";
import {
  atualizarTemplateApi,
  fetchTemplatesApi,
  removerTemplateApi,
  type ArquetipoSlide,
  type TemplateApresentacao,
  type TemplateCompleto,
} from "@/services/api/templates";

/**
 * Lista de templates da organização para Configurações › Aparência ›
 * Templates. Estado local simples (molde de `useDocumentosOrg`): só esta tela
 * escreve, e o AI Studio busca a própria lista de ativos quando abre.
 */
export function useTemplates() {
  const [itens, setItens] = useState<TemplateApresentacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  /** Busca a lista. Só chamado de callbacks e do efeito de montagem. */
  const buscar = useCallback(
    () =>
      fetchTemplatesApi()
        .then((l) => {
          setItens(l);
          setErro(null);
        })
        .catch((e) =>
          setErro(mensagemDeErro(e, "Não foi possível carregar os templates.")),
        )
        .finally(() => setCarregando(false)),
    [],
  );

  // `carregando` já nasce true: o efeito só dispara a busca.
  useEffect(() => {
    void buscar();
  }, [buscar]);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    await buscar();
  }, [buscar]);

  /** Troca (ou inclui) um registro devolvido pela API, mantendo a ordem por nome. */
  const aplicar = useCallback((t: TemplateApresentacao | TemplateCompleto) => {
    setItens((atual) =>
      [...atual.filter((x) => x.id !== t.id), t].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    );
  }, []);

  const alternarAtivo = useCallback(
    async (t: TemplateApresentacao) => {
      aplicar(await atualizarTemplateApi(t.id, { ativo: !t.ativo }));
    },
    [aplicar],
  );

  const remover = useCallback(async (id: string) => {
    await removerTemplateApi(id);
    setItens((atual) => atual.filter((x) => x.id !== id));
  }, []);

  return { itens, carregando, erro, recarregar, aplicar, alternarAtivo, remover };
}

/** Mensagem do erro da API (string, `message` string ou array do Nest). */
export function mensagemDeErro(e: unknown, padrao: string): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg) && typeof msg[0] === "string") return msg[0];
  }
  return padrao;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export const ROTULO_FORMATO: Record<"pptx" | "html", string> = {
  pptx: "PowerPoint",
  html: "HTML",
};

export const ROTULO_ARQUETIPO: Record<ArquetipoSlide, string> = {
  capa: "Capa",
  secao: "Seção",
  conteudo: "Conteúdo",
  comparacao: "Comparação",
  "imagem-texto": "Imagem + texto",
  "grade-cards": "Grade de cards",
  indicadores: "Indicadores",
  grafico: "Gráfico",
  tabela: "Tabela",
  citacao: "Citação",
  encerramento: "Encerramento",
};
