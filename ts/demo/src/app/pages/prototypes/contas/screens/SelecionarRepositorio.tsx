/**
 * Seletor de contexto / organização.
 *
 * Não faz mais parte do cadastro: após criar a organização (pessoal ou
 * corporativa), o usuário entra direto no produto. Esta tela continua como
 * destino de “Criar organização” no menu de perfil (`?novo=1`), listando
 * todas as organizações existentes.
 */

import {
  ArrowsRightLeftIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ChevronRightIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { flushSync } from "react-dom";
import { Navigate, useNavigate } from "react-router";

import { useAuthContext } from "@/app/contexts/auth/context";
import { DISABLED_MENU_CLASS } from "@/app/data/temporarilyDisabledFeatures";
import { Avatar, Badge } from "@/components/ui";
import { HOME_PATH } from "@/constants/app";
import { garantirSessaoBackend } from "@/services/api/contaBackend";

import { MolduraAuth } from "../components/MolduraAuth";
import {
  useGruposDeRepositorios,
  usePrototipoContas,
  useRepositorioAtivo,
  useUsuario,
} from "../model/context";
import { rotuloPapel } from "../model/regras";

const MOTIVO_COMPARTILHAMENTO =
  "Em breve — compartilhar repositórios entre usuários e times ainda não foi liberado.";

export default function SelecionarRepositorio() {
  const navigate = useNavigate();
  const { establishSession, adoptSession, isAuthenticated, user } =
    useAuthContext();
  const usuario = useUsuario();
  const grupos = useGruposDeRepositorios();
  const ativo = useRepositorioAtivo();
  const { estado, despachar } = usePrototipoContas();

  if (!usuario) return <Navigate to="../criar-conta" replace />;

  // Sem nenhuma organização ainda — nada a escolher.
  if (grupos.length === 0) {
    return <Navigate to={HOME_PATH} replace />;
  }
  const abrir = async (repositorioId: string) => {
    despachar({ tipo: "contexto/abrirRepositorio", payload: { repositorioId } });

    const token = window.localStorage.getItem("authToken");
    const jaTemJwtReal =
      isAuthenticated &&
      !!token &&
      !token.endsWith(".prototype") &&
      user?.email?.toLowerCase() === usuario.email.toLowerCase();

    if (!jaTemJwtReal) {
      const org = estado.organizacoes.find((o) =>
        estado.membros.some(
          (m) => m.usuarioId === usuario.id && m.organizacaoId === o.id,
        ),
      );
      const sessao = await garantirSessaoBackend({
        nome: usuario.nome,
        email: usuario.email,
        senha: usuario.senha,
        organizacaoNome: org?.nome,
      });
      flushSync(() => {
        if (sessao.tipo === "ok") {
          adoptSession(sessao.authToken, sessao.user);
        } else {
          establishSession({
            id: usuario.id,
            name: usuario.nome,
            email: usuario.email,
          });
        }
      });
    }

    navigate(HOME_PATH);
  };

  return (
    <MolduraAuth
      tituloPagina="Selecionar organização"
      kicker="Etapa 3 · Repositório de trabalho"
      titulo="Selecione a organização"
      subtitulo="Escolha onde você quer começar a trabalhar."
      largura="max-w-[34rem]"
      depoisDoCard={
        <p className="dark:text-dark-300 mt-4 text-center text-xs-plus text-gray-400">
          Repositórios são isolados entre organizações: o conteúdo de um não
          aparece no outro.
        </p>
      }
    >
      <div className="space-y-6">
        {grupos.map((grupo) => (
          <section key={grupo.chave}>
            <div className="flex items-center gap-2">
              {grupo.escopo === "pessoal" ? (
                <UserIcon
                  className="dark:text-dark-300 size-4 shrink-0 text-gray-400"
                  strokeWidth="1.8"
                />
              ) : (
                <BuildingOffice2Icon
                  className="dark:text-dark-300 size-4 shrink-0 text-gray-400"
                  strokeWidth="1.8"
                />
              )}
              <h3 className="dark:text-dark-200 min-w-0 truncate text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
                {grupo.rotulo}
              </h3>
              {grupo.papel && (
                <Badge
                  color="primary"
                  variant="soft"
                  className="shrink-0 text-tiny-plus"
                >
                  {rotuloPapel(grupo.papel)}
                </Badge>
              )}
            </div>

            <div className="mt-3 space-y-2.5">
              {grupo.repositorios.map((repo) => {
                const isAtivo = repo.id === ativo?.id;
                const conteudo = estado.conteudo[repo.id];
                const itens =
                  (conteudo?.memoria.length ?? 0) +
                  (conteudo?.agrupamentos.length ?? 0) +
                  (conteudo?.insights.length ?? 0);

                return (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => abrir(repo.id)}
                    className={clsx(
                      "group flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors",
                      isAtivo
                        ? "border-primary-600 bg-primary-600/5 dark:border-primary-400 dark:bg-primary-400/10"
                        : "dark:border-dark-600 dark:bg-dark-900 dark:hover:border-dark-500 dark:hover:bg-dark-800 border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                    )}
                  >
                    <Avatar
                      size={10}
                      name={repo.nome}
                      initialColor="primary"
                      classNames={{ display: "rounded-lg text-sm" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                        {repo.nome}
                      </p>
                      <p className="dark:text-dark-300 mt-0.5 truncate text-xs text-gray-400">
                        Repositório · {itens} {itens === 1 ? "item" : "itens"}
                      </p>
                    </div>
                    {isAtivo && (
                      <Badge
                        color="primary"
                        variant="soft"
                        className="shrink-0 gap-1 text-tiny-plus"
                      >
                        <CheckCircleIcon className="size-3" />
                        Aberto agora
                      </Badge>
                    )}
                    <ChevronRightIcon
                      className="dark:text-dark-400 dark:group-hover:text-primary-400 size-4 shrink-0 text-gray-300 transition-colors group-hover:text-primary-600"
                      strokeWidth="2"
                    />
                  </button>
                );
              })}

              {grupo.repositorios.length === 0 && (
                <p className="dark:border-dark-600 dark:text-dark-300 rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-400">
                  Nenhum repositório nesta organização ainda.
                </p>
              )}

              {/* Funcionalidade futura, presente e inerte. */}
              {grupo.escopo === "organizacao" && (
                <div
                  aria-disabled="true"
                  title={MOTIVO_COMPARTILHAMENTO}
                  className={clsx(
                    "dark:border-dark-500 flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3",
                    DISABLED_MENU_CLASS,
                  )}
                >
                  <span className="dark:bg-dark-700 dark:text-dark-400 grid size-10 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-300">
                    <ArrowsRightLeftIcon className="size-5" strokeWidth="1.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                      Compartilhar com outro time
                    </p>
                    <p className="dark:text-dark-300 mt-0.5 truncate text-xs text-gray-400">
                      Compartilhamento seletivo de repositórios — em breve.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </MolduraAuth>
  );
}
