// Configurações de usuário — acessadas pelo menu de perfil.
//
// Mesma anatomia das Configurações da organização (Configuracoes.tsx): título,
// navegação lateral agrupada (o MESMO `NavegacaoSecoes`, com outra lista) e o
// painel da seção ativa em `?secao=`. O que muda é o contexto: aqui ficam os
// recursos ligados à experiência de quem está usando, não à estrutura da
// organização.
//
// As seções reaproveitam as telas que já existiam, sem cópia:
//   • Orientador de insights — o `DirecionadorDeInsights`, que antes era a 2ª
//     aba da página de Insights. A tela de Insights (os cards) continua onde
//     estava.
//   • Conectores — a página `Conectores` em modo `embutido`.
//   • Agentes — os agentes mencionáveis (@) no Assistente: os do sistema e os
//     personalizados do usuário (AgentesUsuarioSection).
//
// Os dados continuam no mesmo escopo de antes (organização ativa, permissões,
// conexões): isto é navegação, não mudança de dono dos dados.

// Import Dependencies
import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  AdjustmentsHorizontalIcon,
  LinkIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import {
  getCurrentProduct,
  type SecaoConfiguracoesUsuario,
} from "@/app/navigation/ceoOs";
import type { DirecionamentoInput } from "@/app/data/insights";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";
import { NavegacaoSecoes, type GrupoNavegacao } from "./NavegacaoSecoes";
import { DirecionadorDeInsights } from "./InsightDirecionador";
import Conectores from "./Conectores";
import { AgentesUsuarioSection } from "./AgentesUsuarioSection";

// ----------------------------------------------------------------------

type SecaoUsuario = SecaoConfiguracoesUsuario;

const GRUPOS: GrupoNavegacao[] = [
  {
    id: "usuario",
    titulo: "Geral",
    itens: [
      {
        id: "orientador",
        titulo: "Orientador de insights",
        icon: AdjustmentsHorizontalIcon,
        feature: "insights",
      },
      {
        id: "conectores",
        titulo: "Conectores",
        icon: LinkIcon,
        feature: "connectors",
      },
      {
        id: "agentes",
        titulo: "Agentes",
        icon: SparklesIcon,
      },
    ],
  },
];

const SECAO_PADRAO: SecaoUsuario = "orientador";

/** Parâmetros que pertencem a uma seção e não devem sobreviver à troca. */
const PARAMS_DE_SECAO = ["aba", "conector", "status", "conta", "motivo"];

/**
 * Mesma doutrina de `resolverSecao` na org: desconhecida ou indisponível (flag
 * ligada) cai na primeira disponível, em silêncio.
 */
function resolverSecaoUsuario(pedida: string | null): SecaoUsuario {
  const itens = GRUPOS.flatMap((g) => g.itens);
  const disponivel = (id: string) => {
    const item = itens.find((i) => i.id === id);
    return (
      !!item && !(item.feature && isFeatureTemporarilyDisabled(item.feature))
    );
  };
  if (pedida && disponivel(pedida)) return pedida as SecaoUsuario;
  return (itens.find((i) => disponivel(i.id))?.id as SecaoUsuario) ?? SECAO_PADRAO;
}

export default function ConfiguracoesUsuario() {
  const location = useLocation();
  const navigate = useNavigate();
  const product = getCurrentProduct(location.pathname);
  const [searchParams, setSearchParams] = useSearchParams();
  const ativo = resolverSecaoUsuario(searchParams.get("secao"));

  // 👎 → "Adicionar orientação" (na tela de Insights) chega aqui com a
  // sugestão no `state` da navegação. O Orientador abre o modal pré-preenchido
  // uma vez; depois o `state` é limpo para um reload não reabri-lo.
  const sugestao =
    (location.state as { sugestao?: Partial<DirecionamentoInput> } | null)
      ?.sugestao ?? null;
  useEffect(() => {
    if (!sugestao) return;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [sugestao, navigate, location.pathname, location.search]);

  const selecionarSecao = (secao: SecaoUsuario) => {
    const proximos = new URLSearchParams(searchParams);
    proximos.set("secao", secao);
    for (const k of PARAMS_DE_SECAO) proximos.delete(k);
    setSearchParams(proximos);
  };

  return (
    <Page title={`Configurações de usuário · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-1">
          <PageTitle
            help={{
              description: (
                <>
                  <p>
                    <strong>Configurações de usuário</strong> reúnem os
                    recursos ligados à sua experiência na plataforma — diferente
                    das Configurações da organização, que tratam da estrutura e
                    da administração da organização.
                  </p>
                  <p>
                    Em <strong>Orientador de insights</strong>, você indica à IA
                    os assuntos que merecem atenção e o que não deve ser
                    considerado relevante. Em <strong>Conectores</strong>, você
                    liga as ferramentas que já usa para ampliar o contexto
                    disponível na plataforma. Em <strong>Agentes</strong>, você
                    cria especialistas próprios para chamar com @menção no
                    Assistente.
                  </p>
                </>
              ),
              title: "Configurações de usuário",
            }}
          >
            Configurações de usuário
          </PageTitle>
          <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
            Recursos ligados à sua experiência na plataforma
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <NavegacaoSecoes<SecaoUsuario>
            ativo={ativo}
            onSelecionar={selecionarSecao}
            grupos={GRUPOS}
            ariaLabel="Seções das configurações de usuário"
            prefixoId="cfg-usuario"
          />

          {/* Painel da seção ativa */}
          <div className="min-w-0 flex-1">
            {ativo === "orientador" && (
              <DirecionadorDeInsights sugestao={sugestao} />
            )}
            {ativo === "conectores" && <Conectores embutido />}
            {ativo === "agentes" && <AgentesUsuarioSection />}
          </div>
        </div>
      </div>
    </Page>
  );
}
