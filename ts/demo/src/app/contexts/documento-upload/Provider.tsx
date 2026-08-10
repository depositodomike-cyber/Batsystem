import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { gerarDocumentoApi } from "@/services/api/documento";

import {
  DocumentoUpload,
  DocumentoUploadContext,
  type DocumentoUploadContextValue,
  type IniciarDocumentoInput,
  type NavegadorDocumento,
} from "./context";

// ----------------------------------------------------------------------
// Dono da requisição de upload de documento. Fica acima do RouterProvider,
// então o processamento continua mesmo se o usuário sair da página e voltar
// (enquanto a aba estiver aberta). Quem navega é o DocumentoUploadNavigator,
// montado dentro do router e registrado aqui.
// ----------------------------------------------------------------------

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao organizar o documento. Tente novamente.";
}

function idPendente(): string {
  return `pendente-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DocumentoUploadProvider({ children }: { children: ReactNode }) {
  // Mapa id → upload. Depois do sucesso, a mesma entrada também é indexada
  // pelo memoriaId para a URL definitiva continuar encontrando o resultado.
  const [uploads, setUploads] = useState<Record<string, DocumentoUpload>>({});
  const navegadorRef = useRef<NavegadorDocumento | null>(null);

  const registrarNavegador = useCallback(
    (navegar: NavegadorDocumento | null) => {
      navegadorRef.current = navegar;
    },
    [],
  );

  // Sem navegador registrado (rota fora do router), recarrega na URL destino
  // em vez de deixar o usuário sem feedback.
  const navegar = useCallback((path: string, replace = false) => {
    const fn = navegadorRef.current;
    if (fn) fn(path, { replace });
    else window.location.assign(path);
  }, []);

  const descartar = useCallback((id: string) => {
    setUploads((prev) => {
      const entry = prev[id];
      if (!entry) return prev;
      const next = { ...prev };
      delete next[id];
      // Se estava indexada também pelo memoriaId, remove o alias.
      if (
        entry.memoriaId &&
        entry.memoriaId !== id &&
        next[entry.memoriaId] === entry
      ) {
        delete next[entry.memoriaId];
      }
      // Se veio pelo memoriaId, remove também o id pendente original.
      if (entry.id !== id && next[entry.id] === entry) {
        delete next[entry.id];
      }
      return next;
    });
  }, []);

  const consumirSugerir = useCallback((id: string) => {
    setUploads((prev) => {
      const entry = prev[id];
      if (!entry?.sugerirPendente) return prev;
      const updated = { ...entry, sugerirPendente: false };
      const next = { ...prev, [entry.id]: updated };
      if (entry.memoriaId) next[entry.memoriaId] = updated;
      return next;
    });
  }, []);

  const iniciar = useCallback(
    (input: IniciarDocumentoInput): string => {
      const id = idPendente();
      const produto = getCurrentProduct(window.location.pathname);
      const nomeArquivo = input.arquivo?.name;

      setUploads((prev) => ({
        ...prev,
        [id]: { id, nomeArquivo, estado: "analisando" },
      }));

      // Vai para a página do documento já no estado "Analisando conteúdo".
      navegar(`/${produto.code}/documento/${id}`);

      void (async () => {
        try {
          const data = await gerarDocumentoApi({
            arquivo: input.arquivo,
            texto: input.texto?.trim() || undefined,
          });

          const pronto: DocumentoUpload = {
            id,
            nomeArquivo,
            estado: "pronto",
            titulo: data.titulo,
            conteudo: data.conteudo,
            salvo: data.salvo,
            memoriaId: data.memoriaId,
            sugerirPendente: data.salvo,
          };

          setUploads((prev) => {
            const next = { ...prev, [id]: pronto };
            // Indexa também pelo memoriaId para a URL definitiva.
            if (data.memoriaId) next[data.memoriaId] = pronto;
            return next;
          });

          toast(data.salvo ? "Documento salvo no Contexto" : "Documento gerado", {
            description: data.salvo
              ? "Guardado em Documentos."
              : "Não foi possível salvar no Contexto.",
          });

          // Troca a URL pendente pela definitiva quando houver memoriaId.
          if (data.memoriaId) {
            navegar(`/${produto.code}/documento/${data.memoriaId}`, true);
          }
        } catch (err) {
          setUploads((prev) => ({
            ...prev,
            [id]: { ...prev[id]!, estado: "erro", erro: errMessage(err) },
          }));
        }
      })();

      return id;
    },
    [navegar],
  );

  const value = useMemo<DocumentoUploadContextValue>(
    () => ({
      iniciar,
      obter: (id: string) => uploads[id],
      descartar,
      consumirSugerir,
      registrarNavegador,
    }),
    [iniciar, uploads, descartar, consumirSugerir, registrarNavegador],
  );

  return (
    <DocumentoUploadContext value={value}>{children}</DocumentoUploadContext>
  );
}
