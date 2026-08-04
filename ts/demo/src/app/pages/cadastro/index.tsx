import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  IdentificationIcon,
  LockClosedIcon,
  PhoneIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import clsx from "clsx";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import BecultureSignature from "@/assets/branding/beculture-signature.svg?react";
import BecultureSignatureDark from "@/assets/branding/beculture-signature-dark.svg?react";
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import {
  Button,
  Card,
  Checkbox,
  Input,
  InputErrorMsg,
  Select,
} from "@/components/ui";
import {
  ContratoBar,
  SecaoModulos,
  SecaoResumo,
  SectionHeading,
  usePrecificador,
} from "@/components/shared/Precificador";
import { useCompaniesContext } from "@/app/contexts/companies/context";
import type { CadastroResultado } from "@/app/contexts/companies/context";
import {
  PLANOS,
  TRIAL_DIAS,
  formatBRL,
  parsePlanoCode,
  type PlanoCode,
} from "@/app/data/planos";
import { MODULOS, nomeModulo, unidadeDoModulo } from "@/app/data/modulos";
import { SETORES } from "@/app/data/setores";
import { maskCnpj } from "@/utils/cnpj";
import { maskTelefone } from "@/utils/telefone";
import { CadastroFormValues, schema, type TipoPessoa } from "./schema";

const PLANO_RANK: Record<PlanoCode, number> = {
  basico: 0,
  profissional: 1,
  corporativo: 2,
};

export default function Cadastro() {
  const [searchParams] = useSearchParams();
  const { cadastrarEmpresa } = useCompaniesContext();

  // Blocos 1 e 2 (módulos + resumo) usam o precificador da calculadora.
  const precificador = usePrecificador(
    parsePlanoCode(searchParams.get("plano")),
  );
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("pj");
  const [resultado, setResultado] = useState<CadastroResultado | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const isPF = tipoPessoa === "pf";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CadastroFormValues>({
    resolver: yupResolver(schema),
    context: { tipoPessoa },
    defaultValues: {
      razaoSocial: "",
      documento: "",
      nome: "",
      email: "",
      telefone: "",
      setor: "",
      nomeFantasia: "",
      senha: "",
      confirmarSenha: "",
      aceite: false,
    },
  });

  const onTipoPessoaChange = (tipo: TipoPessoa) => {
    if (tipo === tipoPessoa) return;
    setTipoPessoa(tipo);
    setValue("documento", "");
    setValue("razaoSocial", "");
    if (tipo === "pf") {
      // PF = uso individual: módulos por usuário ficam com 1 usuário.
      MODULOS.filter((m) => m.unidade === "usuarios").forEach((m) =>
        precificador.updateConfig(m.code, { quantidade: 1 }),
      );
    }
  };

  const onSubmit = async (data: CadastroFormValues) => {
    setErroGeral(null);

    const configuracoes = precificador.configsSelecionadas;
    const invalida = configuracoes.some(
      (c) => !Number.isFinite(c.quantidade) || c.quantidade < 1,
    );
    if (invalida) {
      setErroGeral("Informe a quantidade de todos os módulos selecionados.");
      return;
    }

    // Campos agregados (compatibilidade com a assinatura atual): o plano
    // "principal" é o mais alto entre os módulos; usuários é a maior
    // quantidade entre os módulos por usuário.
    const porUsuario = configuracoes.filter(
      (c) => unidadeDoModulo(c.modulo) === "usuarios",
    );
    const hiring = configuracoes.find((c) => c.modulo === "recrutamento");
    const planoPrincipal = configuracoes.reduce<PlanoCode>(
      (melhor, c) => (PLANO_RANK[c.plano] > PLANO_RANK[melhor] ? c.plano : melhor),
      "basico",
    );

    try {
      const r = await cadastrarEmpresa({
        tipoPessoa,
        documento: data.documento,
        razaoSocial: isPF ? data.nome : data.razaoSocial,
        nomeFantasia: isPF ? undefined : data.nomeFantasia.trim() || undefined,
        setor: data.setor || undefined,
        plano: planoPrincipal,
        ciclo: precificador.ciclo,
        modulos: configuracoes.map((c) => c.modulo),
        configuracoes,
        usuarios: porUsuario.length
          ? Math.max(...porUsuario.map((c) => c.quantidade))
          : 0,
        posicoes: hiring?.quantidade ?? 0,
        responsavel: {
          nome: data.nome,
          email: data.email,
          telefone: data.telefone,
          senha: data.senha,
        },
      });
      setResultado(r);
    } catch (e) {
      setErroGeral(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir o cadastro. Tente novamente.",
      );
    }
  };

  return (
    <Page title="Cadastro da empresa">
      <main className="min-h-100vh grid w-full grow grid-cols-1 place-items-center py-8">
        <div className="w-full max-w-[56rem] p-4 sm:px-5">
          <div className="text-center">
            <BecultureSignature className="mx-auto h-12 w-auto dark:hidden" />
            <BecultureSignatureDark className="mx-auto hidden h-12 w-auto dark:block" />
            <div className="mt-4">
              <PageTitle
                className="text-2xl font-semibold text-gray-600 dark:text-dark-100"
                wrapperClassName="justify-center"
                help={{ description: (<>
                  <p>Esta é a tela de <strong>cadastro da empresa</strong>: você escolhe os módulos e o ciclo de cobrança, preenche os dados da empresa ou de uso pessoal e cria a conta para iniciar o teste grátis.</p>
                  <p>Dá para cadastrar como empresa (CNPJ) ou pessoa física (CPF) — os campos se ajustam ao tipo. Ao concluir, o teste grátis é ativado e você segue para o onboarding.</p>
                </>) }}
              >
                {resultado ? "Tudo certo!" : "Crie a sua conta"}
              </PageTitle>
              <p className="text-gray-400 dark:text-dark-300">
                {resultado
                  ? "Seu teste grátis já está ativo."
                  : `Teste grátis de ${TRIAL_DIAS} dias · sem cartão de crédito`}
              </p>
            </div>
          </div>

          <Card className="mt-5 rounded-lg p-5 lg:p-7">
            {resultado ? (
              <Sucesso resultado={resultado} />
            ) : (
              <>
                <ContratoBar
                  ciclo={precificador.ciclo}
                  onChange={precificador.setCiclo}
                />
                <SecaoModulos numero={1} precificador={precificador} />

                <div className="mt-6">
                  <SecaoResumo numero={2} precificador={precificador} />
                </div>

                <div className="mt-6">
                  <SectionHeading
                    numero={3}
                    titulo="Seus dados"
                    subtitulo="É uma empresa ou uso pessoal? Os campos se ajustam."
                  />

                  {/* Toggle PJ / PF */}
                  <div className="mt-3 inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-dark-500">
                    {(
                      [
                        ["pj", "Empresa (CNPJ)"],
                        ["pf", "Pessoa física (CPF)"],
                      ] as const
                    ).map(([v, label]) => {
                      const ativo = tipoPessoa === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => onTipoPessoaChange(v)}
                          className={clsx(
                            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            ativo
                              ? "bg-primary-500 text-white"
                              : "text-gray-500 hover:text-gray-700 dark:text-dark-300",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="mt-4"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {!isPF && (
                        <Input
                          label="Razão social"
                          placeholder="Nome da empresa"
                          classNames={{ root: "sm:col-span-2" }}
                          autoComplete="organization"
                          prefix={
                            <BuildingOffice2Icon
                              className="size-5 transition-colors duration-200"
                              strokeWidth="1"
                            />
                          }
                          {...register("razaoSocial")}
                          error={errors?.razaoSocial?.message}
                        />
                      )}

                      <Input
                        label={isPF ? "Nome completo" : "Nome do responsável"}
                        placeholder="Seu nome completo"
                        classNames={{ root: isPF ? "sm:col-span-2" : undefined }}
                        autoComplete="name"
                        prefix={
                          <UserIcon
                            className="size-5 transition-colors duration-200"
                            strokeWidth="1"
                          />
                        }
                        {...register("nome")}
                        error={errors?.nome?.message}
                      />

                      <Input
                        label={isPF ? "E-mail" : "E-mail corporativo"}
                        placeholder={
                          isPF ? "voce@email.com" : "voce@empresa.com.br"
                        }
                        type="email"
                        autoComplete="email"
                        prefix={
                          <EnvelopeIcon
                            className="size-5 transition-colors duration-200"
                            strokeWidth="1"
                          />
                        }
                        {...register("email")}
                        error={errors?.email?.message}
                      />

                      <Input
                        label="Telefone"
                        placeholder="(11) 90000-0000"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        prefix={
                          <PhoneIcon
                            className="size-5 transition-colors duration-200"
                            strokeWidth="1"
                          />
                        }
                        {...register("telefone")}
                        value={watch("telefone")}
                        onChange={(e) =>
                          setValue("telefone", maskTelefone(e.target.value), {
                            shouldValidate: true,
                          })
                        }
                        error={errors?.telefone?.message}
                      />

                      {!isPF && (
                        <Input
                          label="CNPJ"
                          placeholder="00.000.000/0000-00"
                          inputMode="numeric"
                          prefix={
                            <IdentificationIcon
                              className="size-5 transition-colors duration-200"
                              strokeWidth="1"
                            />
                          }
                          {...register("documento")}
                          value={watch("documento")}
                          onChange={(e) =>
                            setValue("documento", maskCnpj(e.target.value), {
                              shouldValidate: true,
                            })
                          }
                          error={errors?.documento?.message}
                        />
                      )}

                      <Select
                        label={isPF ? "Área de atuação" : "Setor de atuação"}
                        prefix={
                          <BriefcaseIcon
                            className="size-5 transition-colors duration-200"
                            strokeWidth="1"
                          />
                        }
                        data={[
                          { label: "Selecione...", value: "" },
                          ...SETORES.map((s) => ({
                            label: s.nome,
                            value: s.code,
                          })),
                        ]}
                        value={watch("setor")}
                        onChange={(e) =>
                          setValue("setor", e.target.value, {
                            shouldValidate: true,
                          })
                        }
                        error={errors?.setor?.message}
                      />

                      {!isPF && (
                        <Input
                          label="Nome fantasia (opcional)"
                          placeholder="Como o time chama a empresa"
                          autoComplete="organization"
                          prefix={
                            <BuildingOffice2Icon
                              className="size-5 transition-colors duration-200"
                              strokeWidth="1"
                            />
                          }
                          {...register("nomeFantasia")}
                          error={errors?.nomeFantasia?.message}
                        />
                      )}

                      <PasswordInput
                        label="Senha"
                        placeholder="Crie uma senha"
                        description="Mín. 8 caracteres, com letra e número."
                        registration={register("senha")}
                        error={errors?.senha?.message}
                      />

                      <PasswordInput
                        label="Confirmar senha"
                        placeholder="Repita a senha"
                        registration={register("confirmarSenha")}
                        error={errors?.confirmarSenha?.message}
                      />

                      <div className="sm:col-span-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <Checkbox
                            label="Li e aceito os"
                            {...register("aceite")}
                          />
                          <a
                            href="##"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-600"
                          >
                            Termos de Uso
                          </a>
                          <span className="text-gray-400 dark:text-dark-300">
                            e a
                          </span>
                          <a
                            href="##"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-600"
                          >
                            Política de Privacidade (LGPD)
                          </a>
                        </div>
                        <InputErrorMsg when={!!errors?.aceite?.message}>
                          {errors?.aceite?.message}
                        </InputErrorMsg>
                      </div>
                    </div>

                    <InputErrorMsg when={!!erroGeral}>{erroGeral}</InputErrorMsg>

                    <div className="mt-6 flex flex-col sm:flex-row sm:justify-end">
                      <Button
                        type="submit"
                        className="w-full sm:w-auto sm:min-w-[16rem]"
                        color="primary"
                        disabled={isSubmitting}
                      >
                        {isSubmitting
                          ? "Criando conta..."
                          : "Começar teste grátis"}
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {!resultado && (
              <div className="mt-5 text-center text-xs-plus">
                <p className="line-clamp-1">
                  <span className="text-gray-400 dark:text-dark-300">
                    Já tem conta?
                  </span>{" "}
                  <Link
                    className="text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-600"
                    to="/login"
                  >
                    Entrar
                  </Link>
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </Page>
  );
}

/* ---------------------------------------------------------------- */

/** Campo de senha com botão para mostrar/ocultar o conteúdo. */
function PasswordInput({
  label,
  placeholder,
  description,
  registration,
  error,
}: {
  label: string;
  placeholder: string;
  description?: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <Input
      label={label}
      placeholder={placeholder}
      description={description}
      type={visivel ? "text" : "password"}
      autoComplete="new-password"
      prefix={
        <LockClosedIcon
          className="size-5 transition-colors duration-200"
          strokeWidth="1"
        />
      }
      suffix={
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="pointer-events-auto flex size-full items-center justify-center text-gray-400 transition-colors hover:text-gray-600 dark:text-dark-300 dark:hover:text-dark-100"
        >
          {visivel ? (
            <EyeSlashIcon className="size-5" strokeWidth="1.5" />
          ) : (
            <EyeIcon className="size-5" strokeWidth="1.5" />
          )}
        </button>
      }
      {...registration}
      error={error}
    />
  );
}

function Sucesso({ resultado }: { resultado: CadastroResultado }) {
  const { empresa, usuario, assinatura } = resultado;
  const terminaEm = new Date(usuario.trialEndsAt).toLocaleDateString("pt-BR");
  const plano = PLANOS[empresa.plano];
  const isPF = empresa.tipoPessoa === "pf";

  return (
    <div className="mx-auto max-w-md text-center">
      <CheckCircleIcon className="mx-auto size-14 text-primary-500" />
      <h3 className="mt-3 text-lg font-semibold text-gray-800 dark:text-dark-100">
        Conta criada com sucesso!
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-dark-200">
        Seu teste grátis de {TRIAL_DIAS} dias está ativo até{" "}
        <span className="font-semibold">{terminaEm}</span>.
      </p>

      <dl className="mt-5 space-y-2 rounded-lg border border-gray-200 p-4 text-left text-sm dark:border-dark-500">
        <Linha rotulo={isPF ? "Titular" : "Empresa"} valor={empresa.razaoSocial} />
        {!isPF && <Linha rotulo="CNPJ" valor={empresa.documento} />}
        <Linha
          rotulo="Módulos"
          valor={empresa.modulos.map(nomeModulo).join(", ")}
        />
        <Linha rotulo="Plano" valor={`${plano.nome} · ${empresa.ciclo}`} />
        {assinatura.usuarios > 0 && (
          <Linha rotulo="Usuários" valor={String(assinatura.usuarios)} />
        )}
        {assinatura.posicoes > 0 && (
          <Linha rotulo="Posições" valor={String(assinatura.posicoes)} />
        )}
        <Linha
          rotulo="Total estimado"
          valor={
            assinatura.sobConsulta
              ? "Sob consulta"
              : `${formatBRL(assinatura.total)}/mês`
          }
        />
      </dl>

      <Button
        className="mt-5 w-full gap-2"
        color="primary"
        component={Link}
        to="/onboarding"
      >
        Continuar para o onboarding
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-gray-400 dark:text-dark-300">{rotulo}</dt>
      <dd className="text-right font-medium text-gray-700 dark:text-dark-100">
        {valor}
      </dd>
    </div>
  );
}
