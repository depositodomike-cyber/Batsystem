// Import Dependencies
import { useCallback, useEffect, useState } from "react";

// Local Imports
import {
  enviarDocumentoOrg,
  listarDocumentosOrg,
  removerDocumentoOrg,
  type DocumentoOrg,
} from "@/services/api/repositorioOrg";
import {
  useOrganizacaoAtiva,
  usePapelEfetivo,
  useUsuario,
} from "@/app/pages/prototypes/contas/model/context";
import { extOf } from "@/utils/arquivos";
import { donoDoRepositorio } from "./escopo";

// ----------------------------------------------------------------------

/** Dono do Repositório no escopo ativo (organização, ou chave pessoal). */
export function useDonoRepositorio(): string | null {
  const organizacao = useOrganizacaoAtiva();
  const usuario = useUsuario();
  return donoDoRepositorio(organizacao?.id ?? null, usuario?.id ?? null);
}

/**
 * Quem pode ENVIAR e REMOVER documentos do Repositório.
 *
 * Usa o papel do protótipo de contas — o mesmo funil de `capacidades`: admin
 * gerencia, usuário comum só visualiza. No escopo pessoal não há papel (nem
 * outra pessoa), então o dono gerencia.
 */
export function usePodeGerenciarRepositorio(): boolean {
  const papel = usePapelEfetivo();
  return papel === null || papel === "admin";
}

/** Linha da tabela: o documento do servidor, ou um envio ainda em curso. */
export type LinhaDocumentoOrg = DocumentoOrg & { local?: boolean };

/**
 * Documentos do Repositório da organização ativa, com envio e remoção.
 *
 * Um envio entra na lista na hora, como linha local "processando", e é trocado
 * pela linha do servidor quando a requisição volta — a tela não bloqueia, e
 * vários arquivos processam em paralelo, cada um na sua linha.
 */
export function useDocumentosOrg() {
  const dono = useDonoRepositorio();
  const usuario = useUsuario();
  const [documentos, setDocumentos] = useState<LinhaDocumentoOrg[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (alvo: string | null) => {
    if (!alvo) {
      setDocumentos([]);
      setCarregando(false);
      return;
    }
    try {
      const lista = await listarDocumentosOrg(alvo);
      setDocumentos(lista);
      setErro(null);
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível carregar o repositório."));
    } finally {
      setCarregando(false);
    }
  }, []);

  // Troca de organização = outra lista. O IIFE mantém o setState depois do
  // await, fora do corpo síncrono do efeito.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (cancelado) return;
      await carregar(dono);
    })();
    return () => {
      cancelado = true;
    };
  }, [dono, carregar]);

  const enviar = useCallback(
    async (arquivo: File): Promise<LinhaDocumentoOrg | null> => {
      if (!dono) return null;
      const idLocal = `local_${Math.random().toString(36).slice(2, 10)}`;
      const provisoria: LinhaDocumentoOrg = {
        id: idLocal,
        nome: arquivo.name,
        tipo: extOf(arquivo.name) || "txt",
        tamanho: arquivo.size,
        status: "processando",
        erro: null,
        adicionadoPorNome: usuario?.nome ?? "Você",
        criadoEm: new Date().toISOString(),
        local: true,
      };
      setDocumentos((prev) => [provisoria, ...prev]);

      try {
        const salvo = await enviarDocumentoOrg(dono, arquivo);
        setDocumentos((prev) =>
          prev.map((d) => (d.id === idLocal ? salvo : d)),
        );
        return salvo;
      } catch (e) {
        const falha: LinhaDocumentoOrg = {
          ...provisoria,
          status: "erro",
          erro: mensagemDeErro(e, "Falha no envio."),
        };
        setDocumentos((prev) =>
          prev.map((d) => (d.id === idLocal ? falha : d)),
        );
        return falha;
      }
    },
    [dono, usuario?.nome],
  );

  const remover = useCallback(
    async (id: string) => {
      // Linha local (envio que falhou) nunca chegou ao servidor.
      const alvo = documentos.find((d) => d.id === id);
      if (dono && alvo && !alvo.local) await removerDocumentoOrg(dono, id);
      setDocumentos((prev) => prev.filter((d) => d.id !== id));
    },
    [dono, documentos],
  );

  return { dono, documentos, carregando, erro, enviar, remover };
}

function mensagemDeErro(e: unknown, padrao: string): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m) && typeof m[0] === "string") return m[0];
  }
  return padrao;
}
