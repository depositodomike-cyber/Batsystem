import { useCallback, useState } from "react";
import { toast } from "sonner";
import * as store from "./store";
import { PADRAO, type DesignSystem } from "./types";

/**
 * Estado e ações de edição de UMA marca: carregar, marcar sujo, salvar,
 * restaurar as sugestões e excluir. Fica fora do componente para separar o que
 * é assíncrono e falível do que é layout — a aba Guia de marca cuida do
 * enquadramento, do rodapé e de para onde ir depois de salvar.
 *
 * `salvar` e `excluir` devolvem `boolean` em vez de lançar: quem chama tem o
 * mesmo par de perguntas ("deu certo?" / "o que eu mostro?"), e a resposta sobre
 * o que fazer a seguir é do host.
 */
export function useEditorMarca(brandId: string) {
  // O host só monta este hook com as marcas já carregadas — a aba abre o editor
  // a partir de uma linha da tabela. Nada de efeito de sincronização: ele
  // sobrescreveria a edição em curso com o dado da rede.
  const [ds, setDsInterno] = useState<DesignSystem>(() =>
    store.getById(brandId),
  );
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const setDs = useCallback((proximo: DesignSystem) => {
    setDsInterno(proximo);
    setSujo(true);
    setErro(null);
  }, []);

  const salvar = useCallback(async (): Promise<boolean> => {
    setSalvando(true);
    setErro(null);
    try {
      await store.salvarAsync(brandId, ds);
      setSujo(false);
      toast("Identidade visual salva", { description: store.resumo(brandId) });
      return true;
    } catch (e) {
      // 409 de nome duplicado, 403 de permissão, servidor fora: a API já manda
      // a frase pronta. Fica no formulário E no toast — quem está no fim de um
      // formulário longo não vê um toast que já sumiu.
      const msg = mensagem(e, "Não foi possível salvar a identidade visual.");
      setErro(msg);
      toast.error(msg);
      return false;
    } finally {
      setSalvando(false);
    }
  }, [brandId, ds]);

  const excluir = useCallback(async (): Promise<boolean> => {
    setExcluindo(true);
    setErro(null);
    try {
      await store.removerAsync(brandId);
      toast("Marca excluída");
      return true;
    } catch (e) {
      const msg = mensagem(e, "Não foi possível excluir a marca.");
      setErro(msg);
      toast.error(msg);
      return false;
    } finally {
      setExcluindo(false);
    }
  }, [brandId]);

  /** Volta tudo ao preset, preservando só o nome. Não salva — só prepara. */
  const restaurar = useCallback(() => {
    setDsInterno((d) => ({
      ...structuredClone(PADRAO),
      marca: { ...PADRAO.marca, nome: d.marca.nome },
    }));
    setSujo(true);
    toast("Sugestões restauradas", { description: "Salve para aplicar." });
  }, []);

  return {
    ds,
    setDs,
    sujo,
    salvando,
    excluindo,
    erro,
    salvar,
    excluir,
    restaurar,
  };
}

/** Mensagem do erro da API, com um fallback curto. */
function mensagem(e: unknown, padrao: string): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg) && typeof msg[0] === "string") return msg[0];
  }
  return padrao;
}
