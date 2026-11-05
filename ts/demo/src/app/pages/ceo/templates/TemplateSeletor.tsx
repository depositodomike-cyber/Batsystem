// Import Dependencies
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRightIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Spinner } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  fetchTemplateApi,
  fetchTemplatesApi,
  type TemplateApresentacao,
} from "@/services/api/templates";
import type { TemplateSelecionado } from "@/services/api/apresentacao";
import { RotuloCampo } from "../RotuloCampo";
import { SlideWireframe } from "./TemplatePrevia";
import { mensagemDeErro, ROTULO_FORMATO } from "./useTemplates";

// ----------------------------------------------------------------------
// "Template de apresentação" no Criar apresentação do AI Studio.
//
// Só SELECIONA: criar e editar templates é de Configurações › Aparência ›
// Templates. Lista apenas os ativos da organização (o servidor filtra pelo
// tenant). Ao escolher, busca a estrutura completa e entrega uma CÓPIA dela à
// tela — é essa cópia que vai para a IA e para o registro da criação.
// ----------------------------------------------------------------------

export function TemplateSeletor({
  value,
  onChange,
  classeSelect,
}: {
  value: TemplateSelecionado | null;
  onChange: (t: TemplateSelecionado | null) => void;
  classeSelect: string;
}) {
  const { pathname } = useLocation();
  const urlTemplates = `/${getCurrentProduct(pathname).code}/configuracoes?secao=aparencia&aba=templates`;

  const [lista, setLista] = useState<TemplateApresentacao[] | null>(null);
  const [erroLista, setErroLista] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetchTemplatesApi({ soAtivos: true })
      .then((l) => vivo && setLista(l))
      .catch(() => {
        if (!vivo) return;
        setLista([]);
        setErroLista(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = async (id: string) => {
    setErro(null);
    if (!id) {
      onChange(null);
      return;
    }
    setBuscando(true);
    try {
      const t = await fetchTemplateApi(id);
      onChange({
        id: t.id,
        nome: t.nome,
        formato: t.formato,
        versao: t.versao,
        estrutura: t.estrutura,
      });
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível carregar o template."));
    } finally {
      setBuscando(false);
    }
  };

  // A seleção retomada de uma criação pode não estar mais entre os ativos
  // (desativado/excluído depois). Ela continua valendo — é a cópia guardada —
  // e aparece como opção para o select não "perder" o valor.
  const foraDaLista = value && lista && !lista.some((t) => t.id === value.id);

  return (
    <div>
      <label className="block text-sm">
        <RotuloCampo
          rotulo="Template de apresentação"
          ajuda="Uma apresentação de referência que orienta a estrutura e a composição dos slides. Cores, fontes e logotipo continuam vindo da identidade visual."
        />
        <div className="relative">
          <select
            value={value?.id ?? ""}
            onChange={(e) => void escolher(e.target.value)}
            disabled={lista === null || buscando}
            className={classeSelect}
          >
            <option value="">A IA decide</option>
            {foraDaLista && (
              <option value={value.id}>{value.nome} (versão salva nesta criação)</option>
            )}
            {(lista ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} · {ROTULO_FORMATO[t.formato]}
              </option>
            ))}
          </select>
          {(lista === null || buscando) && (
            <Spinner className="pointer-events-none absolute top-1/2 right-9 size-4 -translate-y-1/2" />
          )}
        </div>
      </label>
      <p className="dark:text-dark-300 mt-1.5 text-xs text-gray-500">
        Selecione uma apresentação de referência para orientar a estrutura e a
        composição dos slides. A identidade visual selecionada continuará sendo
        aplicada.
      </p>

      {erro && <p className="text-error mt-1.5 text-xs">{erro}</p>}

      {lista !== null && lista.length === 0 && !value && (
        <p className="dark:text-dark-300 mt-1.5 text-xs text-gray-400">
          {erroLista
            ? "Não foi possível carregar os templates agora — a IA decide a estrutura."
            : "Nenhum template cadastrado na organização."}{" "}
          {!erroLista && (
            <Link
              to={urlTemplates}
              className="text-primary-600 dark:text-primary-400 inline-flex items-center gap-0.5 font-medium"
            >
              Cadastrar em Aparência
              <ArrowRightIcon className="size-3" />
            </Link>
          )}
        </p>
      )}

      {value && (
        <div className="dark:border-dark-600 dark:bg-dark-800/40 mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
          <div className="w-16 shrink-0">
            <SlideWireframe
              slide={value.estrutura.slides[0] ?? null}
              proporcao={value.estrutura.proporcao}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
              {value.nome}
            </p>
            <p className="dark:text-dark-300 text-xs text-gray-500">
              {ROTULO_FORMATO[value.formato]} · {value.estrutura.totalSlides}{" "}
              {value.estrutura.totalSlides === 1 ? "slide" : "slides"} de referência
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remover o template selecionado"
            className="dark:text-dark-300 dark:hover:text-dark-100 grid size-6 shrink-0 place-items-center rounded-lg text-gray-400 hover:text-gray-700"
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
