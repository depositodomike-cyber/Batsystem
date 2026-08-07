/**
 * Menu da bolinha de perfil: lista APENAS os workspaces do usuário.
 *
 * Os contextos de cada workspace ficam no item "Contexto" da
 * sidebar — aqui a escolha é de escopo, não de conteúdo.
 */

import { useEffect } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import {
  ArrowLeftStartOnRectangleIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useLocation, useNavigate } from "react-router";

import { useAuthContext } from "@/app/contexts/auth/context";
import { getProductCodeFromPath } from "@/app/navigation/ceoOs";
import {
  useGruposDeRepositorios,
  useOrganizacaoAtiva,
  usePrototipoContas,
  useRepositorioAtivo,
} from "@/app/pages/prototypes/contas/model/context";
import { rotuloPapel } from "@/app/pages/prototypes/contas/model/regras";
import { Avatar, AvatarDot, Button } from "@/components/ui";

type AnchorTo = "bottom end" | "right end" | "bottom start" | "top end";

export function ProfileMenu({
  avatarSize = 9,
  anchor = "bottom end",
  transitionFrom = "translate-y-2",
}: {
  avatarSize?: number;
  anchor?: AnchorTo;
  /** Classe de entrada do Transition (ex.: translate-y-2 ou translate-x-2). */
  transitionFrom?: string;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuthContext();
  const { estado, despachar } = usePrototipoContas();
  const grupos = useGruposDeRepositorios();
  const organizacaoAtiva = useOrganizacaoAtiva();
  const repositorioAtivo = useRepositorioAtivo();

  // Alinha a sessão do protótipo com o usuário autenticado (ex.: após reload ou
  // login direto na app) — criando a conta se ela ainda não existir.
  const emailAutenticado = user?.email?.trim() ?? "";
  const sessaoDesalinhada =
    emailAutenticado !== "" &&
    estado.usuarios.find((u) => u.id === estado.sessao?.usuarioId)?.email !==
      emailAutenticado;

  useEffect(() => {
    if (!sessaoDesalinhada) return;
    despachar({
      tipo: "sessao/garantir",
      payload: {
        nome: user?.name ?? emailAutenticado.split("@")[0] ?? "Usuário",
        email: emailAutenticado,
      },
    });
  }, [sessaoDesalinhada, emailAutenticado, user?.name, despachar]);

  const usuarioProto = estado.usuarios.find(
    (u) => u.id === estado.sessao?.usuarioId,
  );
  const nome = user?.name ?? usuarioProto?.nome ?? "Usuário";
  const email = user?.email ?? usuarioProto?.email ?? "";

  const escopoPessoalAtivo =
    repositorioAtivo?.escopo.tipo === "pessoal" || repositorioAtivo == null;

  const abrirWorkspace = (organizacaoId: string | null, close: () => void) => {
    despachar({ tipo: "contexto/abrirOrganizacao", payload: { organizacaoId } });
    navigate(`/${getProductCodeFromPath(pathname)}`);
    close();
  };

  return (
    <Popover className="relative flex">
      <PopoverButton
        as={Avatar}
        size={avatarSize}
        role="button"
        name={nome}
        initialColor="primary"
        indicator={
          <AvatarDot
            color="success"
            className="-m-0.5 size-3 ltr:right-0 rtl:left-0"
          />
        }
        className="cursor-pointer"
      />
      <Transition
        enter="duration-200 ease-out"
        enterFrom={`${transitionFrom} opacity-0`}
        enterTo="translate-y-0 translate-x-0 opacity-100"
        leave="duration-200 ease-out"
        leaveFrom="translate-y-0 translate-x-0 opacity-100"
        leaveTo={`${transitionFrom} opacity-0`}
      >
        <PopoverPanel
          anchor={{ to: anchor, gap: 12 }}
          className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 flex w-72 flex-col rounded-lg border bg-white transition dark:shadow-none"
        >
          {({ close }: { close: () => void }) => (
            <>
              <div className="dark:bg-dark-800 flex items-center gap-3 rounded-t-lg bg-gray-100 px-4 py-4">
                <Avatar size={12} name={nome} initialColor="primary" />
                <div className="min-w-0">
                  <p className="dark:text-dark-100 truncate text-base font-medium text-gray-700">
                    {nome}
                  </p>
                  {email && (
                    <p className="dark:text-dark-300 mt-0.5 truncate text-xs text-gray-400">
                      {email}
                    </p>
                  )}
                </div>
              </div>

              <div className="max-h-[min(22rem,65vh)] overflow-y-auto px-2 py-3">
                <p className="text-tiny-plus dark:text-dark-300 px-2 pb-1.5 font-semibold tracking-wider text-gray-400 uppercase">
                  Workspaces
                </p>

                {grupos.length === 0 ? (
                  <p className="dark:text-dark-300 px-2 py-2 text-xs text-gray-400">
                    Nenhum workspace nesta sessão.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {grupos.map((grupo) => {
                      const isPessoal = grupo.escopo === "pessoal";
                      const isAtiva = isPessoal
                        ? escopoPessoalAtivo
                        : grupo.organizacaoId === organizacaoAtiva?.id;
                      const Icon = isPessoal ? UserIcon : BuildingOffice2Icon;

                      return (
                        <li key={grupo.chave}>
                          <button
                            type="button"
                            onClick={() =>
                              abrirWorkspace(grupo.organizacaoId ?? null, close)
                            }
                            className={clsx(
                              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-hidden transition-colors",
                              isAtiva
                                ? "bg-primary-600/10 dark:bg-primary-400/10"
                                : "hover:bg-gray-100 dark:hover:bg-dark-600",
                            )}
                          >
                            <Icon
                              className={clsx(
                                "size-4 shrink-0",
                                isAtiva
                                  ? "text-primary-600 dark:text-primary-400"
                                  : "dark:text-dark-300 text-gray-400",
                              )}
                              strokeWidth="1.8"
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={clsx(
                                  "block truncate text-sm font-medium",
                                  isAtiva
                                    ? "text-primary-600 dark:text-primary-400"
                                    : "dark:text-dark-100 text-gray-800",
                                )}
                              >
                                {grupo.rotulo}
                              </span>
                              <span className="dark:text-dark-300 block text-tiny-plus text-gray-400">
                                {grupo.papel
                                  ? rotuloPapel(grupo.papel, "prosa")
                                  : "Somente você"}
                              </span>
                            </span>
                            {isAtiva && (
                              <CheckCircleIcon className="size-4 shrink-0 text-primary-600 dark:text-primary-400" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="dark:border-dark-600 border-t border-gray-150 px-4 py-3">
                <Button className="w-full gap-2" onClick={() => logout()}>
                  <ArrowLeftStartOnRectangleIcon className="size-4.5" />
                  <span>Sair</span>
                </Button>
              </div>
            </>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
