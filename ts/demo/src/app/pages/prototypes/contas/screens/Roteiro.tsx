/**
 * Índice do protótipo — ponto de partida do percurso.
 *
 * Existe porque um protótipo entregue por URL precisa de uma porta de entrada
 * que explique o que se está olhando e em que ordem.
 */

import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  CircleStackIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router";

import { Page } from "@/components/shared/Page";
import { Card } from "@/components/ui";

import { LogoBeculture } from "../components/LogoBeculture";

const TELAS = [
  {
    slug: "criar-conta",
    numero: 1,
    Icon: UserPlusIcon,
    titulo: "Criação de conta",
    desc: "Nome, e-mail, senha e confirmação. Sem escolha de tipo nesta etapa.",
  },
  {
    slug: "organizacao",
    numero: 2,
    Icon: BuildingOffice2Icon,
    titulo: "Intenção de uso",
    desc: "Pessoal (espaço automático) ou empresa/equipe (nome + convites opcionais).",
  },
  {
    slug: "repositorios",
    numero: 3,
    Icon: CircleStackIcon,
    titulo: "Seletor de contexto / workspace",
    desc: "Troca rápida entre o contexto pessoal e os dos workspaces, com o papel em cada um.",
  },
] as const;

const REGRAS = [
  "Existe um único login, o da própria aplicação — o cadastro é que é novo.",
  "A intenção de uso fica no Step 2; B2C/B2B continua derivado do pagador, não como campo técnico.",
  "O workspace é a entidade central; contém contextos e pessoas.",
  "Um usuário pode pertencer a vários workspaces, com papel diferente em cada um.",
  "Um workspace tem N contextos, e contextos de workspaces diferentes não se falam.",
  "Nunca há dois contextos abertos ao mesmo tempo.",
];

export default function Roteiro() {
  return (
    <Page title="Protótipo · Contas e contextos">
      <main className="min-h-100vh grid w-full grow grid-cols-1 place-items-center py-8">
        <div className="w-full max-w-[52rem] p-4 sm:px-5">
          <div className="text-center">
            <LogoBeculture />
            <div className="mt-4">
              <p className="text-tiny-plus font-semibold tracking-wider text-primary-600 uppercase dark:text-primary-400">
                Protótipo navegável
              </p>
              <h2 className="dark:text-dark-100 text-2xl font-semibold tracking-wide text-gray-600">
                Contas, workspaces e contextos
              </h2>
              <p className="dark:text-dark-300 mt-1 text-gray-400">
                Da criação da conta até a escolha do contexto/workspace. Para
                entrar numa conta existente, use o login da aplicação.
              </p>
            </div>
          </div>

          <ol className="mt-6 space-y-2">
            {TELAS.map((t) => (
              <li key={t.slug}>
                <Card
                  skin="bordered"
                  component={Link}
                  to={t.slug}
                  className="dark:hover:border-primary-400/50 flex items-center gap-4 bg-white p-4 transition-colors hover:border-primary-600/50 dark:bg-dark-900"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-600/10 text-primary-600 dark:text-primary-400">
                    <t.Icon className="size-5" strokeWidth="1.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
                      {t.numero}. {t.titulo}
                    </p>
                    <p className="dark:text-dark-300 mt-0.5 text-xs-plus text-gray-500">
                      {t.desc}
                    </p>
                  </div>
                  <ArrowRightIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
                </Card>
              </li>
            ))}
          </ol>

          <Card
            skin="bordered"
            className="mt-6 bg-white p-4 sm:px-5 dark:bg-dark-900"
          >
            <h3 className="dark:text-dark-100 text-base font-medium text-gray-800">
              Regras representadas
            </h3>
            <ul className="dark:text-dark-200 mt-3 space-y-1.5 text-xs-plus text-gray-600">
              {REGRAS.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-500" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </main>
    </Page>
  );
}
